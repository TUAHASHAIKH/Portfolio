import assert from 'node:assert/strict'
import {browser,wait} from './browser-session.mjs'

const b=await browser()
try {
  // Observe actual GPU draw modes and uniforms, without adding production
  // debug controls or depending on React/Fiber's private object structure.
  await b.send('Page.addScriptToEvaluateOnNewDocument',{source:`
    window.landingAudit={lineModes:[],ice:[],ground:[]};
    const programs=new WeakMap();
    for(const method of ['drawArrays','drawElements']){
      const original=WebGL2RenderingContext.prototype[method];
      WebGL2RenderingContext.prototype[method]=function(mode,...args){
        const program=this.getParameter(this.CURRENT_PROGRAM);
        if(program){
          let info=programs.get(program);
          if(!info){
            const source=this.getAttachedShaders(program).map(s=>this.getShaderSource(s)).join('\\n');
            const type=source.includes('uniform float materialize;')?'ice'
              :source.includes('uniform float fillReveal;')&&source.includes('#define GROUND_GLOW 1')?'ground'
              :source.includes('varying vec3 point;')&&!source.includes('gl_PointSize')?'line':'';
            info={type,last:-Infinity,locations:{}};
            const names=type==='ice'?['materialize']:type==='ground'?['reveal','fillReveal','introAlpha']:[];
            for(const name of names)info.locations[name]=this.getUniformLocation(program,name);
            programs.set(program,info);
          }
          if(info.type==='line'&&!landingAudit.lineModes.includes(mode))landingAudit.lineModes.push(mode);
          const now=performance.now();
          if((info.type==='ice'||info.type==='ground')&&now-info.last>60){
            info.last=now;
            landingAudit[info.type].push(Object.fromEntries(Object.entries(info.locations).map(([name,location])=>[name,this.getUniform(program,location)])));
          }
        }
        return original.call(this,mode,...args);
      };
    }
  `})
  const url=process.env.PORTFOLIO_URL||'http://localhost:3000'
  await b.send('Page.navigate',{url})
  for(let i=0;i<180;i++){
    await wait(200)
    if(await b.evaluate('landingAudit.ground.at(-1)?.fillReveal===1 && document.querySelector("#app")?.dataset.introduced==="true"'))break
  }
  const audit=await b.evaluate('landingAudit')
  assert.deepEqual(audit.lineModes,[1],'The intro cage and outline must draw GL_LINES, never triangles')
  assert(audit.ice.some(x=>x.materialize>0&&x.materialize<1),'The visible ice reveal was skipped')
  assert.equal(audit.ice.at(-1)?.materialize,1,'Ice did not finish materializing')
  assert(audit.ground.some(x=>x.introAlpha===0),'The ground was already visible at the start')
  assert(audit.ground.some(x=>x.introAlpha===1&&x.fillReveal>0&&x.fillReveal<1),'The terrain wave was skipped')
  assert(audit.ground.some(x=>Math.abs(x.reveal-x.fillReveal)>.01),'Leading scan and terrain fill must use independent curves')
  assert.equal(audit.ground.at(-1)?.fillReveal,1,'Terrain never finished')
  await b.capture('landing-verified-desktop')
  console.log('PASS line geometry, top-down ice reveal, delayed terrain, independent scan/fill and completion')

  await b.send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true})
  await b.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]})
  await b.send('Page.navigate',{url})
  for(let i=0;i<100;i++){
    await wait(200)
    if(await b.evaluate('document.querySelector("#app")?.dataset.crystalReady==="true" && document.querySelector("#app")?.dataset.introduced==="true"'))break
  }
  await wait(1000)
  const reduced=await b.evaluate('landingAudit')
  assert(reduced.ice.length&&reduced.ice.every(x=>x.materialize===1),'Reduced motion must show complete ice immediately')
  assert(reduced.ground.length&&reduced.ground.every(x=>x.fillReveal===1&&x.introAlpha===1),'Reduced motion must show complete terrain immediately')
  assert.deepEqual(reduced.lineModes,[],'Reduced motion must not mount the intro cage')
  const still=await b.send('Page.captureScreenshot',{format:'png'})
  await wait(300)
  const later=await b.send('Page.captureScreenshot',{format:'png'})
  assert.equal(still.data,later.data,'Reduced-motion landscape must remain still')
  await b.capture('landing-verified-mobile-reduced')
  assert.equal(b.errors.length,0,JSON.stringify(b.errors))
  console.log('PASS mobile reduced-motion immediate reveal, stillness, and no runtime/shader errors')
} finally {await b.close()}
