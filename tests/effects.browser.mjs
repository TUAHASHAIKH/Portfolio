import assert from 'node:assert/strict'
import {browser,wait} from './browser-session.mjs'
const b=await browser()
try{
 await b.send('Page.addScriptToEvaluateOnNewDocument',{source:`
 window.audioAudit={contexts:[],buffers:[],sources:[],gains:[],requests:[]};
 const Original=window.AudioContext;
 window.AudioContext=class extends Original{
  constructor(...args){super(...args);window.audioAudit.contexts.push(this)}
  decodeAudioData(...args){return super.decodeAudioData(...args).then(buffer=>{window.audioAudit.buffers.push({duration:buffer.duration,channels:buffer.numberOfChannels});return buffer})}
  createBufferSource(){const source=super.createBufferSource();const start=source.start.bind(source);source.start=(...args)=>{window.audioAudit.sources.push(source);return start(...args)};return source}
  createGain(){const gain=super.createGain();window.audioAudit.gains.push(gain);return gain}
 };
 const originalFetch=window.fetch;window.fetch=(...args)=>{if(String(args[0]).includes('/audio/'))window.audioAudit.requests.push(String(args[0]));return originalFetch(...args)};
 `})
 await b.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]})
 await b.send('Page.navigate',{url:process.env.PORTFOLIO_URL||'http://localhost:3000'})
 for(let i=0;i<80;i++){await wait(250);if(await b.evaluate('document.querySelector("#app")?.dataset.crystalReady')==='true')break}
 assert.equal(await b.evaluate('document.querySelector("#app")?.dataset.crystalReady'),'true','The portfolio server and WebGL scene must be ready before testing effects')
 assert.equal(await b.evaluate('audioAudit.contexts.length'),0)
 assert.equal(await b.evaluate('audioAudit.requests.length'),0)
 // CDP click carries real user activation for AudioContext.resume().
 const point=await b.evaluate('(()=>{const r=document.querySelector(".sound-toggle").getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()')
 await b.send('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...point})
 await b.send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...point})
 for(let i=0;i<120;i++){await wait(200);if(await b.evaluate('document.querySelector(".sound-toggle")?.getAttribute("aria-busy")')==='false')break}
 console.log('AUDIO',await b.evaluate('({contexts:audioAudit.contexts.length,state:audioAudit.contexts[0]?.state,decoded:audioAudit.buffers.length,requests:audioAudit.requests.length,loops:audioAudit.sources.filter(s=>s.loop).length,pressed:document.querySelector(".sound-toggle").getAttribute("aria-pressed")})'))
 assert.equal(await b.evaluate('audioAudit.buffers.length'),18,'Every reference sound must decode')
 assert.equal(await b.evaluate('audioAudit.contexts.length'),1)
 assert.equal(await b.evaluate('audioAudit.sources.filter(s=>s.loop).length'),7)
 const audible=await b.evaluate(`new Promise(resolve=>{const context=audioAudit.contexts[0],analyser=context.createAnalyser();analyser.fftSize=256;audioAudit.gains[0].connect(analyser);setTimeout(()=>{const samples=new Float32Array(256);analyser.getFloatTimeDomainData(samples);analyser.disconnect();audioAudit.gains[0].disconnect(analyser);resolve(Math.max(...samples.map(Math.abs)))},200)})`)
 assert(audible>.0001,'Decoded loops must produce an audible signal at the master gain')
 const before=await b.evaluate('audioAudit.sources.length')
 await b.evaluate('document.querySelector(".wordmark-trigger").click()');await wait(200)
 assert((await b.evaluate('audioAudit.sources.length'))>before)
 await b.evaluate('window.dispatchEvent(new CustomEvent("portfolio:open-skills"))');await wait(1000)
 console.log('DETAIL_CUES',await b.evaluate('audioAudit.sources.length'))
 await b.evaluate('document.querySelector("dialog[open] .detail-sound").click()');await wait(200)
 assert.equal(await b.evaluate('document.querySelector(".sound-toggle").getAttribute("aria-pressed")'),'false')
 const muted=await b.evaluate('audioAudit.sources.length')
 await b.evaluate('document.querySelector("dialog[open] .detail-close").click();document.querySelector(".wordmark-trigger").click()');await wait(1000)
 assert.equal(await b.evaluate('audioAudit.sources.length'),muted,'Muted interactions must not queue playback')
 await b.evaluate('document.querySelector(".sound-toggle").click()');await wait(200)
 assert.equal(await b.evaluate('audioAudit.sources.filter(s=>s.loop).length'),7,'Unmuting must reuse the loop sources')
 await b.evaluate('Object.defineProperty(document,"hidden",{configurable:true,get:()=>true});document.dispatchEvent(new Event("visibilitychange"))');await wait(150)
 assert.equal(await b.evaluate('audioAudit.contexts[0].state'),'suspended')
 await b.evaluate('Object.defineProperty(document,"hidden",{configurable:true,get:()=>false});document.dispatchEvent(new Event("visibilitychange"))');await wait(150)
 assert.equal(await b.evaluate('audioAudit.contexts[0].state'),'running')
 // UI glitches must preserve text, layout, and reduced-motion preferences.
 await b.evaluate('window.scrollTo(0,(document.documentElement.scrollHeight-innerHeight)*.1)');await wait(250)
 await b.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'no-preference'}]});await wait(100)
 const text=await b.evaluate('document.querySelector("[data-crystal=skills] .crystal-explore").textContent')
 await b.evaluate('document.querySelector("[data-crystal=skills] .crystal-explore").dispatchEvent(new PointerEvent("pointerover",{bubbles:true,pointerType:"mouse"}))')
 assert((await b.evaluate('document.querySelector("[data-crystal=skills] .crystal-explore").getAnimations().length'))>0)
 await b.capture('effects-crystal-glitch')
 await wait(350)
 assert.equal(await b.evaluate('document.querySelector("[data-crystal=skills] .crystal-explore").getAnimations().length'),0)
 assert.equal(await b.evaluate('document.querySelector("[data-crystal=skills] .crystal-explore").textContent'),text)
 await b.evaluate('window.dispatchEvent(new CustomEvent("portfolio:open-skills"))');await wait(400)
 await b.capture('effects-detail-glitch')
 await b.evaluate('document.querySelector("dialog[open] .detail-close").click()');await wait(1100)
 await b.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});await wait(300)
 await b.evaluate('document.querySelector("[data-crystal=skills] .crystal-explore").dispatchEvent(new PointerEvent("pointerover",{bubbles:true,pointerType:"mouse"}))')
 assert.equal(await b.evaluate('document.querySelector("[data-crystal=skills] .crystal-explore").getAnimations().length'),0,'Reduced motion must skip glitch animations')
 const stillA=await b.send('Page.captureScreenshot',{format:'png'});await wait(250)
 const stillB=await b.send('Page.captureScreenshot',{format:'png'})
 assert.equal(stillA.data,stillB.data,'Reduced motion freezes the scene while audio remains enabled')
 assert.deepEqual(b.errors,[])
 console.log('PASS opt-in loading, 18 decodes, audible output, seven loops, UI cues, mute, reuse, tab suspension, glitches, and reduced motion')
}finally{await b.close()}
