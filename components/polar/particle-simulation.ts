import * as THREE from 'three'
import { ParticleFlow } from './particle-flow'
import { particleNoise } from './particle-noise'

// Each grain has its own persistent position and velocity. Pointer strokes
// impart momentum; surface attraction and drag reform the selected shape.
export class ParticleSimulation {
  private targets: THREE.WebGLRenderTarget[]
  private sources: THREE.DataTexture[]
  private scene=new THREE.Scene()
  private camera=new THREE.OrthographicCamera(-1,1,1,-1,0,1)
  private quad=new THREE.PlaneGeometry(2,2)
  private material: THREE.ShaderMaterial
  private current=0
  private initialized=false
  private flow=new ParticleFlow()
  private aspect=1
  private transitionTime=0
  constructor(geometry:THREE.BufferGeometry,private volumes:THREE.Texture[]){
    const count=geometry.getAttribute('position').count,width=256,height=2**Math.ceil(Math.log2(Math.ceil(count/width)))
    this.targets=[0,1].map(()=>new THREE.WebGLRenderTarget(width,height,{count:2,type:THREE.FloatType,depthBuffer:false,minFilter:THREE.NearestFilter,magFilter:THREE.NearestFilter}))
    this.sources=['position','socialPosition1','socialPosition2','socialPosition3'].map(name=>{
      const attribute=geometry.getAttribute(name),data=new Float32Array(width*height*4)
      for(let i=0;i<count;i++){data[i*4]=attribute.getX(i);data[i*4+1]=attribute.getY(i);data[i*4+2]=attribute.getZ(i);data[i*4+3]=1}
      const texture=new THREE.DataTexture(data,width,height,THREE.RGBAFormat,THREE.FloatType)
      texture.needsUpdate=true;return texture
    })
    const uv=new Float32Array(count*2)
    for(let i=0;i<count;i++){uv[i*2]=(i%width+.5)/width;uv[i*2+1]=(Math.floor(i/width)+.5)/height}
    geometry.setAttribute('particleUv',new THREE.BufferAttribute(uv,2))
    this.material=new THREE.ShaderMaterial({
      glslVersion:THREE.GLSL3,depthTest:false,depthWrite:false,
      uniforms:{previousPosition:{value:this.position},previousVelocity:{value:this.velocity},shape0:{value:this.sources[0]},shape1:{value:this.sources[1]},shape2:{value:this.sources[2]},shape3:{value:this.sources[3]},weights:{value:new THREE.Vector4(1,0,0,0)},viewBasis:{value:new THREE.Matrix3()},projection:{value:new THREE.Matrix4()},volume:{value:volumes[0]},distanceScale:{value:2},flow:{value:null},screenLift:{value:0},volumeRotation:{value:0},delta:{value:0},time:{value:0},resetState:{value:1},additionalNoise:{value:0},interaction:{value:1}},
      vertexShader:'out vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',
      fragmentShader:`precision highp float;precision highp sampler3D;
        uniform sampler2D previousPosition;uniform sampler2D previousVelocity;
        uniform sampler2D shape0;uniform sampler2D shape1;uniform sampler2D shape2;uniform sampler2D shape3;
        uniform sampler2D flow;uniform sampler3D volume;uniform mat4 projection;uniform mat3 viewBasis;
        uniform vec4 weights;uniform float volumeRotation;uniform float distanceScale;uniform float screenLift;uniform float delta;uniform float time;uniform float resetState;uniform float additionalNoise;uniform float interaction;
        in vec2 vUv;layout(location=0)out vec4 nextPosition;layout(location=1)out vec4 nextVelocity;
        ${particleNoise}
        float random(vec2 uv){return fract(sin(dot(uv,vec2(127.1,311.7)))*43758.5453);}
        void main(){
          vec3 rest=texture(shape0,vUv).xyz*weights.x+texture(shape1,vUv).xyz*weights.y+texture(shape2,vUv).xyz*weights.z+texture(shape3,vUv).xyz*weights.w;
          if(resetState>.5){nextPosition=vec4(rest,0.);nextVelocity=vec4(0.);return;}
          vec3 p=texture(previousPosition,vUv).xyz,v=texture(previousVelocity,vUv).xyz;
          vec4 seed=vec4(random(vUv),random(vUv+.17),random(vUv+.39),random(vUv+.71));
          float ratio=delta*60.;
          vec4 clip=projection*vec4(p,1.);
          vec2 uv=clip.xy/max(.0001,clip.w)*.5+.5+vec2(0.,screenLift*.5);
          vec2 fluid=texture(flow,clamp(uv,vec2(0.),vec2(1.))).xy;
          v+=(vec3(fluid,0.)*viewBasis)*.0005*ratio*interaction;
          float attraction=1.-length(fluid)*.65*interaction;
          // The reference computation triangle has no rand attribute: its
          // generic vertex value is (0,0,0,1). Keep one coherent noise field.
          v+=BitangentNoise4D(vec4(p*7.,time))*(.00014+.0004*additionalNoise)*ratio;
          float c=cos(volumeRotation),s=sin(volumeRotation);
          mat3 rotation=mat3(c,0.,-s,0.,1.,0.,s,0.,c);
          vec4 sdf=texture(volume,rotation*p/.65*1.2+.5);
          vec3 gradient=normalize(sdf.rgb*2.-1.+vec3(.000001))*rotation;
          float distance=(sdf.a*2.-1.)*distanceScale;
          vec3 origin=(seed.xyz-.5)*.65;
          vec3 surfaceForce=gradient*.0015*mix(0.,-.3,sign(distance)+1.);
          // Every icon uses the same volume forces, fluid impulse, noise and
          // drag. Only its signed-distance texture changes on selection.
          v+=((origin-p)*.001+surfaceForce)*ratio*attraction;
          v*=pow(.9,ratio);p+=v*ratio;
          p.y=clamp(p.y,-.34,.35);p.xz*=min(1.,.275/max(length(p.xz),.000001));
          float speed=mix(texture(previousPosition,vUv).a,length(v)*60.,1.-pow(.965,ratio));
          nextPosition=vec4(p,speed);nextVelocity=vec4(v,1.);
        }`,
    })
    this.scene.add(new THREE.Mesh(this.quad,this.material))
  }
  get rotation(){return this.material.uniforms.volumeRotation.value as number}
  get volume(){return this.material.uniforms.volume.value as THREE.Texture}
  get distanceScale(){return this.material.uniforms.distanceScale.value as number}
  get position(){return this.targets[this.current].textures[0]}
  get velocity(){return this.targets[this.current].textures[1]}
  prepare(renderer:THREE.WebGLRenderer){this.volumes.forEach(volume=>renderer.initTexture(volume));return Promise.all([renderer.compileAsync(this.scene,this.camera),this.flow.prepare(renderer)])}
  clear(){this.initialized=false;this.transitionTime=0;this.flow.clear()}
  transition(){this.transitionTime=.5;this.material.uniforms.volumeRotation.value=Math.PI*1.5}
  orient(basis:THREE.Matrix3,projection:THREE.Matrix4,aspect:number,lift:number){
    this.material.uniforms.viewBasis.value.copy(basis);this.material.uniforms.projection.value.copy(projection)
    this.material.uniforms.screenLift.value=lift;this.aspect=aspect
  }
  update(renderer:THREE.WebGLRenderer,dt:number,weights:THREE.Vector4,brush:THREE.Vector2,last:THREE.Vector2,on:boolean,interaction=1,shape=0,forming=0){
    this.flow.update(renderer,dt,brush,last,on,this.aspect)
    const u=this.material.uniforms
    this.transitionTime=Math.max(0,this.transitionTime-dt)
    const progress=1-this.transitionTime/.5
    u.additionalNoise.value=Math.max(forming,progress<.5?1-4*progress**3:4*(1-progress)**3)
    u.interaction.value=interaction
    u.volume.value=this.volumes[shape]
    u.distanceScale.value=this.volumes[shape].userData.distanceScale??2
    u.flow.value=this.flow.texture
    u.previousPosition.value=this.position;u.previousVelocity.value=this.velocity;u.weights.value.copy(weights)
    // Flat logos face the reader; their grains still have the identical 3D
    // dynamics. The GitHub sculpture keeps the reference's continuous spin.
    u.volumeRotation.value=shape===0?u.volumeRotation.value-dt*.75:0
    u.delta.value=dt;u.time.value+=dt;u.resetState.value=this.initialized?0:1
    const previous=renderer.getRenderTarget(),next=1-this.current
    try{renderer.setRenderTarget(this.targets[next]);renderer.render(this.scene,this.camera);this.current=next;this.initialized=true}
    finally{renderer.setRenderTarget(previous)}
  }
  dispose(){this.flow.dispose();this.targets.forEach(target=>target.dispose());this.sources.forEach(source=>source.dispose());this.quad.dispose();this.material.dispose()}
}
