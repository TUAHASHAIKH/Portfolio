'use client'

import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
import * as THREE from 'three'

export function Wind() {
  const resources = useMemo(() => {
    const count = 1200, geometry = new THREE.BufferGeometry()
    const positions = new Float32Array(count * 3), seeds = new Float32Array(count)
    // Reproducible distribution; motion is calculated entirely on the GPU.
    const random = (index: number) => THREE.MathUtils.euclideanModulo(Math.sin(index * 127.1 + 19.7) * 43758.5453, 1)
    for (let index = 0; index < count; index++) {
      positions[index * 3] = random(index * 4) * 50 - 25
      positions[index * 3 + 1] = random(index * 4 + 1) * 20 - 10
      positions[index * 3 + 2] = random(index * 4 + 2) * 50 - 25
      seeds[index] = random(index * 4 + 3)
    }
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geometry.setAttribute('seed', new THREE.BufferAttribute(seeds, 1))
    const material = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      uniforms: { time: { value: 0 }, pixelRatio: { value: 1 } },
      vertexShader: `
        uniform float time;
        uniform float pixelRatio;
        attribute float seed;
        varying float opacity;
        void main(){
          float speed=mix(.85,1.35,seed);
          // Positive world X and Z both project toward screen-right from this camera.
          vec3 travel=vec3(1.4,-.27,1.4)*time*speed;
          vec3 p=mod(position+travel+vec3(25.,10.,25.),vec3(50.,20.,50.))-vec3(25.,10.,25.);
          p.y+=sin(time*.45+seed*40.)*.08;
          vec4 viewPoint=modelViewMatrix*vec4(p,1.);
          float bounds=(1.-abs(p.x)/25.)*(1.-abs(p.z)/25.);
          float ground=smoothstep(0.,2.,p.y);
          float shelter=smoothstep(3.,6.,length(p));
          float pulse=.6+.4*sin(time*.7+seed*30.);
          opacity=bounds*ground*shelter*pulse*.5;
          opacity*=smoothstep(.5,2.,-viewPoint.z)*(1.-smoothstep(30.,55.,-viewPoint.z));
          gl_Position=projectionMatrix*viewPoint;
          gl_PointSize=clamp((2.+seed*2.)*pixelRatio*18./max(8.,-viewPoint.z),1.,5.*pixelRatio);
        }
      `,
      fragmentShader: `
        varying float opacity;
        void main(){
          vec2 shape=(gl_PointCoord-.5)*vec2(1.2,2.7);
          float alpha=(1.-smoothstep(.12,.5,length(shape)))*opacity;
          gl_FragColor=vec4(vec3(.92,.94,.98),alpha);
        }
      `,
    })
    return { geometry, material }
  }, [])
  useEffect(() => () => { resources.geometry.dispose(); resources.material.dispose() }, [resources])
  useFrame(({ gl }, delta) => {
    resources.material.uniforms.time.value += Math.min(delta, .25)
    resources.material.uniforms.pixelRatio.value = gl.getPixelRatio()
  })
  return <points name="directional-wind" geometry={resources.geometry} material={resources.material} frustumCulled={false} renderOrder={5} />
}
