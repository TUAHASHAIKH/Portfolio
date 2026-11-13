import assert from 'node:assert/strict'
import { writeFile } from 'node:fs/promises'
import { browser, wait } from './browser-session.mjs'

const page = await browser()
try {
  await page.send('Network.enable')
  await page.send('Network.clearBrowserCache')
  await page.send('Network.setCacheDisabled', { cacheDisabled: false })
  if (process.env.AUDIT_SLOW === '1') {
    await page.send('Network.emulateNetworkConditions', { offline: false, latency: 80, downloadThroughput: 625000, uploadThroughput: 125000 })
  }
  await page.send('Page.addScriptToEvaluateOnNewDocument', { source: `
    window.loaderAudit={ready:0};
    const observer=new MutationObserver(()=>{
      if(document.querySelector('#loader')?.dataset.ready==='true'){
        loaderAudit.ready=performance.now();observer.disconnect();
      }
    });observer.observe(document,{subtree:true,attributes:true,childList:true});
  ` })
  const url = process.env.PORTFOLIO_URL || 'http://localhost:3000'
  const reports = []
  for (const visit of ['cold', 'warm']) {
    const previousOrigin = await page.evaluate('performance.timeOrigin')
    await page.send('Page.navigate', { url })
    for (let i=0;i<160;i++) {
      if (await page.evaluate(`performance.timeOrigin!==${previousOrigin} && window.loaderAudit?.ready`)) break
      await wait(250)
    }
    assert.notEqual(await page.evaluate('performance.timeOrigin'), previousOrigin, 'Navigation replaces the previous document')
    const report = await page.evaluate(`({
      ready:loaderAudit.ready,
      hinted:[...document.querySelectorAll('link[rel=preload][as=fetch]')].map(link=>link.href),
      resources:performance.getEntriesByType('resource').filter(e=>e.name.includes('/scene/')).map(e=>({url:e.name,start:e.startTime,end:e.responseEnd,initiator:e.initiatorType,bytes:e.transferSize}))
    })`)
    assert(report.ready > 0, 'Loader completes without a fixed timeout or a missing asset')
    assert.equal(report.hinted.length, 11, 'Only hero dependencies receive early fetch hints')
    for (const url of report.hinted) {
      const requests=report.resources.filter(resource=>resource.url===url)
      assert.equal(requests.length, 1, `Preloaded response is reused without a second download: ${url}`)
      assert.equal(requests[0].initiator, 'link', 'The HTML starts hero downloads before scene initialization')
    }
    const ground=report.resources.find(resource=>resource.url.endsWith('/ground.drc'))
    assert(ground, 'The rest of the full-resolution landscape loads normally')
    assert(report.resources.find(resource=>resource.url.endsWith('/basis_transcoder.wasm')).start < ground.start, 'Decoder downloads start before the WebGL loader')
    if(visit==='warm')assert(report.resources.every(resource=>resource.bytes===0), 'Return visits reuse cached landscape and decoder responses')
    reports.push({visit,...report})
  }
  assert.deepEqual(page.errors, [], 'No runtime or shader errors during cold and warm starts')
  await writeFile('.preview/loader-verification.json', JSON.stringify(reports,null,2))
  console.log('PASS early resource discovery, single downloads, full landscape readiness and cached return visit', reports.map(({visit,ready})=>({visit,readyMs:Math.round(ready)})))
} finally { await page.close() }
