import * as THREE from 'three'
import type { PolarAssets } from './assets'

// One clip-space displacement moves near ice and distant mountains together.
// Moving only world-space Y leaves the horizon behind because of perspective.
export function liftLandscape<T extends THREE.Material>(material: T, lift: { value: number }): T {
  const transform = (vertex: string, builtIn=false) => {
    // Effect replay and Fast Refresh can reuse patched source with a new
    // uniform object. Normalize the source, including older duplicate patches,
    // before injecting exactly one declaration and one displacement per write.
    const source=vertex
      .replace(/\buniform\s+float\s+landscapeLift\s*;\s*/g,'')
      .replace(/^[ \t]*gl_Position\s*\.\s*y\s*\+=\s*landscapeLift\s*\*\s*gl_Position\s*\.\s*w\s*;[ \t]*\r?\n/gm,'')
      .replace(/[ \t]*gl_Position\s*\.\s*y\s*\+=\s*landscapeLift\s*\*\s*gl_Position\s*\.\s*w\s*;[ \t]*/g,'')
    const displacement='gl_Position.y += landscapeLift * gl_Position.w;'
    return `uniform float landscapeLift;\n${builtIn
      ?source.replace(/#include <project_vertex>[ \t]*(?:\r?\n)?/,`#include <project_vertex>\n${displacement}\n`)
      :source.replace(/gl_Position\s*=\s*[^;]+;/g,`$& ${displacement}`)}`
  }
  if (material instanceof THREE.ShaderMaterial) {
    material.uniforms.landscapeLift = lift
    const vertex=transform(material.vertexShader)
    if(vertex!==material.vertexShader){material.vertexShader=vertex;material.needsUpdate=true}
  } else {
    material.onBeforeCompile = shader => {
      shader.uniforms.landscapeLift = lift
      shader.vertexShader = transform(shader.vertexShader,true)
    }
    material.customProgramCacheKey = () => 'landscape-lift-v2'
    material.needsUpdate=true
  }
  return material
}

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
        float assembly = reveal >= .999 ? 1. : 1. - smoothstep(reveal * 180. - 8., reveal * 180., length(worldPoint.xz));
        gl_FragColor = vec4(color, alpha * painted * assembly);
      }
    `,
  })
}

export function makeIceMaterial(assets: PolarAssets) {
  return new THREE.ShaderMaterial({
    transparent: true,
    uniforms: { materialize: { value: 1 }, closed: { value: assets.closed }, opened: { value: assets.opened }, triangles: { value: assets.iceTriangles }, separation: { value: 0 }, bounce: { value: 0 }, time: { value: 0 } },
    vertexShader: `
      attribute float emission;
      varying vec2 surfaceUv;
      varying float iceLight;
      varying vec3 localPoint;
      void main() {
        surfaceUv = uv;
        iceLight = emission;
        localPoint = (modelMatrix * vec4(position, 1.)).xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.);
      }
    `,
    fragmentShader: `
      uniform float materialize;
      uniform sampler2D closed;
      uniform sampler2D opened;
      uniform sampler2D triangles;
      uniform float separation;
      uniform float bounce;
      uniform float time;
      varying vec2 surfaceUv;
      varying float iceLight;
      varying vec3 localPoint;
      void main() {
        vec3 a = texture2D(closed, surfaceUv).rgb;
        vec3 b = texture2D(opened, surfaceUv).rgb + .05;
        vec3 color = mix(a, b, clamp(separation * 5., 0., 1.));
        vec3 point = localPoint;
        vec3 blue = vec3(.5,.7,1.);
        if (materialize < 1.) {
          float edge = mix(5.45, -.4, materialize);
          float reveal = 1. - smoothstep(edge - 1.5, edge, point.y);
          if (reveal > .9999) discard;
          reveal += clamp(reveal * texture2D(triangles, surfaceUv * 5.).r * 13., 0., 1.);
          color += reveal * blue;
        }
        float rim = max(0., iceLight);
        color += rim * rim * clamp(separation, 0., 1.) * blue;
        vec3 idleGlow = pow(rim, 8.) * blue * .5;
        color += idleGlow * (sin(point.x - time + 3.2) * .5 + .5);
        color += smoothstep(0., 2., point.x * .5 - point.z * .5) * idleGlow;
        color += (point.x * .1 + .4) * .15 * min(point.y + .5, 1.);
        color = clamp(color, 0., 1.);
        color += (1. - smoothstep(-1.5, 1., point.y)) * bounce * vec3(.8,.9,1.) * .25;
        gl_FragColor = vec4(color, 1.);
      }
    `,
  })
}
