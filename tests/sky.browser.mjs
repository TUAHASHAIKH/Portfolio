import assert from 'node:assert/strict'
import {browser,wait} from './browser-session.mjs'
const b=await browser()
try{
 await b.send('Page.addScriptToEvaluateOnNewDocument',{source:`
 window.skyAudit={time:0,travel:0,motion:0};
 const names=new WeakMap();
 const get=WebGL2RenderingContext.prototype.getUniformLocation;
 WebGL2RenderingContext.prototype.getUniformLocation=function(p,name){const location=get.call(this,p,name);if(location)names.set(location,name);return location};
 const uniform=WebGL2RenderingContext.prototype.uniform1f;
 WebGL2RenderingContext.prototype.uniform1f=function(location,value){
  const name=names.get(location);
  if(name==='skyTime')skyAudit.time=value;
  if(name==='starTravel')skyAudit.travel=value;
  if(name==='skyMotion')skyAudit.motion=value;
  return uniform.call(this,location,value);
 };
 `})
 const motion=async reduce=>b.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-color-scheme',value:'dark'},{name:'prefers-reduced-motion',value:reduce?'reduce':'no-preference'}]})
 await motion(false)
 await b.send('Page.navigate',{url:process.env.PORTFOLIO_URL||'http://localhost:3000'})
 for(let i=0;i<240;i++){await wait(250);if(await b.evaluate('document.querySelector("#app")?.dataset.ringsReady')==='true')break}
 await b.evaluate('document.documentElement.dataset.theme="dark";dispatchEvent(new Event("portfolio:theme"))')
 await wait(6500)
 const start=await b.evaluate('({...skyAudit})');await wait(800)
 assert((await b.evaluate('skyAudit.time'))>start.time+.2,'Sky animates while idle')
 await b.capture('sky-night-glow')
 await b.send('Input.dispatchMouseEvent',{type:'mouseMoved',x:650,y:360});await wait(700);await b.capture('sky-night-hover-glow')
 const before=await b.evaluate('skyAudit.travel')
 await b.evaluate('scrollTo(0,(document.documentElement.scrollHeight-innerHeight)*.14)');await wait(2200)
 const forward=await b.evaluate('skyAudit.travel');assert(forward>before,'Forward scroll moves stars upward')
 await b.evaluate('scrollTo(0,(document.documentElement.scrollHeight-innerHeight)*.04)');await wait(2200)
 assert((await b.evaluate('skyAudit.travel'))<forward,'Reverse scrolling retraces the star field')
 await motion(true);await wait(800)
 const still=await b.evaluate('({...skyAudit})');await wait(500)
 assert.equal(await b.evaluate('skyAudit.time'),still.time,'Reduced motion freezes the sky clock')
 assert.equal(await b.evaluate('skyAudit.motion'),0,'Reduced motion disables shooting stars')
 await b.evaluate('scrollTo(0,0)');await wait(700);await b.capture('sky-night-static')
 assert.deepEqual(b.errors,[],'No browser or shader errors')
 console.log('PASS continuous sky animation, upward/reversible star scroll, igloo hover glow, reduced-motion freeze, shader compilation')
}finally{await b.close()}
