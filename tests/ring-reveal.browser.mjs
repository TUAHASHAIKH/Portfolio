import assert from 'node:assert/strict'
import {browser,wait} from './browser-session.mjs'

const b=await browser()
try{
 await b.send('Page.addScriptToEvaluateOnNewDocument',{source:`
  window.revealAudit={alpha:0,glow:1,simulation:0,noise:0,draws:0,sample:false,peak:null,errors:[]};
  const sources=new WeakMap(),attached=new WeakMap(),known=new WeakMap();
  const source=WebGL2RenderingContext.prototype.shaderSource,attach=WebGL2RenderingContext.prototype.attachShader;
  WebGL2RenderingContext.prototype.shaderSource=function(s,v){sources.set(s,v);return source.call(this,s,v)};
  WebGL2RenderingContext.prototype.attachShader=function(p,s){const list=attached.get(p)||[];list.push(s);attached.set(p,list);return attach.call(this,p,s)};
  for(const method of ['drawArrays','drawElements']){
   const draw=WebGL2RenderingContext.prototype[method];
   WebGL2RenderingContext.prototype[method]=function(...args){
    const result=draw.apply(this,args),p=this.getParameter(this.CURRENT_PROGRAM);if(!p)return result;
    let type=known.get(p);if(type===undefined){const text=(attached.get(p)||[]).map(s=>sources.get(s)).join('');type=text.includes('uniform sampler3D particleVolume')?'core':text.includes('out vec4 nextPosition')?'simulation':text.includes('interpolateGrade')?'grade':'';known.set(p,type)}
    const u=n=>this.getUniform(p,this.getUniformLocation(p,n)),viewport=this.getParameter(this.VIEWPORT);
    if(type==='core'&&viewport[2]>16){revealAudit.alpha=u('reveal');revealAudit.glow=u('glow');revealAudit.simulation=u('simulationMix')}
    if(type==='simulation'){revealAudit.draws++;revealAudit.noise=u('additionalNoise')}
    if(type==='grade'&&revealAudit.sample){
     const data=new Float32Array(128*128*4),previous=this.getParameter(this.READ_BUFFER);
     this.readBuffer(this.COLOR_ATTACHMENT0);this.readPixels((viewport[2]-128)>>1,(viewport[3]-128)>>1,128,128,this.RGBA,this.FLOAT,data);this.readBuffer(previous);
     let peak=0;for(let i=0;i<data.length;i++)if(i%4<3)peak=Math.max(peak,data[i]);
     revealAudit.peak=peak;revealAudit.sample=false;
    }
    if(type){const error=this.getError();if(error)revealAudit.errors.push({type,error})}
    return result;
   };
  }
 `})
 const media=reduce=>b.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:reduce?'reduce':'no-preference'}]})
 await media(true)
 await b.send('Page.navigate',{url:process.env.PORTFOLIO_URL||'http://localhost:3000'})
 for(let i=0;i<150;i++){await wait(200);if(await b.evaluate('document.querySelector("#app")?.dataset.ringsReady')==='true')break}
 await b.evaluate('scrollTo(0,(document.documentElement.scrollHeight-innerHeight)*.33)');await wait(500)
 await media(false)
 const captured=new Set()
 for(let i=0;i<55;i++){
  await b.send('Input.dispatchMouseEvent',{type:'mouseWheel',x:1100,y:450,deltaY:160,deltaX:0});await wait(650)
  const state=await b.evaluate('revealAudit')
  const stage=state.alpha>.001&&state.alpha<.1?'early':state.alpha>.5&&state.alpha<.8?'forming':state.glow<.05&&state.alpha===1?'formed':null
  if(stage&&!captured.has(stage)){
   assert.equal(state.simulation,1,'Grains must already be simulated inside the rings')
   if(stage!=='formed')assert(state.noise>.5,'The ring reveal needs the reference forming turbulence')
   await b.evaluate('revealAudit.peak=null;revealAudit.sample=true')
   for(let j=0;j<50;j++){await wait(50);if(!(await b.evaluate('revealAudit.sample')))break}
   const peak=await b.evaluate('revealAudit.peak')
   assert(peak!==null&&Number.isFinite(peak)&&peak<=1.001,'Particle highlights must be bounded before bloom')
   await b.capture('ring-reveal-'+stage);captured.add(stage)
  }
  if(captured.size===3)break
 }
 assert.equal(captured.size,3,'Scroll must cover early, forming and fully formed particles')
 for(let i=0;i<22;i++){await b.send('Input.dispatchMouseEvent',{type:'mouseWheel',x:1100,y:450,deltaY:-160,deltaX:0});await wait(150)}
 await wait(1500)
 const reverse=await b.evaluate('revealAudit');assert(reverse.alpha<.8&&reverse.alpha>0,'Reverse scrolling must restore the reveal')
 await b.capture('ring-reveal-reverse')
 await media(true);await wait(500)
 const draws=await b.evaluate('revealAudit.draws');await wait(400)
 assert.equal(await b.evaluate('revealAudit.draws'),draws,'Reduced motion must freeze the simulation')
 assert.deepEqual(await b.evaluate('revealAudit.errors'),[],'Reveal must not emit WebGL errors')
 assert.equal(b.errors.length,0,JSON.stringify(b.errors))
 console.log('PASS ring reveal: live forming grains, bounded highlights, reverse scroll, reduced motion, no GPU errors')
}finally{await b.close()}
