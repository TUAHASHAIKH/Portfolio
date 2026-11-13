import assert from 'node:assert/strict'
import { writeFile } from 'node:fs/promises'
import { browser, wait } from './browser-session.mjs'

// Exercise a complete lap using real wheel input, not isolated settled poses.
// Timing is reported rather than asserted: host GPUs and CPU throttling vary.
const reports=[]
for(const mobile of [false,true]) {
  const page=await browser()
  try {
    if(mobile)await page.send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:3,mobile:true})
    await page.send('Page.addScriptToEvaluateOnNewDocument',{source:`
      window.scrollAudit={active:false,frames:[]};
      let last=0;
      function sample(now){
        if(scrollAudit.active&&last){const app=document.querySelector('#app');scrollAudit.frames.push({ms:now-last,stage:app?.dataset.stage,pending:app?.dataset.scenePending})}
        last=now;requestAnimationFrame(sample)
      }
      requestAnimationFrame(sample);
    `})
    await page.send('Page.navigate',{url:process.env.PORTFOLIO_URL||'http://localhost:3000'})
    for(let i=0;i<240;i++){
      if(await page.evaluate("document.querySelector('#app')?.dataset.ringsReady==='true'&&document.querySelector('#app')?.dataset.introduced==='true'"))break
      await wait(250)
    }
    assert(await page.evaluate("document.querySelector('#app')?.dataset.ringsReady==='true'"),'Complete GPU preparation before testing the lap')
    await wait(1000)
    const cpu=Number(process.env.AUDIT_CPU||1)
    await page.send('Emulation.setCPUThrottlingRate',{rate:cpu})
    await page.evaluate('scrollAudit.active=true')
    let looped=false
    for(let i=0;i<240;i++){
      await page.send('Input.dispatchMouseEvent',{type:'mouseWheel',x:190,y:400,deltaX:0,deltaY:450})
      await wait(180)
      if(await page.evaluate("Number(document.querySelector('#app').dataset.journeyLoops)>0")){looped=true;break}
    }
    const frames=await page.evaluate('scrollAudit.active=false;scrollAudit.frames')
    assert(looped,'Continuous input must finish the return and cross the loop boundary')
    for(const stage of ['transition','crystal','rings','contact','igloo'])assert(frames.some(f=>f.stage===stage),`Visit ${stage} during the lap`)
    assert(frames.every(f=>f.pending==='false'),'Prepared scenes must never pause to load during the lap')
    const stages={}
    for(const stage of new Set(frames.map(f=>f.stage))){
      const times=frames.filter(f=>f.stage===stage).map(f=>f.ms).sort((a,b)=>a-b)
      stages[stage]={frames:times.length,median:times[Math.floor(times.length*.5)],p95:times[Math.floor(times.length*.95)],over50:times.filter(t=>t>50).length}
    }
    assert.deepEqual(page.errors,[],'No runtime errors during the complete lap')
    reports.push({mobile,cpu,stages})
    console.log('PASS complete scroll loop',JSON.stringify(reports.at(-1)))
  }finally{await page.close()}
}
await writeFile('.preview/smoothness-verification.json',JSON.stringify(reports,null,2))
