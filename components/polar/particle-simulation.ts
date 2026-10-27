import * as THREE from 'three'

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
  constructor(geometry:THREE.BufferGeometry){
    const count=geometry.getAttribute('position').count,width=256,height=2**Math.ceil(Math.log2(Math.ceil(count/width)))
    this.targets=[0,1].map(()=>new THREE.WebGLRenderTarget(width,height,{count:2,type:THREE.HalfFloatType,depthBuffer:false,minFilter:THREE.NearestFilter,magFilter:THREE.NearestFilter}))
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
      uniforms:{previousPosition:{value:this.position},previousVelocity:{value:this.velocity},shape0:{value:this.sources[0]},shape1:{value:this.sources[1]},shape2:{value:this.sources[2]},shape3:{value:this.sources[3]},weights:{value:new THREE.Vector4(1,0,0,0)},viewBasis:{value:new THREE.Matrix3()},viewDepth:{value:1},brush:{value:new THREE.Vector2(10,10)},lastBrush:{value:new THREE.Vector2(10,10)},brushVelocity:{value:new THREE.Vector2()},brushOn:{value:0},delta:{value:0},time:{value:0},resetState:{value:1}},
      vertexShader:'out vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',
      fragmentShader:`precision highp float;
        uniform sampler2D previousPosition;uniform sampler2D previousVelocity;
        uniform sampler2D shape0;uniform sampler2D shape1;uniform sampler2D shape2;uniform sampler2D shape3;
        uniform mat3 viewBasis;uniform float viewDepth;uniform vec4 weights;uniform vec2 brush;uniform vec2 lastBrush;uniform vec2 brushVelocity;
        uniform float brushOn;uniform float delta;uniform float time;uniform float resetState;
        in vec2 vUv;layout(location=0)out vec4 nextPosition;layout(location=1)out vec4 nextVelocity;
        void main(){
          vec3 rest=texture(shape0,vUv).xyz*weights.x+texture(shape1,vUv).xyz*weights.y+texture(shape2,vUv).xyz*weights.z+texture(shape3,vUv).xyz*weights.w;
          if(resetState>.5){nextPosition=vec4(rest,0.);nextVelocity=vec4(0.);return;}
          vec3 p=texture(previousPosition,vUv).xyz,v=texture(previousVelocity,vUv).xyz;
          float seed=fract(sin(dot(vUv,vec2(127.1,311.7)))*43758.5453);
          vec3 aligned=viewBasis*p;vec2 projected=aligned.xy*viewDepth/max(.1,viewDepth-aligned.z);
          vec2 stroke=brush-lastBrush;float t=clamp(dot(projected-lastBrush,stroke)/max(dot(stroke,stroke),.000001),0.,1.);
          vec2 radial=projected-(lastBrush+stroke*t);float radius=.045+seed*.025;
          float influence=exp(-dot(radial,radial)/(radius*radius))*brushOn;
          float speed=min(2.,length(brushVelocity));
          vec2 tangent=vec2(-radial.y,radial.x)/max(length(radial),.005);
          vec3 flow=vec3(brushVelocity*.8+tangent*speed*.3,sin(seed*31.+time)*speed*.12)*viewBasis;
          v+=flow*influence*delta*12.;
          // Small curl keeps individual grains alive without dissolving a
          // stationary silhouette or continuously repelling a resting cursor.
          vec3 curl=vec3(sin(p.y*23.+time+seed*6.),cos(p.z*19.-time*.7+seed*7.),sin(p.x*21.+time*.8+seed*9.));
          v+=curl*delta*.012;
          v+=(rest-p)*(1.-influence*.9)*delta*(18.+seed*5.);
          v*=exp(-delta*(5.5+seed));
          float maxSpeed=.8;v*=min(1.,maxSpeed/max(length(v),.00001));p+=v*delta;
          p.y=clamp(p.y,-.38,.38);float r=length(p.xz);p.xz*=min(1.,.34/max(r,.00001));
          // Preserve physical speed for shading; a clamped glow mask loses the
          // distinction between moderate motion and the fastest scattered grains.
          float shadedSpeed=mix(texture(previousPosition,vUv).a,length(v),1.-exp(-2.1376*delta));
          nextPosition=vec4(p,shadedSpeed);nextVelocity=vec4(v,1.);
        }`,
    })
    this.scene.add(new THREE.Mesh(this.quad,this.material))
  }
  get position(){return this.targets[this.current].textures[0]}
  get velocity(){return this.targets[this.current].textures[1]}
  prepare(renderer:THREE.WebGLRenderer){return renderer.compileAsync(this.scene,this.camera)}
  clear(){this.initialized=false}
  orient(basis:THREE.Matrix3,depth:number){this.material.uniforms.viewBasis.value.copy(basis);this.material.uniforms.viewDepth.value=depth}
  update(renderer:THREE.WebGLRenderer,dt:number,weights:THREE.Vector4,brush:THREE.Vector2,last:THREE.Vector2,velocity:THREE.Vector2,on:boolean){
    const u=this.material.uniforms
    u.previousPosition.value=this.position;u.previousVelocity.value=this.velocity;u.weights.value.copy(weights)
    u.brush.value.copy(brush).subScalar(.5).multiplyScalar(.6);u.lastBrush.value.copy(last).subScalar(.5).multiplyScalar(.6)
    u.brushVelocity.value.copy(velocity).multiplyScalar(.6);u.brushOn.value=on?1:0;u.delta.value=dt;u.time.value+=dt;u.resetState.value=this.initialized?0:1
    const previous=renderer.getRenderTarget(),next=1-this.current
    try{renderer.setRenderTarget(this.targets[next]);renderer.render(this.scene,this.camera);this.current=next;this.initialized=true}
    finally{renderer.setRenderTarget(previous)}
  }
  dispose(){this.targets.forEach(target=>target.dispose());this.sources.forEach(source=>source.dispose());this.quad.dispose();this.material.dispose()}
}
