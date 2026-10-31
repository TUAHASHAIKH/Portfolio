import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import ts from 'typescript'
import * as THREE from 'three'

const modules = new Map()
async function load(name) {
  if (modules.has(name)) return modules.get(name)
  const source = await readFile(new URL(`../components/polar/${name}.ts`, import.meta.url), 'utf8')
  let code = ts.transpileModule(source, {compilerOptions:{module:ts.ModuleKind.ESNext}}).outputText
  for (const match of [...code.matchAll(/from ['"]([^'"]+)['"]/g)]) {
    const spec = match[1]
    const url = spec.startsWith('./') ? await load(spec.slice(2)) : import.meta.resolve(spec)
    code = code.replace(match[0], `from ${JSON.stringify(url)}`)
  }
  const url = `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`
  modules.set(name,url)
  return url
}
const { makeIceBatch } = await import(await load('ice-batch'))
const { compileForTarget } = await import(await load('shader-preparation'))
const { ParticleSimulation } = await import(await load('particle-simulation'))

test('batched ice retains every vertex, triangle, UV and independent block transform', () => {
  const pieces = [new THREE.BoxGeometry(), new THREE.SphereGeometry(1,8,6)].map((geometry,index) => {
    geometry.setAttribute('emission',new THREE.BufferAttribute(new Float32Array(geometry.getAttribute('position').count).fill(.3+index),1))
    return {geometry,center:new THREE.Vector3(index*4,2,3),seed:new THREE.Vector3()}
  })
  const texture = new THREE.Texture()
  const batch = makeIceBatch({pieces,closed:texture,opened:texture})
  let vertexOffset=0, indexOffset=0
  for (const [id,piece] of pieces.entries()) {
    const matrix = new THREE.Matrix4().compose(piece.center,new THREE.Quaternion().setFromEuler(new THREE.Euler(.2,.3,.5,'YZX')),new THREE.Vector3(1,1,1))
    batch.write(id,matrix,.2+id,.1+id)
    const packed = new THREE.Matrix4().fromArray(batch.texture.image.data,id*20)
    for (const name of ['position','normal','uv','emission']) {
      const original=piece.geometry.getAttribute(name),merged=batch.geometry.getAttribute(name)
      assert.deepEqual(Array.from(merged.array.slice(vertexOffset*original.itemSize,(vertexOffset+original.count)*original.itemSize)),Array.from(original.array))
    }
    for(let i=0;i<piece.geometry.index.count;i++)assert.equal(batch.geometry.index.getX(indexOffset+i),piece.geometry.index.getX(i)+vertexOffset)
    for(let i=0;i<piece.geometry.getAttribute('position').count;i++) {
      assert.equal(batch.geometry.getAttribute('pieceIndex').getX(vertexOffset+i),id)
      const point=new THREE.Vector3().fromBufferAttribute(piece.geometry.getAttribute('position'),i)
      assert(point.clone().applyMatrix4(matrix).distanceTo(point.applyMatrix4(packed))<1e-6)
    }
    assert(Math.abs(batch.texture.image.data[id*20+16]-(.2+id))<1e-6)
    assert(Math.abs(batch.texture.image.data[id*20+17]-(.1+id))<1e-6)
    vertexOffset+=piece.geometry.getAttribute('position').count
    indexOffset+=piece.geometry.index.count
  }
  assert.equal(batch.geometry.getAttribute('position').count,vertexOffset)
  assert.equal(batch.geometry.index.count,indexOffset)
  batch.dispose();pieces.forEach(p=>p.geometry.dispose());texture.dispose()
})

test('shader preparation uses the HDR destination and restores it before awaiting', async () => {
  const screen={name:'previous'},target={name:'HDR'}
  let current=screen,finish
  const renderer={getRenderTarget:()=>current,setRenderTarget:value=>{current=value},compileAsync:()=>{assert.equal(current,target);return new Promise(resolve=>{finish=resolve})}}
  const promise=compileForTarget(renderer,{}, {},target)
  assert.equal(current,screen)
  finish();await promise
  renderer.compileAsync=()=>{throw Error('compile failure')}
  assert.throws(()=>compileForTarget(renderer,{}, {},target),/compile failure/)
  assert.equal(current,screen)
})

test('all 150,000 contact grains fit compact buffers with unique texel centers', () => {
  const geometry=new THREE.BufferGeometry(),count=150000
  for(const name of ['position','socialPosition1','socialPosition2','socialPosition3'])geometry.setAttribute(name,new THREE.BufferAttribute(new Float32Array(count*3),3))
  const volume=new THREE.Texture()
  const simulation=new ParticleSimulation(geometry,[volume])
  assert.equal(simulation.position.image.width,256)
  assert.equal(simulation.position.image.height,586)
  const uv=geometry.getAttribute('particleUv'),seen=new Set()
  assert.equal(uv.count,count)
  for(let i=0;i<count;i++) {
    const x=Math.floor(uv.getX(i)*256),y=Math.floor(uv.getY(i)*586)
    assert(x>=0&&x<256&&y>=0&&y<586)
    seen.add(y*256+x)
  }
  assert.equal(seen.size,count)
  simulation.dispose();volume.dispose();geometry.dispose()
})
