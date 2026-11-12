// Bake the unchanged HDR environment once instead of filtering it during scroll.
// Run: node scripts/bake-crystal-environment.mjs
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { readFile, writeFile } from 'node:fs/promises'
import { gzipSync } from 'node:zlib'
import path from 'node:path'
import { browser, wait } from '../tests/browser-session.mjs'

const root=path.resolve('node_modules/three')
let result
const server=createServer(async(request,response)=>{
  try {
    const url=new URL(request.url,'http://localhost')
    if(url.pathname==='/favicon.ico'){response.writeHead(204);response.end();return}
    if(request.method==='POST'&&url.pathname==='/bake'){
      const chunks=[]
      for await(const chunk of request)chunks.push(chunk)
      const pixels=Buffer.concat(chunks),width=Number(request.headers['x-width']),height=Number(request.headers['x-height'])
      assert(width>0&&height>0&&pixels.length===width*height*8)
      const header=Buffer.alloc(12)
      header.write('PMR1');header.writeUInt32LE(width,4);header.writeUInt32LE(height,8)
      const packed=gzipSync(Buffer.concat([header,pixels]),{level:9})
      await writeFile('public/scene/textures/crystal_environment.bin.gz',packed)
      result={width,height,bytes:packed.length}
      response.end('ok');return
    }
    if(url.pathname==='/'){
      response.setHeader('Content-Type','text/html')
      response.end(`<!doctype html><script type="importmap">{"imports":{"three":"/build/three.module.js"}}</script>
        <script type="module">
          import * as THREE from 'three';
          import {EXRLoader} from '/examples/jsm/loaders/EXRLoader.js';
          const renderer=new THREE.WebGLRenderer({antialias:false});
          const source=await new EXRLoader().loadAsync('/environment.exr');
          const generator=new THREE.PMREMGenerator(renderer),target=generator.fromEquirectangular(source);
          const data=new Uint16Array(target.width*target.height*4);
          await renderer.readRenderTargetPixelsAsync(target,0,0,target.width,target.height,data);
          if(!data.some(value=>value>0))throw Error('Empty environment capture');
          await fetch('/bake',{method:'POST',headers:{'x-width':String(target.width),'x-height':String(target.height)},body:data});
          source.dispose();target.dispose();generator.dispose();renderer.dispose();
        </script>`)
      return
    }
    const file=url.pathname==='/environment.exr'?path.resolve('public/scene/textures/crystal_env.exr'):path.resolve(root,'.'+url.pathname)
    assert(file.startsWith(root+path.sep)||file===path.resolve('public/scene/textures/crystal_env.exr'))
    response.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':'application/octet-stream')
    response.end(await readFile(file))
  }catch(error){console.error(error);response.writeHead(500);response.end('Bake failed')}
})
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve))
let page
try {
  page=await browser()
  await page.send('Page.navigate',{url:`http://127.0.0.1:${server.address().port}`})
  for(let i=0;i<200&&!result;i++)await wait(200)
  assert.deepEqual(page.errors,[])
  assert(result,'GPU environment bake timed out')
  console.log('Baked the original HDR environment:',result)
}finally{await page?.close();server.close()}
