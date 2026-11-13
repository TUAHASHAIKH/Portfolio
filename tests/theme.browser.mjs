import assert from 'node:assert/strict'
import { browser, wait } from './browser-session.mjs'
const b=await browser()
const detailWidths=[]
const media=async(theme,motion='reduce')=>b.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-color-scheme',value:theme},{name:'prefers-reduced-motion',value:motion}]})
const ready=async()=>{for(let i=0;i<240;i++){if(await b.evaluate('document.querySelector("#app")?.dataset.ringsReady')==='true')return;await wait(250)}throw Error('Scene did not become ready')}
const reload=async()=>{
 const previous=await b.evaluate('performance.timeOrigin')
 await b.send('Page.reload')
 let replaced=false
 for(let i=0;i<120;i++){
  try{if(await b.evaluate('performance.timeOrigin')!==previous){replaced=true;break}}catch{}
  await wait(100)
 }
 assert(replaced,'Reload replaces the previous document before checking preferences')
 await ready()
}
const travel=async p=>{await b.evaluate(`scrollTo(0,(document.documentElement.scrollHeight-innerHeight)*${p})`);await wait(900)}
const auditProjects=async()=>{
 assert.equal(await b.evaluate('document.querySelectorAll("dialog[open] .detail-project").length'),12,'All twelve projects appear inline')
 assert.equal(await b.evaluate('document.querySelector("dialog[open] .detail-project h3").textContent.replace("↗", "")'),'Pulse','Pulse is first')
 assert.equal(await b.evaluate('document.querySelectorAll(".detail-gallery-back,.detail-gallery-toggle").length'),0,'No separate gallery remains')
 for(let index=0;index<12;index++){
  await b.evaluate(`document.querySelectorAll('dialog[open] .detail-project')[${index}].scrollIntoView()`)
  await wait(100)
  await b.evaluate(`(async()=>{const image=document.querySelectorAll('dialog[open] .detail-project img')[${index}];await image.decode()})()`)
  assert(await b.evaluate(`(()=>{const image=document.querySelectorAll('dialog[open] .detail-project img')[${index}];const style=getComputedStyle(image);return image.complete&&image.naturalWidth>0&&style.objectFit==='contain'&&style.objectPosition==='50% 50%'&&style.transform==='none'})()`),'Every cover loads centered without cropping or zoom')
 }
 assert(await b.evaluate('document.querySelector("dialog[open]").scrollWidth<=innerWidth'),'Project content fits the viewport')
 await b.evaluate('document.querySelector("dialog[open]").scrollTop=0')
 await wait(100)
}
try{
 await media('dark')
 await b.send('Page.navigate',{url:process.env.PORTFOLIO_URL||'http://localhost:3000'});await ready()
 await b.evaluate('localStorage.removeItem("portfolio-theme")');await reload();await wait(1000)
 assert.equal(await b.evaluate('document.documentElement.dataset.theme'),'light','A fresh device starts in light mode even when its system prefers dark')
 await media('light');await media('dark');await wait(150)
 assert.equal(await b.evaluate('document.documentElement.dataset.theme'),'light','System changes do not override the light-first default')
 await b.capture('theme-first-visit-light')
 await b.evaluate('document.querySelector(".theme-toggle").click()')
 assert.equal(await b.evaluate('localStorage.getItem("portfolio-theme")'),'dark')
 await reload();await wait(500)
 assert.equal(await b.evaluate('document.documentElement.dataset.theme'),'dark','A saved dark preference is restored on the next visit')
 await b.capture('theme-dark-hero')
 for(const [name,p] of [['skills',.1],['projects',.2],['about',.3],['rings',.4],['contact',.78]]){
  await travel(p);await b.capture('theme-dark-'+name)
  if(['skills','projects','about'].includes(name)){
   await b.evaluate(`window.dispatchEvent(new Event('portfolio:open-${name}'))`);await wait(600)
   assert.equal(await b.evaluate('document.querySelectorAll("dialog[open]").length'),1)
   detailWidths.push(await b.evaluate('document.querySelector("dialog[open] .detail-content").getBoundingClientRect().width'))
   if(name==='projects')await auditProjects()
   await b.capture('theme-dark-'+name+'-detail')
   await b.evaluate('document.querySelector("dialog[open] .detail-close").click()')
  }
 }
 assert(detailWidths.every(width=>Math.abs(width-detailWidths[0])<1),'Skills, Projects, and About use the same content width')
 const stillA=await b.send('Page.captureScreenshot',{format:'png'});await wait(300)
 const stillB=await b.send('Page.captureScreenshot',{format:'png'})
 assert(stillA.data===stillB.data,'Reduced motion stays static')
 const scroll=await b.evaluate('scrollY')
 await b.evaluate('document.querySelector(".theme-toggle").click()');await wait(500)
 assert.equal(await b.evaluate('document.documentElement.dataset.theme'),'light')
 assert.equal(await b.evaluate('scrollY'),scroll,'Switching preserves the journey')
 for(const [name,p] of [['hero',0],['skills',.1],['rings',.4],['contact',.78]]){await travel(p);await b.capture('theme-light-'+name)}
 await b.evaluate("window.dispatchEvent(new Event('portfolio:open-projects'))");await wait(500)
 await auditProjects();await b.capture('theme-light-projects-detail')
 await b.evaluate('document.querySelector("dialog[open] .detail-close").click()')
 await reload()
 assert.equal(await b.evaluate('document.documentElement.dataset.theme'),'light','Manual choice persists over system dark')
 await b.evaluate('document.querySelector(".theme-toggle").click()')
 await media('light')
 assert.equal(await b.evaluate('document.documentElement.dataset.theme'),'dark','Manual choice wins over system changes')
 await b.send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true})
 for(const [name,p] of [['hero',0],['skills',.1],['rings',.4],['contact',.78]]){await travel(p);await b.capture('theme-mobile-'+name)}
 await b.evaluate("window.dispatchEvent(new Event('portfolio:open-projects'))");await wait(500)
 await auditProjects();await b.capture('theme-mobile-projects')
 await b.evaluate('document.querySelector("dialog[open] .detail-close").click()')
 await media('dark','no-preference');await travel(0);await wait(1500)
 await b.capture('theme-animated-hero')
 assert.deepEqual(b.errors,[],'No browser or WebGL shader errors')
 console.log('PASS twelve centered project covers, Pulse first, inline layout, light-first default, saved theme persistence, both scenes, mobile, reduced motion, and shader compilation')
}finally{await b.close()}
