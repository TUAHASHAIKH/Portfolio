// Run against an already running portfolio: npm run test:scroll-browser.
// Override PORTFOLIO_URL / CHROME_BIN / CHROME_DEBUG_PORT when needed.
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

const wait = ms => new Promise(resolve => setTimeout(resolve, ms))
const url = process.env.PORTFOLIO_URL || 'http://localhost:3000'
const executable = process.env.CHROME_BIN || [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome', '/usr/bin/chromium',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].find(existsSync)
assert(executable, 'Set CHROME_BIN to an installed Chrome or Chromium executable')
assert((await fetch(url)).ok, 'Start the portfolio before running browser checks')
const port = Number(process.env.CHROME_DEBUG_PORT || 9352)
await mkdir('.preview', { recursive: true })
const chrome = spawn(executable, ['--headless=new', '--disable-extensions', '--no-first-run',
  '--no-default-browser-check', `--remote-debugging-port=${port}`,
  `--user-data-dir=${path.resolve('.preview/scroll-test-browser')}`, 'about:blank'],
{ windowsHide: true, stdio: 'ignore' })
let ws
try {
  let tabs
  for (let i = 0; i < 40; i++) {
    try { tabs = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); break } catch { await wait(250) }
  }
  assert(tabs, 'Chrome debugging endpoint did not start')
  ws = new WebSocket(tabs.find(tab => tab.type === 'page').webSocketDebuggerUrl)
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true })
    ws.addEventListener('error', reject, { once: true })
  })
  let id = 0
  const pending = new Map(), errors = []
  ws.addEventListener('message', event => {
    const message = JSON.parse(event.data)
    if (message.id) {
      const task = pending.get(message.id)
      pending.delete(message.id)
      if (message.error) task?.reject(message.error)
      else task?.resolve(message.result)
    } else if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails)
  })
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const key = ++id
    pending.set(key, { resolve, reject })
    ws.send(JSON.stringify({ id: key, method, params }))
  })
  const evaluate = async expression => {
    const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
    assert(!result.exceptionDetails, JSON.stringify(result.exceptionDetails))
    return result.result.value
  }
  const until = async (expression, message) => {
    for (let i = 0; i < 100; i++) { if (await evaluate(expression)) return; await wait(200) }
    assert.fail(message)
  }
  const media = reduced => send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: reduced ? 'reduce' : 'no-preference' }] })
  const viewport = (width, height, mobile = false) => send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile })
  const wheel = deltaY => send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: 900, y: 650, deltaX: 0, deltaY })
  const swipe = async () => {
    await send('Input.dispatchTouchEvent', {type:'touchStart',touchPoints:[{x:200,y:650}]})
    for(let i=1;i<=10;i++){
      await send('Input.dispatchTouchEvent', {type:'touchMove',touchPoints:[{x:200,y:650-i*30}]})
      await wait(30)
    }
    await send('Input.dispatchTouchEvent', {type:'touchEnd',touchPoints:[]})
  }
  const key = async (name, code) => {
    await send('Input.dispatchKeyEvent', { type: 'keyDown', key: name, code: name, windowsVirtualKeyCode: code })
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key: name, code: name, windowsVirtualKeyCode: code })
  }
  const position = () => evaluate('scrollY / (document.documentElement.scrollHeight - innerHeight)')
  const go = async progress => { await evaluate(`window.scrollTo({top:(document.documentElement.scrollHeight-innerHeight)*${progress},behavior:'instant'})`); await wait(250) }
  const open = async kind => { await evaluate(`window.dispatchEvent(new CustomEvent('portfolio:open-${kind}'))`); await wait(350) }
  const close = async () => { await key('Escape', 27); await until('!document.querySelector("dialog[open]")', 'Detail did not close') }
  await send('Page.enable'); await send('Runtime.enable')
  await viewport(1280, 800); await media(true)
  await send('Page.navigate', { url })
  await until('document.querySelector("#app")?.dataset.crystalReady === "true" && document.querySelector("#loader")?.dataset.ready === "true"', 'Scene did not load')

  await go(.1)
  const preciseStart=await evaluate('scrollY')
  await evaluate('for(let i=0;i<20;i++)window.dispatchEvent(new WheelEvent("wheel",{deltaY:.2,cancelable:true}))')
  assert(Math.abs((await evaluate('scrollY'))-preciseStart-4)<1,'Subpixel trackpad input was lost')
  const zoomIgnored=await evaluate('window.dispatchEvent(new WheelEvent("wheel",{deltaY:120,ctrlKey:true,cancelable:true}))')
  assert.equal(zoomIgnored,true,'Pinch-to-zoom must not be intercepted')
  console.log('PASS precision trackpad input and zoom ownership')

  await go(.1); await media(false); await wait(200)
  const start = await evaluate('scrollY')
  await wheel(12000); await wait(100)
  assert((await evaluate('scrollY')) - start <= 721, 'Wheel burst queued multiple sections')
  await wheel(-120); await wait(150)
  assert((await evaluate('scrollY')) < start + 350, 'Reversal did not cancel stale forward intent')
  await wait(800)
  const settled = await evaluate('document.querySelector("#app").style.cssText')
  await wait(200)
  assert.equal(await evaluate('document.querySelector("#app").style.cssText'), settled, 'Scroll did not settle after input stopped')
  console.log('PASS wheel burst, reversal, and settling')

  for (const reduced of [false, true]) {
    await media(true); await go(.995); await media(reduced); await wheel(500)
    await until('scrollY < innerHeight', 'Forward loop stalled')
    await media(true); await go(0); await media(reduced); await wheel(-300)
    await until('scrollY > (document.documentElement.scrollHeight-innerHeight)*.9', 'Reverse loop stalled')
  }
  console.log('PASS both loop directions with and without reduced motion')

  await media(true); await go(.2)
  await evaluate('document.querySelector(".wordmark-trigger").focus({preventScroll:true})')
  const focusPosition = await position()
  await key(' ', 32); await wait(300)
  assert(Math.abs(await position() - focusPosition) < .0001, 'Space on a button scrolled the journey')
  await evaluate('document.activeElement.blur()'); await key('PageDown', 34); await wait(500)
  assert(await position() > focusPosition, 'Page Down no longer works')
  console.log('PASS keyboard scrolling and focused control ownership')

  await go(.2); await open('projects')
  const background = await position()
  await media(false); await wait(100)
  for(let i=0;i<20;i++){
    await evaluate('document.querySelector("dialog[open]").dispatchEvent(new WheelEvent("wheel",{deltaY:.2,cancelable:true}))')
    await wait(20)
  }
  await wait(300)
  assert(Math.abs((await evaluate('document.querySelector("dialog[open]").scrollTop'))-4)<1,'Detail lost precision trackpad input')
  await evaluate('document.querySelector("dialog[open]").scrollTop=0');await wait(100)
  await evaluate(`window.detailSamples=[];window.detailSampling=true;
    function sample(){if(!window.detailSampling)return;window.detailSamples.push(document.querySelector('dialog[open]').scrollTop);requestAnimationFrame(sample)}requestAnimationFrame(sample)`)
  await wheel(400); await wait(800)
  const samples = await evaluate('window.detailSampling=false; window.detailSamples')
  assert(new Set(samples).size > 4, 'Detail wheel scrolling did not ease across frames')
  assert(samples.at(-1) > 0, 'Detail did not scroll')
  assert(samples.every((value, i) => i === 0 || value >= samples[i - 1]), 'Detail wheel scroll oscillated')
  assert(Math.abs(await position() - background) < .0001, 'Detail scrolling moved the background')
  await wheel(-160); await wait(500)
  assert(await evaluate('document.querySelector("dialog[open]").scrollTop') < samples.at(-1), 'Detail cannot reverse')
  await wheel(600)
  await evaluate('document.querySelector("dialog[open]").scrollTop=0'); await wait(500)
  assert.equal(await evaluate('document.querySelector("dialog[open]").scrollTop'), 0, 'Queued wheel work overrode a direct scroll')
  await key('PageDown', 34); await wait(500)
  assert(await evaluate('document.querySelector("dialog[open]").scrollTop') > 0, 'Detail keyboard scroll failed')
  await close()
  console.log('PASS smooth detail wheel, reversal, keyboard takeover, and background isolation')

  await media(true); await go(.2); await viewport(390, 844, true); await wait(500)
  assert(Math.abs(await position() - .2) < .0001, 'Resize changed journey position')
  await open('projects'); await viewport(844, 390, true); await wait(500); await close()
  assert(Math.abs(await position() - .2) < .0001, 'Closing after rotation restored stale pixels')
  assert.equal(await evaluate('document.documentElement.style.overflow'), '')
  await viewport(390, 844, true); await send('Emulation.setTouchEmulationEnabled', { enabled: true })
  await wait(300)
  const beforeTouch = await position()
  await swipe()
  await wait(600)
  assert(await position() > beforeTouch, 'Native touch scrolling failed')
  await open('projects')
  const touchBackground = await position()
  await swipe()
  await wait(500)
  assert(await evaluate('document.querySelector("dialog[open]").scrollTop') > 0, 'Detail touch scrolling failed')
  assert(Math.abs(await position() - touchBackground) < .0001, 'Touch leaked out of the modal')
  assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'), true)
  await close()
  console.log('PASS mobile rotation, native touch, modal touch isolation, reduced motion, and overflow')

  await go(.1);await wait(300)
  const staticA=await send('Page.captureScreenshot',{format:'png'});await wait(250)
  const staticB=await send('Page.captureScreenshot',{format:'png'})
  assert.equal(staticA.data,staticB.data,'Reduced motion scene should remain still')

  await viewport(1280, 800); await media(false); await go(.1); await wait(1000)
  const performanceResult = await evaluate(`new Promise(resolve=>{
    const frames=[];let last=performance.now(),start=last;
    function frame(now){frames.push(now-last);last=now;const progress=Math.min(1,(now-start)/4000);
      window.dispatchEvent(new WheelEvent('wheel',{deltaY:45,cancelable:true}));
      if(progress<1)requestAnimationFrame(frame);else{frames.sort((a,b)=>a-b);resolve({frames:frames.length,median:frames[Math.floor(frames.length*.5)],p95:frames[Math.floor(frames.length*.95)]})}}
    requestAnimationFrame(frame)
  })`)
  console.log('FRAME_TIMING_MS', performanceResult)
  const shot = await send('Page.captureScreenshot', { format: 'png' })
  await writeFile('.preview/scroll-verified.png', Buffer.from(shot.data, 'base64'))
  assert.deepEqual(errors, [], 'Browser runtime errors')
  console.log('PASS no browser runtime errors')
  ws.send(JSON.stringify({ id: ++id, method: 'Browser.close' }))
} finally { ws?.close(); chrome.kill() }
