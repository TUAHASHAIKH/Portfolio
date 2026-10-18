import * as THREE from 'three'

// A small feedback field carries pointer momentum and fades it continuously.
// Particle vertices sample it independently; no per-particle CPU work occurs
// during interaction, and there is no simulation cost outside the chamber.
export class ParticleField {
  private targets=[0,1].map(()=>new THREE.WebGLRenderTarget(128,128,{type:THREE.HalfFloatType,depthBuffer:false,minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter}))
  private scene=new THREE.Scene()
  private camera=new THREE.OrthographicCamera(-1,1,1,-1,0,1)
  private geometry=new THREE.PlaneGeometry(2,2)
  private material=new THREE.ShaderMaterial({
    uniforms:{previous:{value:this.targets[0].texture},brush:{value:new THREE.Vector2(10,10)},last:{value:new THREE.Vector2(10,10)},velocity:{value:new THREE.Vector2()},delta:{value:0},time:{value:0},brushActive:{value:0}},
    vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',
    fragmentShader:`uniform sampler2D previous;uniform vec2 brush;uniform vec2 last;uniform vec2 velocity;uniform float delta;uniform float time;uniform float brushActive;varying vec2 vUv;
      void main(){vec4 field=texture2D(previous,vUv);field.rgb*=exp(-delta*4.5);field.a*=exp(-delta*3.);
        vec2 line=brush-last;float along=clamp(dot(vUv-last,line)/max(dot(line,line),.00001),0.,1.);
        vec2 closest=last+line*along;vec2 direction=vUv-closest;float falloff=exp(-dot(direction,direction)/.006)*brushActive;
        float speed=min(1.,length(velocity)*.3);
        vec2 force=velocity*.015+normalize(direction+vec2(.0001))*(.12+speed*.1);
        float turbulence=sin(vUv.x*74.+vUv.y*51.+time*3.);
        field.xy+=force*falloff*delta*9.;field.z+=turbulence*falloff*delta*.45;
        field.rgb=clamp(field.rgb,vec3(-.2),vec3(.2));field.a=min(1.,field.a+falloff*delta*(3.+speed*10.));
        gl_FragColor=field;}`,
    depthTest:false,depthWrite:false,
  })
  private current=0
  constructor(){this.scene.add(new THREE.Mesh(this.geometry,this.material))}
  get texture(){return this.targets[this.current].texture}
  prepare(renderer:THREE.WebGLRenderer){return renderer.compileAsync(this.scene,this.camera)}
  clear(renderer:THREE.WebGLRenderer){
    const target=renderer.getRenderTarget(),color=renderer.getClearColor(new THREE.Color()),alpha=renderer.getClearAlpha()
    try{renderer.setClearColor(0,0);for(const buffer of this.targets){renderer.setRenderTarget(buffer);renderer.clear()}}
    finally{renderer.setClearColor(color,alpha);renderer.setRenderTarget(target)}
  }
  update(renderer:THREE.WebGLRenderer,dt:number,brush:THREE.Vector2,last:THREE.Vector2,velocity:THREE.Vector2,active:boolean){
    const uniforms=this.material.uniforms
    uniforms.previous.value=this.texture;uniforms.brush.value.copy(brush);uniforms.last.value.copy(last)
    uniforms.velocity.value.copy(velocity);uniforms.brushActive.value=active?1:0;uniforms.delta.value=dt;uniforms.time.value+=dt
    const previous=renderer.getRenderTarget(),next=1-this.current
    try{renderer.setRenderTarget(this.targets[next]);renderer.render(this.scene,this.camera);this.current=next}
    finally{renderer.setRenderTarget(previous)}
  }
  dispose(){this.targets.forEach(target=>target.dispose());this.geometry.dispose();this.material.dispose()}
}
