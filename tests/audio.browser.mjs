import assert from 'node:assert/strict'
import { browser, wait } from './browser-session.mjs'

for (const policy of ['document-user-activation-required','no-user-gesture-required']) {
  const page=await browser({autoplayPolicy:policy})
  const until=async expression=>{
    for(let i=0;i<200;i++){if(await page.evaluate(expression))return;await wait(200)}
    assert.fail(`Audio did not settle: ${expression}`)
  }
  const click=async selector=>{
    const point=await page.evaluate(`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`)
    await page.send('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...point})
    await page.send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...point})
  }
  try {
    await page.send('Page.addScriptToEvaluateOnNewDocument',{source:`
      window.audioAudit={contexts:[],loops:[],master:null};
      const Context=window.AudioContext;
      window.AudioContext=class extends Context {
        constructor(...args){super(...args);audioAudit.contexts.push(this)}
        createGain(){const gain=super.createGain();audioAudit.master||=gain;return gain}
        createBufferSource(){const source=super.createBufferSource(),start=source.start.bind(source);source.start=(...args)=>{if(source.loop)audioAudit.loops.push(source);return start(...args)};return source}
      };
    `})
    await page.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]})
    await page.send('Page.navigate',{url:process.env.PORTFOLIO_URL||'http://localhost:3000'})
    await until('document.querySelector(".sound-toggle")?.getAttribute("aria-busy")==="false"&&audioAudit.loops.length===7')
    const allowed=policy==='no-user-gesture-required'
    assert.equal(await page.evaluate('document.querySelector(".sound-toggle").getAttribute("aria-pressed")'),String(allowed),'The sound control reflects actual autoplay permission')
    if(!allowed) {
      assert.match(await page.evaluate('document.querySelector(".sound-toggle").textContent'),/Enable/)
      await click('.sound-toggle')
    }
    await until('document.querySelector(".sound-toggle").getAttribute("aria-pressed")==="true"')
    assert.equal(await page.evaluate('audioAudit.contexts.length'),1,'Unlock reuses the prepared audio context')
    assert.equal(await page.evaluate('audioAudit.contexts[0].state'),'running')
    const signal=await page.evaluate(`new Promise(resolve=>{
      const context=audioAudit.contexts[0],analyser=context.createAnalyser();analyser.fftSize=256;audioAudit.master.connect(analyser);
      setTimeout(()=>{const samples=new Float32Array(256);analyser.getFloatTimeDomainData(samples);audioAudit.master.disconnect(analyser);analyser.disconnect();resolve(Math.max(...samples.map(Math.abs)))},250);
    })`)
    assert(signal>.0001,'Default ambience produces an audible signal')
    await click('.sound-toggle')
    assert.equal(await page.evaluate('document.querySelector(".sound-toggle").getAttribute("aria-pressed")'),'false')
    await page.send('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,x:1000,y:700})
    await page.send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,x:1000,y:700})
    assert.equal(await page.evaluate('document.querySelector(".sound-toggle").getAttribute("aria-pressed")'),'false','Other gestures preserve an explicit mute')
    await click('.sound-toggle')
    await until('document.querySelector(".sound-toggle").getAttribute("aria-pressed")==="true"')
    assert.equal(await page.evaluate('audioAudit.loops.length'),7,'Unmute reuses all seven loops')
    await click('.sound-toggle')
    await page.evaluate("window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true}))")
    await until('document.querySelector(".sound-toggle").getAttribute("aria-pressed")==="true"')
    assert.equal(await page.evaluate('audioAudit.loops.length'),7,'Restoring a visit enables sound without duplicate loops')
    await click('.sound-toggle')
    const previousDocument=await page.evaluate('performance.timeOrigin')
    await page.send('Page.reload')
    await until('performance.timeOrigin!=='+previousDocument)
    await until('audioAudit.loops.length===7 && document.querySelector(".sound-toggle")?.getAttribute("aria-busy")==="false"')
    assert.match(await page.evaluate('document.querySelector(".sound-toggle").textContent'),/Sound: (On|Enable)/,'A muted visit must not make the next reload default to Off')
    if(!allowed){
      await page.send('Input.dispatchKeyEvent',{type:'keyDown',key:'a',code:'KeyA',windowsVirtualKeyCode:65})
      await page.send('Input.dispatchKeyEvent',{type:'keyUp',key:'a',code:'KeyA',windowsVirtualKeyCode:65})
    }
    await until('document.querySelector(".sound-toggle").getAttribute("aria-pressed")==="true"')
    assert.deepEqual(page.errors,[],'No runtime or audio errors')
    console.log('PASS',policy, 'audio signal, unlock, explicit mute, loop reuse, restored visit, and sound on after reload')
  } finally { await page.close() }
}
