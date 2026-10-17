import * as THREE from 'three'
import type { PolarAssets } from './assets'

export const surfaceVertex = `
  varying vec2 surfaceUv;
  varying vec3 localPoint;
  varying vec3 worldPoint;
  varying float viewDepth;
  void main() {
    surfaceUv = uv;
    localPoint = position;
    worldPoint = (modelMatrix * vec4(position, 1.)).xyz;
    vec4 viewPoint = modelViewMatrix * vec4(position, 1.);
    viewDepth = -viewPoint.z;
    gl_Position = projectionMatrix * viewPoint;
  }
`

export function makeTerrainMaterial(map: THREE.Texture, options: { mountain?: boolean; patch?: boolean; glow?: THREE.Texture } = {}) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: true,
    uniforms: { surface: { value: map }, glow: { value: options.glow || map }, groundLight: { value: 0 }, cursor: { value: new THREE.Vector3(0, -10, 0) }, resolution: { value: new THREE.Vector2(1440, 900) } },
    defines: { MOUNTAIN: options.mountain ? 1 : 0, PATCH: options.patch ? 1 : 0, GROUND_GLOW: options.glow ? 1 : 0 },
    vertexShader: surfaceVertex,
    fragmentShader: `
      uniform sampler2D surface;
      uniform sampler2D glow;
      uniform float groundLight;
      uniform vec3 cursor;
      uniform vec2 resolution;
      varying vec2 surfaceUv;
      varying vec3 localPoint;
      varying vec3 worldPoint;
      varying float viewDepth;
      void main() {
        vec3 color = texture2D(surface, surfaceUv).rgb;
        float radius = length(localPoint.xz);
        float alpha = 1. - smoothstep(.85, 1., radius * .1085);
        #if PATCH == 1
          alpha = 1. - smoothstep(.3, .48, radius);
        #endif
        #if MOUNTAIN == 1
          vec2 screenPoint = gl_FragCoord.xy / resolution;
          float gradient = pow((screenPoint.x + screenPoint.y) * .5, 2.);
          vec3 haze = mix(vec3(.4287,.4678,.5711), vec3(.6376,.6724,.7682), gradient);
          float fog = clamp(.5 - worldPoint.y * .05, 0., 1.) + clamp(viewDepth * .005, 0., 1.) * .75;
          color = mix(color, haze * 1.1 + smoothstep(.5, 1., color.r), clamp(fog, 0., 1.));
          alpha = 1. - smoothstep(.7, .9, radius * .1085);
        #endif
        #if GROUND_GLOW == 1
          alpha = 1. - smoothstep(.8, 1., radius * .1085);
          float nearCursor = 1. - smoothstep(0., 5., distance(cursor.xz, worldPoint.xz));
          color += texture2D(glow, surfaceUv).rgb * color.r * (.25 + groundLight * .7);
          color += nearCursor * groundLight * vec3(.12,.17,.22) * color.r;
        #endif
        gl_FragColor = vec4(color, alpha);
      }
    `,
  })
}

export function makeIceMaterial(assets: PolarAssets) {
  return new THREE.ShaderMaterial({
    uniforms: { closed: { value: assets.closed }, opened: { value: assets.opened }, separation: { value: 0 }, center: { value: new THREE.Vector3() } },
    vertexShader: `
      attribute float emission;
      varying vec2 surfaceUv;
      varying float iceLight;
      varying vec3 localPoint;
      void main() {
        surfaceUv = uv;
        iceLight = emission;
        localPoint = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.);
      }
    `,
    fragmentShader: `
      uniform sampler2D closed;
      uniform sampler2D opened;
      uniform float separation;
      uniform vec3 center;
      varying vec2 surfaceUv;
      varying float iceLight;
      varying vec3 localPoint;
      void main() {
        vec3 a = texture2D(closed, surfaceUv).rgb;
        vec3 b = texture2D(opened, surfaceUv).rgb + .05;
        vec3 color = mix(a, b, clamp(separation * 5., 0., 1.));
        vec3 point = localPoint + center;
        float frost = pow(iceLight, 2.);
        color += frost * separation * vec3(.5,.7,1.);
        color += pow(iceLight, 8.) * vec3(.5,.7,1.) * .13;
        color += (point.x * .1 + .4) * .15 * min(point.y + .5, 1.);
        gl_FragColor = vec4(clamp(color, 0., 1.), 1.);
      }
    `,
  })
}
