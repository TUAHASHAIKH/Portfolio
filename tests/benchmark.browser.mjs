// Run against a production server; AUDIT_MOBILE=1 uses 390x844 at DPR 3,
// AUDIT_SLOW=1 uses 5 Mbps / 80 ms latency, with the HTTP cache disabled.
import { browser, wait } from './browser-session.mjs'
import { writeFile } from 'node:fs/promises'
const page = await browser()
const label = (process.env.AUDIT_LABEL || 'current').replace(/[^a-zA-Z0-9_-]/g, '-')
const mobile = process.env.AUDIT_MOBILE === '1'
try {
  await page.send('Network.enable')
  await page.send('Network.setCacheDisabled', {cacheDisabled:true})
  if (mobile) await page.send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:3,mobile:true})
  if (process.env.AUDIT_SLOW) await page.send('Network.emulateNetworkConditions',{offline:false,latency:80,downloadThroughput:625000,uploadThroughput:125000})
  await page.send('Page.addScriptToEvaluateOnNewDocument', {source:`
    localStorage.setItem('portfolio-theme','light');
    window.audit={frames:[],tasks:[],draws:0,counts:[],ready:0,resourcesAtReady:[]};
    new PerformanceObserver(list=>audit.tasks.push(...list.getEntries().map(e=>({start:e.startTime,duration:e.duration})))).observe({type:'longtask',buffered:true});
    for(const key of ['drawElements','drawArrays','drawElementsInstanced','drawArraysInstanced']){
      const old=WebGL2RenderingContext.prototype[key];
      WebGL2RenderingContext.prototype[key]=function(...args){audit.draws++;return old.apply(this,args)};
    }
    let last=0;
    function frame(t){if(last)audit.frames.push(t-last);last=t;audit.counts.push(audit.draws);audit.draws=0;
      if(!audit.ready&&document.querySelector('#loader')?.dataset.ready==='true'){audit.ready=performance.now();audit.resourcesAtReady=performance.getEntriesByType('resource').map(e=>({name:e.name,size:e.encodedBodySize}));}
      requestAnimationFrame(frame)}requestAnimationFrame(frame);
  `})
  await page.send('Page.navigate',{url:process.env.PORTFOLIO_URL||'http://localhost:3000'})
  for(let i=0;i<240;i++){if(await page.evaluate("document.querySelector('#app')?.dataset.ringsReady==='true' && document.querySelector('#app')?.dataset.introduced==='true'"))break;await wait(500)}
  await wait(1500)
  const report = await page.evaluate(`({ready:audit.ready,resourcesAtReady:audit.resourcesAtReady,tasks:audit.tasks,resources:performance.getEntriesByType('resource').map(e=>({name:e.name,bytes:e.encodedBodySize,duration:e.duration})),heap:performance.memory?.usedJSHeapSize,renderer:(()=>{const gl=document.querySelector('canvas').getContext('webgl2');return gl.getParameter(gl.getExtension('WEBGL_debug_renderer_info').UNMASKED_RENDERER_WEBGL)})()})`)
  report.stages={}
  for(const theme of ['light','dark']){
    await page.evaluate(`document.documentElement.dataset.theme='${theme}';window.dispatchEvent(new Event('portfolio:theme'))`)
    await wait(2200)
    for(const [stage,position] of [['hero',0],['crystal',.1],['rings',.4],['contact',.78]]){
      await page.evaluate(`window.scrollTo(0,(document.documentElement.scrollHeight-innerHeight)*${position})`)
      // A jump from the end back to the hero follows the normal damped path.
      // Wait for that long return rather than measuring it as an idle hero.
      await wait(stage==='hero'&&theme==='dark'?9000:2500)
      await page.evaluate('audit.frames=[];audit.counts=[]')
      await wait(2500)
      report.stages[theme+'-'+stage]=await page.evaluate(`(()=>{const a=audit.frames.toSorted((a,b)=>a-b);return {median:a[Math.floor(a.length*.5)],p95:a[Math.floor(a.length*.95)],frames:a.length,draws:audit.counts.reduce((a,b)=>a+b,0)/audit.counts.length,stage:document.querySelector('#app').dataset.stage}})()`)
      if(!mobile)await page.capture(label+'-'+theme+'-'+stage)
    }
  }
  report.errors=page.errors
  await writeFile('.preview/perf-'+label+(mobile?'-mobile':'')+'.json',JSON.stringify(report,null,2))
  console.log(JSON.stringify({ready:report.ready,bytesAtReady:report.resourcesAtReady.reduce((a,b)=>a+b.size,0),totalBytes:report.resources.reduce((a,b)=>a+b.bytes,0),heap:report.heap,renderer:report.renderer,stages:report.stages,errors:report.errors},null,2))
}finally{await page.close()}
