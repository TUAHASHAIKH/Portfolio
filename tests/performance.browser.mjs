import assert from 'node:assert/strict'
import { browser, wait } from './browser-session.mjs'
const b = await browser()
try {
  await b.send('Page.addScriptToEvaluateOnNewDocument', {source:`
    localStorage.setItem('portfolio-theme','light');
    window.renderAudit={draws:0,ice:0};
    const sources=new WeakMap(),attached=new WeakMap(),programs=new WeakMap();
    const source=WebGL2RenderingContext.prototype.shaderSource,attach=WebGL2RenderingContext.prototype.attachShader;
    WebGL2RenderingContext.prototype.shaderSource=function(shader,text){sources.set(shader,text);return source.call(this,shader,text)};
    WebGL2RenderingContext.prototype.attachShader=function(program,shader){const list=attached.get(program)||[];list.push(shader);attached.set(program,list);return attach.call(this,program,shader)};
    for(const method of ['drawArrays','drawElements','drawArraysInstanced','drawElementsInstanced']){
      const original=WebGL2RenderingContext.prototype[method];
      WebGL2RenderingContext.prototype[method]=function(...args){
        renderAudit.draws++;const program=this.getParameter(this.CURRENT_PROGRAM);
        if(!programs.has(program))programs.set(program,(attached.get(program)||[]).some(shader=>sources.get(shader)?.includes('uniform sampler2D iceTransforms;')));
        if(programs.get(program))renderAudit.ice++;
        return original.apply(this,args);
      };
    }
  `})
  const motion = reduce => b.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:reduce?'reduce':'no-preference'}]})
  await motion(true)
  await b.send('Page.navigate',{url:process.env.PORTFOLIO_URL||'http://localhost:3000'})
  for(let i=0;i<240;i++){if(await b.evaluate("document.querySelector('#app')?.dataset.ringsReady==='true'"))break;await wait(250)}
  assert(await b.evaluate("document.querySelector('#app')?.dataset.ringsReady==='true'"),'All staged resources become ready')
  console.log('PASS staged resources loaded')
  await wait(500)
  const draws = await b.evaluate('renderAudit.draws')
  await wait(500)
  assert.equal(await b.evaluate('renderAudit.draws'),draws,'Static reduced-motion mode performs no GPU draws')
  await b.capture('performance-static-light')
  for(const [position,stage] of [[.1,'crystal'],[.4,'rings'],[.78,'contact'],[0,'igloo']]) {
    await b.evaluate(`scrollTo(0,(document.documentElement.scrollHeight-innerHeight)*${position})`)
    await wait(500)
    assert.equal(await b.evaluate("document.querySelector('#app').dataset.stage"),stage,'Scroll redraws the correct scene in demand mode')
  }
  await b.evaluate("document.querySelector('.theme-toggle').click()")
  await wait(500)
  assert.equal(await b.evaluate('document.documentElement.dataset.theme'),'dark')
  assert((await b.evaluate('renderAudit.draws'))>draws,'Theme switching repaints a static scene')
  await b.capture('performance-static-dark')
  console.log('PASS static rendering and event-driven refresh')
  await motion(false)
  await wait(1200)
  await b.evaluate('renderAudit.draws=0;renderAudit.ice=0')
  await wait(1000)
  const counts=await b.evaluate('({...renderAudit})')
  assert(counts.ice>10,'The complete igloo renders while animated')
  assert(counts.draws/counts.ice<45,'The igloo uses one batch, keeping total hero draws below 45 per frame')
  await b.send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:3,mobile:true})
  await wait(700)
  assert(await b.evaluate('document.querySelector("canvas").width>=390'),'Mobile retains full visual resolution')
  await b.capture('performance-mobile-dark')
  assert.deepEqual(b.errors,[],'No browser or shader errors')
  console.log('PASS batched ice, animated rendering, mobile resolution and shader compilation',counts)
} finally { await b.close() }
