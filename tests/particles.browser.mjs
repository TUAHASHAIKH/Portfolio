import assert from 'node:assert/strict'
import {browser,wait} from './browser-session.mjs'
const b=await browser()
try{
 await b.send('Page.addScriptToEvaluateOnNewDocument',{source:`
  window.particleAudit={errors:[],draws:0,points:0,request:false,flow:null,particles:null,projectionError:0,noise:0,shape:0,surface:null};
  const known=new WeakMap(),sources=new WeakMap(),attached=new WeakMap(),textureData=new WeakMap();
  for(const method of ['texImage3D','texSubImage3D']){
   const upload=WebGL2RenderingContext.prototype[method];
   WebGL2RenderingContext.prototype[method]=function(...args){const data=args.find(value=>value instanceof Uint8Array),size=args[method==='texImage3D'?3:5];if(data&&args[0]===this.TEXTURE_3D&&args[1]===0){const texture=this.getParameter(this.TEXTURE_BINDING_3D);if(texture)textureData.set(texture,{data,size})}return upload.apply(this,args)};
  }
  const shaderSource=WebGL2RenderingContext.prototype.shaderSource,attachShader=WebGL2RenderingContext.prototype.attachShader;
  WebGL2RenderingContext.prototype.shaderSource=function(shader,source){sources.set(shader,source);return shaderSource.call(this,shader,source)};
  WebGL2RenderingContext.prototype.attachShader=function(program,shader){const list=attached.get(program)||[];list.push(shader);attached.set(program,list);return attachShader.call(this,program,shader)};
  const project=(m,p)=>[0,1,2,3].map(i=>m[i]*p[0]+m[i+4]*p[1]+m[i+8]*p[2]+m[i+12]*p[3]);
  let simulatedProjection;
  for(const method of ['drawArrays','drawElements']){
   const original=WebGL2RenderingContext.prototype[method];
   WebGL2RenderingContext.prototype[method]=function(mode,...args){
    const result=original.call(this,mode,...args),program=this.getParameter(this.CURRENT_PROGRAM);
    if(!program)return result;
    let type=known.get(program);
    if(type===undefined){const source=(attached.get(program)||[]).map(shader=>sources.get(shader)).join('');type=source.includes('out vec4 nextPosition')?'particles':source.includes('uniform vec2 impulse;')?'flow':source.includes('uniform sampler3D particleVolume')?'sculpture':'';known.set(program,type)}
    if(mode===this.POINTS)particleAudit.points=Math.max(particleAudit.points,method==='drawArrays'?args[1]:args[0]);
    const uniform=name=>this.getUniform(program,this.getUniformLocation(program,name));
    if(type==='particles'){particleAudit.draws++;simulatedProjection=uniform('projection');particleAudit.noise=uniform('additionalNoise')}
    if(type==='sculpture'&&this.getParameter(this.VIEWPORT)[2]>16&&uniform('simulationMix')>.5&&simulatedProjection){
     const point=[.08,.1,.03,1],a=project(simulatedProjection,point),c=project(uniform('projectionMatrix'),project(uniform('modelViewMatrix'),point));
     particleAudit.projectionError=Math.max(particleAudit.projectionError,Math.abs(a[0]/a[3]-c[0]/c[3]),Math.abs(a[1]/a[3]-c[1]/c[3]));
    }
    if(type){const error=this.getError();if(error&&particleAudit.errors.length<20)particleAudit.errors.push({type,error})}
    if(particleAudit.request&&(type==='particles'||type==='flow')){
     if(type==='flow'&&this.getUniform(program,this.getUniformLocation(program,'pass'))!==5)return result;
     const data=new Float32Array(128*4),buffer=this.getParameter(this.READ_BUFFER);
     this.readBuffer(this.COLOR_ATTACHMENT0);this.readPixels(0,type==='flow'?64:0,128,1,this.RGBA,this.FLOAT,data);this.readBuffer(buffer);
     particleAudit[type]=Array.from(data);
     if(type==='particles'&&particleAudit.shape>0){
      const active=this.getParameter(this.ACTIVE_TEXTURE),unit=uniform('volume');
      this.activeTexture(this.TEXTURE0+unit);const volume=textureData.get(this.getParameter(this.TEXTURE_BINDING_3D));this.activeTexture(active);
      if(volume){
       const {data:voxels,size}=volume,distances=[];
       for(let i=0;i<data.length;i+=4){
        const xyz=[data[i],data[i+1],data[i+2]].map(v=>Math.max(0,Math.min(size-1,(v/.65*1.2+.5)*size-.5)));
        const base=xyz.map(Math.floor),f=xyz.map((v,k)=>v-base[k]);let alpha=0;
        for(let z=0;z<2;z++)for(let y=0;y<2;y++)for(let x=0;x<2;x++){
         const index=((Math.min(size-1,base[2]+z)*size+Math.min(size-1,base[1]+y))*size+Math.min(size-1,base[0]+x))*4+3;
         alpha+=voxels[index]/255*(x?f[0]:1-f[0])*(y?f[1]:1-f[1])*(z?f[2]:1-f[2]);
        }
        distances.push((alpha*2-1)*uniform('distanceScale'));
       }
       particleAudit.surface={meanOutside:distances.reduce((sum,d)=>sum+Math.max(0,d),0)/distances.length,near:distances.filter(d=>d<.012).length/distances.length};
      }else particleAudit.surface=null;
     }
     if(particleAudit.flow&&particleAudit.particles)particleAudit.request=false;
    }
    return result;
   };
  }
 `})
 const media=reduced=>b.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:reduced?'reduce':'no-preference'}]})
 await media(true)
 await b.send('Page.navigate',{url:process.env.PORTFOLIO_URL||'http://localhost:3000'})
 for(let i=0;i<150;i++){await wait(200);if(await b.evaluate('document.querySelector("#app")?.dataset.crystalReady')==='true')break}
 await b.evaluate('scrollTo(0,(document.documentElement.scrollHeight-innerHeight)*.78)');await wait(500)
 await media(false)
 for(let i=0;i<150;i++){await wait(200);if(await b.evaluate('particleAudit.draws>30'))break}
 assert((await b.evaluate('particleAudit.draws'))>30,'Particle simulation must run')
 const sample=async()=>{
  await b.evaluate('particleAudit.flow=null;particleAudit.particles=null;particleAudit.request=true')
  for(let i=0;i<100;i++){await wait(50);if(!(await b.evaluate('particleAudit.request')))break}
  const data=await b.evaluate('({flow:particleAudit.flow,particles:particleAudit.particles,surface:particleAudit.surface})')
  assert(data.flow&&data.particles,'Both GPU fields must be readable')
  assert([...data.flow,...data.particles].every(Number.isFinite),'Simulation must stay finite')
  for(let i=0;i<data.particles.length;i+=4){assert(Math.abs(data.particles[i+1])<=.351);assert(Math.hypot(data.particles[i],data.particles[i+2])<=.276)}
  return {flow:data.flow.reduce((sum,value,i)=>sum+(i%4<2?Math.abs(value):0),0),positions:data.particles,surface:data.surface}
 }
 const idle=await sample()
 await b.capture('particles-volume-idle')
 await b.send('Input.dispatchMouseEvent',{type:'mouseMoved',x:380,y:400})
 for(let i=1;i<=24;i++){await b.send('Input.dispatchMouseEvent',{type:'mouseMoved',x:380+i*22,y:400+Math.sin(i/3)*90});await wait(25)}
 const stroke=await sample();await b.capture('particles-fluid-stroke')
 assert(stroke.flow>idle.flow+.01,'A pointer stroke must inject flow')
 await wait(350)
 const coast=await sample();assert(coast.flow>.01,'Flow must persist after pointer input stops')
 assert.notDeepEqual(stroke.positions,coast.positions,'Grains must continue moving after the stroke')
 await wait(1500);await b.capture('particles-fluid-recovery')
 for(const shape of [1,2,3,0]){
  await b.evaluate('particleAudit.shape='+shape+';document.querySelector(".social-next").click()');await wait(100)
  assert((await b.evaluate('particleAudit.noise'))>0,'Changing shapes must scatter grains with a turbulence burst')
  await wait(2500);const settled=await sample();await b.capture('particles-rest-'+['github','linkedin','whatsapp','gmail'][shape])
  if(shape>0){
   assert(settled.surface,'The selected social volume must be available')
   console.log('Resting volume',shape,settled.surface)
   assert(settled.surface.near>.9,'Resting grains must reform the icon volume')
   await b.send('Input.dispatchMouseEvent',{type:'mouseMoved',x:410,y:400});await wait(30)
   for(let i=1;i<=20;i++){await b.send('Input.dispatchMouseEvent',{type:'mouseMoved',x:410+i*22,y:400});await wait(20)}
   const scattered=await sample();await b.capture('particles-scatter-'+shape)
   assert(scattered.flow>.01,'Every social icon must receive fluid strokes')
   assert.notDeepEqual(scattered.positions,settled.positions,'Every social icon must scatter')
   await wait(3500);const recovered=await sample();await b.capture('particles-recovered-'+shape)
   assert(recovered.surface.near>.9,'Scattered grains must reform the same icon volume')
  }
  assert.equal(await b.evaluate('particleAudit.noise'),0,'The transition turbulence must settle')
 }
 assert((await b.evaluate('particleAudit.projectionError'))<.0001,'The fluid projection must match the displayed sculpture')
 await b.send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true})
 await wait(500);await sample();await b.capture('particles-mobile')
 assert((await b.evaluate('particleAudit.projectionError'))<.0001,'Portrait zoom must preserve the fluid projection')
 assert.equal(await b.evaluate('particleAudit.points'),150000,'Use the reference grain budget')
 await media(true);await wait(300)
 const draws=await b.evaluate('particleAudit.draws');await wait(350)
 assert.equal(await b.evaluate('particleAudit.draws'),draws,'Reduced motion must stop GPU simulation')
 assert.deepEqual(await b.evaluate('particleAudit.errors'),[],'No framebuffer feedback or WebGL errors')
 assert.deepEqual(b.errors,[])
 console.log('PASS 150,000 bounded grains, fluid injection and persistence, all social targets, reduced motion, and no shader errors',{idle:idle.flow,stroke:stroke.flow,coast:coast.flow})
}finally{await b.close()}
