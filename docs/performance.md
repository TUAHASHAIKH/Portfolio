# Portfolio rendering and loading review

The optimization preserves the existing art and interaction budgets: original mountain and igloo geometry, baked textures, eight-sample crystal refraction, 150,000 contact particles, full project artwork, and the existing 1.5 device-pixel-ratio cap. No dependencies were added.

## Findings and changes

| Bottleneck | Change |
| --- | --- |
| Each igloo block submitted its own draw and material uniforms | One merged geometry and a small float transform atlas retain independent rotation, displacement and seam illumination for every block. |
| Shaders were prepared for the screen but first rendered into HDR targets | Prepare against the actual target configuration, restoring renderer state immediately. This avoids compiling a second color-space variant on the first draw. |
| Night calculations ran even when daylight mixed them away | Skip night sky and relief calculations in full daylight; skip the identity color-grade pass in full night. Theme transitions still interpolate normally. |
| Procedural skies shaded empty star cells and inactive portions of curtains | Skip zero-contribution star cells and retain only the diffuse halo below curtains where the other terms are zero. |
| Each RGB refraction sample projected and fetched the same fallback | Compute the fallback once per fragment while retaining all eight dispersion samples. |
| 150,000 grains occupied 262,144 simulation pixels | Pack them into 150,016 pixels. All grain positions and physics remain present; eight float textures together save approximately 13.7 MiB. |
| Audio and later sections competed with the opening scene | Load the hero first, then stage crystals/rings; earlier scroll intent brings their loading forward. Audio starts after hero readiness or the first earlier gesture. |
| Each section downloaded and started its own decoders | Reuse a renderer-scoped Draco/KTX2 worker pool; release workers after 30 seconds without loading work. |
| Hidden landscape work and static accessibility scenes kept updating | Stop hidden snow/ice/measurement work. Reduced-motion rendering becomes demand-driven, with redraws for scroll, theme, resize, details and social selection. |
| Public assets revalidated on every visit | Cache local scene/audio/font/image assets for one hour, with mandatory revalidation after expiry. These non-hashed URLs are deliberately not marked immutable. |

## Measurements

Recorded against production builds in local headless Chrome on Intel Iris Xe / Direct3D11. Mobile dimensions were emulated at 390 x 844 with device scale factor 3 (the site still caps rendering DPR at 1.5). The slow-network comparison disabled the HTTP cache and used 5 Mbps download, 1 Mbps upload and 80 ms latency.

| Metric | Before | After |
| --- | ---: | ---: |
| Hero draws per animated frame, daylight | 104 | 35 |
| Contact simulation pixels | 262,144 | 150,016 |
| Static reduced-motion GPU draws after settling | Continuous | 0 |
| Landscape-ready time, simulated mobile / 5 Mbps | 13.12 s | 10.63 s |
| Completed resource body bytes at landscape readiness, same run | 7.42 MB | 4.67 MB |

Landscape readiness is the first animation frame observing the loader's ready state; it is not the end of the authored introduction or a Core Web Vitals score. Later assets continue loading in the background. These are controlled local observations, not guarantees for every device or network.

The initial CPU profile contained shader-initialization stalls lasting over a second. After target-correct preparation, the captured startup no longer had those multi-second stalls. Frame timing remains dependent on GPU, thermals and browser scheduling; the night crystals are still the heaviest part of the scene. Physical iOS and Android hardware has not been tested.

## Initial loader follow-up

The loader screenshot prompted a separate startup waterfall review. The hero was behind a client-only dynamic import: landscape requests began around 2.1 seconds after navigation, and Basis decoder requests only began around 4.4 seconds. The hero script is now discoverable in the initial HTML (WebGL still mounts only after the browser support check). Eleven fetch preloads start its six large texture maps, igloo geometry and four decoder resources early. Crystals/rings remain lazy-loaded. Fetch mode and credentials match the consumers to avoid duplicate downloads; large binary hints have low priority.

At 1280 x 800, 5 Mbps download / 80 ms latency, the before/after cold-loader comparison was **11.04 s → 8.22 s**. A second run with an empty HTTP cache measured **8.24 s**, followed by **1.00 s** on a cached return visit. The loader measurement observes its ready attribute, before its existing fade and authored entrance sequence. Texture quality, geometry, animation timing and the ready condition are unchanged. These desktop-viewport measurements are separate from the mobile comparison above.

`npm run test:loader-browser` checks early HTML resource discovery, one request per hinted asset, full landscape readiness and cache reuse on return. Set `AUDIT_SLOW=1` for the throttled run. Its report is written to `.preview/loader-verification.json`.

## Verification and reproduction

- `npm run build`: production compilation and TypeScript.
- `npm run test:rendering`: every ice vertex/index/UV/emission value survives batching, transformed positions match the original per-block matrices, all 150,000 grains have unique simulation texels, and shader preparation restores renderer state on success or error.
- `npm run test:performance-browser`: actual WebGL draw counts, zero idle draws in reduced motion, event-driven redraws, and mobile resolution.
- Existing theme, landing, sky, particle, effects and scroll browser suites exercise light-first persistence, all detail pages and covers, animation/reversal, pointer-driven fluid interaction, audio, touch/keyboard behavior and reduced-motion stillness.
- `npm run benchmark:browser`: production load metrics, resource sizes, long tasks, draw counts and frame-time percentiles, written to `.preview/perf-*.json`.

Set `PORTFOLIO_URL` to the running production URL. Optional benchmark variables: `AUDIT_LABEL`, `AUDIT_MOBILE=1`, `AUDIT_SLOW=1`; use `CHROME_BIN` if Chrome is outside the standard locations. Run benchmarks without other browser tests or builds competing for CPU/GPU resources. Timing comparisons should use the same machine, viewport, network profile and motion setting.
