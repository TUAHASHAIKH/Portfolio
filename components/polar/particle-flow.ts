import * as THREE from 'three'

// Persistent screen-space flow: pointer strokes deposit velocity, pressure
// removes divergence, and advection carries that velocity after the mouse stops.
export class ParticleFlow {
  private velocity = [this.target(), this.target()]
  private pressure = [this.target(false), this.target(false)]
  private divergence = this.target(false)
  private scene = new THREE.Scene()
  private camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
  private geometry = new THREE.PlaneGeometry(2, 2)
  private dirty = true
  private clock = 0
  private lastUpdate = 0
  private lastSplat = -Infinity
  private previousPoint = new THREE.Vector2()
  private hasPoint = false
  private savedColor = new THREE.Color()
  private material = new THREE.ShaderMaterial({
    depthTest: false, depthWrite: false,
    uniforms: { field: {value:null}, pressure: {value:null}, divergence: {value:null}, pass: {value:0}, ratio: {value:1}, aspect: {value:1}, point: {value:new THREE.Vector2()}, previous: {value:new THREE.Vector2()}, impulse: {value:new THREE.Vector2()} },
    vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',
    fragmentShader: `varying vec2 vUv;uniform sampler2D field;uniform sampler2D pressure;uniform sampler2D divergence;
      uniform int pass;uniform float ratio;uniform float aspect;uniform vec2 point;uniform vec2 previous;uniform vec2 impulse;
      void main(){
        vec2 dx=vec2(1./128.,0.),dy=dx.yx;
        vec2 velocity=texture2D(field,vUv).xy;
        if(pass==0){
          vec2 pa=(vUv-previous)*vec2(aspect,1.),ba=(point-previous)*vec2(aspect,1.);
          float along=clamp(dot(pa,ba)/max(dot(ba,ba),.000001),0.,1.);
          float influence=pow(clamp(1.-length(pa-ba*along)/.22,0.,1.),3.);
          gl_FragColor=vec4(velocity+impulse*35.*influence,0.,1.);
        }else if(pass==1){
          float divergenceValue=.5*(texture2D(field,vUv+dx).x-texture2D(field,vUv-dx).x+texture2D(field,vUv+dy).y-texture2D(field,vUv-dy).y);
          gl_FragColor=vec4(divergenceValue,0.,0.,1.);
        }else if(pass==2){gl_FragColor=texture2D(field,vUv)*pow(.86,ratio);
        }else if(pass==3){
          float sum=texture2D(pressure,vUv-dx).x+texture2D(pressure,vUv+dx).x+texture2D(pressure,vUv-dy).x+texture2D(pressure,vUv+dy).x;
          gl_FragColor=vec4((sum-texture2D(divergence,vUv).x)*.25,0.,0.,1.);
        }else if(pass==4){
          velocity-=vec2(texture2D(pressure,vUv+dx).x-texture2D(pressure,vUv-dx).x,texture2D(pressure,vUv+dy).x-texture2D(pressure,vUv-dy).x);
          gl_FragColor=vec4(velocity,0.,1.);
        }else{gl_FragColor=vec4(texture2D(field,vUv-velocity*ratio/128.).xy*pow(.98,ratio),0.,1.);}
      }`,
  })
  constructor(){this.scene.add(new THREE.Mesh(this.geometry,this.material))}
  private target(linear=true){return new THREE.WebGLRenderTarget(128,128,{type:THREE.HalfFloatType,depthBuffer:false,minFilter:linear?THREE.LinearFilter:THREE.NearestFilter,magFilter:linear?THREE.LinearFilter:THREE.NearestFilter})}
  get texture(){return this.velocity[0].texture}
  clear(){this.dirty=true;this.hasPoint=false;this.lastSplat=-Infinity}
  prepare(renderer:THREE.WebGLRenderer){return renderer.compileAsync(this.scene,this.camera)}
  update(renderer:THREE.WebGLRenderer,dt:number,point:THREE.Vector2,previous:THREE.Vector2,on:boolean,aspect:number){
    const oldTarget=renderer.getRenderTarget(),oldColor=renderer.getClearColor(this.savedColor),oldAlpha=renderer.getClearAlpha()
    const u=this.material.uniforms
    const draw=(pass:number,target:THREE.WebGLRenderTarget)=>{
      // All declared samplers participate in WebGL feedback validation, even
      // when the current pass does not sample them. Unbind old attachments.
      for(const name of ['field','pressure','divergence'])if(u[name].value===target.texture)u[name].value=null
      u.pass.value=pass;renderer.setRenderTarget(target);renderer.render(this.scene,this.camera)
    }
    const swap=(pair:THREE.WebGLRenderTarget[])=>{const first=pair[0];pair[0]=pair[1];pair[1]=first}
    try{
      if(this.dirty){renderer.setClearColor(0,0);for(const target of [...this.velocity,...this.pressure,this.divergence]){renderer.setRenderTarget(target);renderer.clear()}this.dirty=false;renderer.setClearColor(oldColor,oldAlpha)}
      u.ratio.value=dt*60;u.aspect.value=aspect
      this.clock+=dt
      if(!on)this.hasPoint=false
      // Match the reference's 16 ms sampling cadence without losing the
      // accumulated pointer stroke on displays faster than 60 Hz.
      if(on&&this.clock-this.lastUpdate>=.016){
        if(!this.hasPoint){this.previousPoint.copy(previous);this.hasPoint=true;this.lastSplat=this.clock}
        if(point.distanceToSquared(this.previousPoint)>1e-10){
          if(this.clock-this.lastSplat<=.15){
            u.point.value.copy(point);u.previous.value.copy(this.previousPoint);u.impulse.value.subVectors(point,this.previousPoint);u.impulse.value.x*=aspect
            u.field.value=this.texture;draw(0,this.velocity[1]);swap(this.velocity)
          }
          this.lastSplat=this.clock
        }
        this.previousPoint.copy(point);this.lastUpdate=this.clock
      }
      u.field.value=this.texture;draw(1,this.divergence)
      u.field.value=this.pressure[0].texture;draw(2,this.pressure[1]);swap(this.pressure)
      u.divergence.value=this.divergence.texture
      // The reference's constructor uses its default of three Jacobi passes.
      for(let i=0;i<3;i++){u.pressure.value=this.pressure[0].texture;draw(3,this.pressure[1]);swap(this.pressure)}
      u.pressure.value=this.pressure[0].texture;u.field.value=this.texture;draw(4,this.velocity[1]);swap(this.velocity)
      u.field.value=this.texture;draw(5,this.velocity[1]);swap(this.velocity)
    }finally{renderer.setRenderTarget(oldTarget);renderer.setClearColor(oldColor,oldAlpha)}
  }
  dispose(){[...this.velocity,...this.pressure,this.divergence].forEach(target=>target.dispose());this.geometry.dispose();this.material.dispose()}
}
