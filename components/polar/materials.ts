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

export function makeTerrainMaterial(map: THREE.Texture, options: { mountain?: boolean; patch?: boolean; glow?: THREE.Texture; wind?: THREE.Texture } = {}) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: true,
    uniforms: { reveal: { value: 1 }, surface: { value: map }, glow: { value: options.glow || map }, windTexture: { value: options.wind || map }, time: { value: 0 }, groundLight: { value: 0 }, cursor: { value: new THREE.Vector3(0, -10, 0) }, resolution: { value: new THREE.Vector2(1440, 900) } },
    defines: { MOUNTAIN: options.mountain ? 1 : 0, PATCH: options.patch ? 1 : 0, GROUND_GLOW: options.glow ? 1 : 0, GROUND_WIND: options.wind ? 1 : 0 },
    vertexShader: surfaceVertex,
    fragmentShader: `
      uniform float reveal;
      uniform sampler2D surface;
      uniform sampler2D glow;
      uniform sampler2D windTexture;
      uniform float time;
      uniform float groundLight;
      uniform vec3 cursor;
      uniform vec2 resolution;
      varying vec2 surfaceUv;
      varying vec3 localPoint;
      varying vec3 worldPoint;
      varying float viewDepth;
      void main() {
        vec3 color = texture2D(surface, surfaceUv).rgb;
        // Unpainted atlas padding must reveal the snowy underlay, not black polygons.
        float painted = smoothstep(.002, .02, max(color.r, max(color.g, color.b)));
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
        #if GROUND_WIND == 1
          vec2 drift=vec2(-time*.15);
          float snow=texture2D(windTexture,worldPoint.xz*.15+drift).r;
          snow*=texture2D(windTexture,worldPoint.xz*.17+drift+vec2(.3,.7)).r;
          float lowGround=1.-smoothstep(-1.3,.5,worldPoint.y);
          color=mix(color,vec3(.9,.93,.98),clamp(snow*lowGround*.42,0.,.2));
        #endif
        gl_FragColor = vec4(color, alpha * painted * (1. - smoothstep(reveal * 180. - 8., reveal * 180., length(worldPoint.xz))));
      }
    `,
  })
}

export function makeIceMaterial(assets: PolarAssets) {
  return new THREE.ShaderMaterial({
    uniforms: { materialize: { value: 1 }, closed: { value: assets.closed }, opened: { value: assets.opened }, separation: { value: 0 }, center: { value: new THREE.Vector3() } },
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
      uniform float materialize;
      uniform sampler2D closed;
      uniform sampler2D opened;
      uniform float separation;
      uniform vec3 center;
      varying vec2 surfaceUv;
      varying float iceLight;
      varying vec3 localPoint;
      void main() {
        vec3 a = texture2D(closed, surfaceUv).rgb;
        vec3 b = min(texture2D(opened, surfaceUv).rgb + .035, vec3(.92));
        vec3 color = mix(a, b, clamp(separation * 5., 0., 1.));
        vec3 point = localPoint + center;
        if (point.y < (1. - materialize) * 5. - .7) discard;
        float rim = clamp(iceLight, 0., 1.06);
        float frost = rim * rim;
        color += frost * separation * vec3(.5,.7,1.) * .75;
        color += pow(rim, 8.) * vec3(.5,.7,1.) * .09;
        color += (point.x * .1 + .4) * .15 * min(point.y + .5, 1.);
        gl_FragColor = vec4(clamp(color, 0., 1.), 1.);
      }
    `,
  })
}
