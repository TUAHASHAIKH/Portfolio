import assert from 'node:assert/strict'
import { writeFile } from 'node:fs/promises'
import { browser, wait } from './browser-session.mjs'

const page = await browser()
const until = async (expression, message) => {
  for (let i=0;i<200;i++) { if (await page.evaluate(expression)) return; await wait(200) }
  assert.fail(message)
}
try {
  await page.send('Network.enable')
  await page.send('Network.setCacheDisabled',{cacheDisabled:true})
  await page.send('Page.addScriptToEvaluateOnNewDocument',{source:`
    localStorage.setItem('portfolio-theme','light');
    window.startupAudit={ready:0,introduced:0,samples:[]};
    window.holdCrystal=true;
    const fetchOriginal=window.fetch;
    window.fetch=async function(input,...args){
      const url=input instanceof Request?input.url:String(input);
      if(url.endsWith('/geometry/crystal.drc')&&window.holdCrystal)await new Promise(resolve=>window.releaseCrystal=()=>{window.holdCrystal=false;resolve()});
      return fetchOriginal.call(this,input,...args);
    };
    let lastRead=0;
    for(const method of ['drawArrays','drawElements']){
      const original=WebGL2RenderingContext.prototype[method];
      WebGL2RenderingContext.prototype[method]=function(...args){
        const result=original.apply(this,args),now=performance.now();
        if(now-lastRead>300&&!this.getParameter(this.FRAMEBUFFER_BINDING)&&this.drawingBufferWidth>100){
          lastRead=now;const pixels=[],rgba=new Uint8Array(4);
          for(const [x,y] of [[.2,.2],[.5,.5],[.8,.8]]){
            this.readPixels(Math.floor(this.drawingBufferWidth*x),Math.floor(this.drawingBufferHeight*y),1,1,this.RGBA,this.UNSIGNED_BYTE,rgba);pixels.push([...rgba]);
          }
          startupAudit.samples.push({time:now,ready:document.querySelector('#loader')?.dataset.ready,pixels});
        }return result;
      };
    }
    const observer=new MutationObserver(()=>{
      if(!startupAudit.ready&&document.querySelector('#loader')?.dataset.ready==='true')startupAudit.ready=performance.now();
      if(!startupAudit.introduced&&document.querySelector('#app')?.dataset.introduced==='true')startupAudit.introduced=performance.now();
    });observer.observe(document,{subtree:true,attributes:true,childList:true});
  `})
  await page.send('Page.navigate',{url:process.env.PORTFOLIO_URL||'http://localhost:3000'})
  await until("document.querySelector('#app')?.dataset.heroReady==='true'",'The first complete landscape frame becomes ready')
  await page.evaluate('scrollTo(0,(document.documentElement.scrollHeight-innerHeight)*.1)')
  await wait(700)
  assert.equal(await page.evaluate("document.querySelector('#app').dataset.scenePending"),'true','Early scrolling waits for delayed crystal assets')
  assert.equal(await page.evaluate("document.querySelector('#app').dataset.stage"),'igloo','The existing landscape remains visible')
  assert.equal(await page.evaluate('document.querySelector(".scene-pending")'),null,'Delayed downloads never show a next-scene waiting caption')
  await until("startupAudit.introduced>0",'The entrance finishes while downloads are delayed')
  await page.capture('startup-delayed-crystal')
  assert.equal(await page.evaluate("document.querySelector('#app').dataset.crystalReady"),undefined,'Download completion cannot be confused with GPU readiness')
  await until("typeof window.releaseCrystal==='function'",'Scroll intent starts the next asset load')
  await page.evaluate('window.releaseCrystal()')
  await until("document.querySelector('#app').dataset.crystalReady==='true'&&document.querySelector('#app').dataset.stage==='crystal'",'The saved scroll request resumes when crystal shaders are ready')
  await wait(800)
  await page.capture('startup-first-crystal')
  const report=await page.evaluate('startupAudit')
  assert(report.samples.filter(s=>s.ready==='true').length>3,'Observe actual screen draws after readiness')
  assert(!report.samples.some(s=>s.ready==='true'&&s.pixels.every(p=>p[0]+p[1]+p[2]<12)),'No all-black output during cold scroll or shader preparation')
  await writeFile('.preview/startup-verification.json',JSON.stringify(report,null,2))
  console.log('PASS delayed cold scroll retains the hero, resumes the requested scene, and never renders black', {readyMs:Math.round(report.ready),introducedMs:Math.round(report.introduced)})

  await page.evaluate('window.previousCanvas=document.querySelector("canvas");previousCanvas.getContext("webgl2").getExtension("WEBGL_lose_context").loseContext()')
  await until("document.querySelector('canvas')!==window.previousCanvas&&document.querySelector('#app').dataset.heroReady==='true'",'A lost context rebuilds the scene instead of leaving a black canvas')
  await page.capture('startup-context-recovered')
  assert.deepEqual(page.errors,[],'No runtime or shader errors')
  console.log('PASS automatic context recovery with rebuilt GPU resources')
} finally { await page.close() }
