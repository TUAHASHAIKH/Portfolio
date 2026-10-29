# Tuaha — Portfolio V2

A Next.js App Router portfolio with a React Three Fiber / Drei ice landscape. `main` publishes V2; focused development commits stay on `portfolio-v2` and are merged with their history intact. `portfolio-v1` preserves the original website.

The unused V1 sections, theme/UI component library, helper hooks, styles, placeholder/profile images, duplicate project images, and source ZIP have been removed from V2. The current project images and portfolio content remain in use. Dependencies now contain only the current scene, Next.js, React, TypeScript, and their types.

## Run

Use Node.js 22 and npm:

```sh
npm ci
npm run dev
```

Open http://localhost:3000. Move over the igloo to separate nearby blocks and reveal the measurement annotations. Sound defaults to On and starts automatically when allowed; otherwise the first click, tap, or keypress unlocks playback. Narrow screens get a wider camera view; reduced-motion preferences disable block movement and snow particles.

```sh
npx tsc --noEmit
npm run build
npm start
```

## Structure

- `components/polar/experience.tsx`: accessible overlay, loading state, sound, WebGL fallback.
- `components/polar/scene.tsx`: scene controller, reference-rate block motion, cursor orbit, haze, bloom, and color grading.
- `components/polar/wordmark.tsx`: accessible geometric name mark with a 250 ms hover/focus glitch and reduced-motion support.
- `components/polar/measurements.tsx`: five-point displacement readout with crosshair anchors, outward labels, and animated proximity connections.
- `components/polar/wind.tsx`: 1,200 rotating snow flakes with accumulated wind velocity, drag, and continuous volume wrapping.
- `components/polar/assets.ts`: worker-based Draco and KTX2 loading and ice mesh separation.
- `components/polar/materials.ts`: baked surface rendering and frost emission during separation.
- `public/scene/`: detailed geometry, compressed baked maps, palette LUT, and decoder assets.
- `components/polar/audio-engine.ts`: default-on Web Audio mixer, scene crossfades, and interaction cues.
- `components/polar/glitch-effects.tsx`: short block reveals for labels and controls.
- `public/audio/`: the reference's 18 sound recordings and source attribution.
- `app/globals.css`: theme variables, locally hosted IBM Plex Mono, responsive layout.

The detailed meshes, baked textures, palette LUT, and font builds match the public assets on the supplied reference, https://my-portfolio-mu-vert-67.vercel.app/. Attribution is recorded in `public/scene/NOTICE.md`. Reference application bundles are not shipped; the particle shader retains its bitangent noise math with attribution. The scene and interaction are implemented in React. The LUT operates in display space, with bloom in linear light and one final output conversion. IBM Plex uses the included Open Font License. DOM text stays sharp without an MSDF atlas. The crystal reflection environment is decoded from its EXR asset. Reference sound recordings are served locally with attribution in `public/audio/NOTICE.md`.

## Sound and glitch effects

Sound defaults to On. Mounting loads the 18 Ogg recordings in batches of three. When the browser blocks autoplay, the first click, tap, or keypress resumes the same AudioContext; loading never waits for autoplay permission. Muting before that gesture keeps sound off. Music and room ambience form the background; wind follows the igloo, portal sound follows ring proximity, and crystal/particle textures respond to pointer movement. Logo, labels, links, social selection, and detail entrance/exit have their matching UI cues. The main and detail sound controls share one mixer. Mute cancels pending cues; hidden tabs suspend playback; failed files can be retried without duplicating loops.

The logo uses its short sliced reveal. Labels, social controls, and detail links use brief block masks and horizontal offsets. Detail transitions use texture-driven block displacement and a small RGB separation inside the existing distortion pass. These effects finish at rest, preserve the grey scene, and turn off with reduced motion. Audio remains an independent preference.

Run `npm run test:audio` to check the local manifest, mix continuity, glitch envelopes, mute/retry behavior, and source cleanup. With a local server running, `npm run test:effects-browser` checks actual decoding of all 18 files, nonzero audio output, UI cues, mute, tab suspension, glitch cleanup, shader errors, and reduced-motion stillness. It accepts the same `PORTFOLIO_URL` and `CHROME_BIN` overrides as the scroll browser checks. Ogg playback was verified in Chromium; physical Safari/Android devices have not been tested.

Set `NEXT_PUBLIC_SITE_URL` to the eventual public origin before deployment so social images resolve to the right domain. An example is in `.env.example`. Next.js provides the route announcer automatically. WebGL2 is required for the scene; descriptive HTML and the sound control remain available when it is unsupported.

Rendering uses compressed GPU textures, capped device pixel ratio of 1.5, worker-based decoding, and pauses when the tab is hidden. Hover uses a stable interaction plane instead of raycasting against moving blocks. The reference's .05 pointer and .06 block interpolation coefficients at 60 Hz are converted into frame-rate-independent damping rates. Lower blocks stay anchored. The camera orbits the target with .07 horizontal and .025 vertical angular gain and .035 reference easing, including when the cursor is over the HTML overlay. Reduced-motion mode disables cursor orbit and the name animation. Actual frame rate depends on device and GPU.

The reference's heading is a raster logo rather than an installable display font. `public/images/tuaha-wordmark.svg` recreates its geometric lettering for Tuaha; surrounding text uses the reference's IBM Plex Mono font files. The personalized wordmark is an interpretation of that logo, not a claim to an identified original font.

The measurement overlay selects up to five displaced pieces within two world units of the cursor's interaction point, shifted one unit toward the camera. Numbers are the final two digits of `floor(displacementDistance * 50)`. Crosses stay on the pieces while labels sit above and outward from them. Connections fade in over 100 ms and out over 60 ms. The DOM overlay stays outside post-processing so its fine white lines remain readable.

Ice emission is bounded and bloom is reduced to preserve the textured faces during opening. Wind combines directional snow, faster drifting valley wisps, and an animated ground-snow layer. Wind does not require audio or cursor movement. Reduced-motion mode removes the particles, freezes haze and ground flow, and clears the measurements as the blocks close.

The opening sequence assembles numeric particles, cage geometry and ice outlines before revealing the ice and terrain, with a descending camera over roughly eight seconds. The interface appears at 4.5 seconds. Temporary assembly draw calls are removed after the reveal. Reduced-motion mode skips this sequence. Snow uses rotating instanced flakes and the reference acceleration/friction at a fixed 60 Hz; the scene retains its world-space valley haze.

## Scroll journey

Scroll through the pinned 23-viewport track, from the igloo through skills, projects, about, the rings, and the contact chamber, then back to the igloo. Page position drives one damped camera path. Wheel input is normalized and bounded relative to the visible scene; touch and keyboard retain browser scrolling. The identity mark and sound control persist, while the introductory copy fades away.

`components/polar/crystal.tsx` renders the detailed ice shard with an HDR reflection environment, surface normal and roughness maps, a textured inner form and an animated 18-point 3D plexus. Its assets load independently of the hero through `crystal-assets.ts`. `crystal-readout.tsx` supplies sharp HTML annotations and a native modal dialog populated from the existing portfolio skills. The temperature readout is decorative reference-style telemetry, not a live sensor.

Reduced motion removes the radial distortion, camera interpolation and idle crystal/plexus movement. Each crystal opens a native dialog with Escape, keyboard focus containment and a close control. Skills, Projects, and About share the same detail-page layout. Projects lists twelve selected public projects inline, with Pulse first, custom cover artwork, source links, and available live demos.

Crystal rendering uses paired half-float rear/front refraction buffers, the reference's crystal LUT, smoothly filtered Perlin mist and eight transmission samples. The hero retains its original grade. One shared scroll trajectory overlaps camera retreat, bottom-to-top mist, upward landscape movement and the crystal rise; the retreat keeps moving throughout the handoff.

The entire crystal supports pointer/touch activation through geometry raycasting; the HTML explore control supports keyboard access. Pointer movement paints the secondary UV atlas into a 512-pixel GPU feedback simulation. Advecting frost changes surface roughness and normals, while its advancing rim illuminates the triangle pattern. The field persists and fades after the pointer moves away. Fahrenheit and signed Celsius values drift together using the reference's slow sinusoidal temperature pattern; reduced-motion mode fixes the values. These remain decorative telemetry.

The crystal line field uses 18 independently moving points, at most three neighbors per point, and 350 ms connection fades. Label leaders project from the rotating surface each frame and freeze with reduced motion. A small right-side recess is filled at load time while retaining the original UVs and texture maps; refraction also falls back safely when a ray misses its buffer.

## Scroll input and regression checks

The landing uses the reference's separate timing curves for the outline, cage, top-down ice reveal, outward terrain scan, mountain fade, and camera descent. The sequence settles after 8.2 seconds of animation time; loading stalls and hidden-tab gaps cannot skip stages. Intro geometry renders as line segments, and the terrain's triangle pattern is kept off the igloo surface. Reduced motion immediately shows the completed landscape.

Run `npm run test:landing` for reveal ordering, curve continuity, timing limits, and reduced-motion completion. With a local server running, `npm run test:landing-browser` observes the actual WebGL draw modes and reveal uniforms, checks desktop staging and mobile reduced-motion stillness, and saves preview screenshots under `.preview/`. It accepts `PORTFOLIO_URL` and `CHROME_BIN` overrides.

The supplied Harry reference uses eased scroll targets with a bounded distance ahead of the camera. V2 applies that behavior to its existing camera path without bundling the reference application code. The grey scene, crystal spacing, and reduced-motion poses are preserved.

- Wheel targets stay within 90% of a viewport ahead of the visible scene. Large bursts cannot accumulate seconds of unwanted travel, and reversal cancels queued input in the previous direction. Fractional trackpad pixels accumulate instead of being rounded away.
- The scene owns wheel easing; browser wheel animation is prevented for handled vertical gestures. Pinch zoom and horizontal gestures remain available. Touch scrolling keeps browser inertia, and navigation keys belong to focused controls or open dialogs.
- Both loop seams retain overshoot. Viewport changes preserve the journey destination, and closing a detail after rotation restores normalized progress rather than stale pixels. Resuming a hidden tab does not advance the camera by the entire paused interval.
- Detail panels ease wheel input only while moving. Keyboard, touch, scrollbar dragging, and direct scrolling cancel pending wheel animation. Reduced motion uses native panel scrolling. Modal gestures cannot move the background journey.

Run `npm run test:journey` for motion/path tests and `npm run build` for the production build. With a server running, `npm run test:scroll-browser` checks real Chromium wheel input, subpixel input, reversal, loop seams, focused controls, detail scrolling, mobile rotation, touch, reduced-motion stillness, and runtime errors. It also reports frame timings and saves `.preview/scroll-verified.png`. Set `PORTFOLIO_URL` to test a different local server and `CHROME_BIN` if Chrome is not in a standard location. Browser tests use an isolated profile under the ignored `.preview/` directory. Emulated mobile checks do not replace physical Safari/Android testing; frame timings depend on the GPU and display.

Every full-page load resets native scroll restoration before hydration, so the journey begins at the landing scene. The scroll browser test verifies reloads from the crystals and contact section.

Contact uses 150,000 grains, a persistent 128 x 128 fluid velocity field, and signed-distance volume forces. The GitHub physics follows the supplied reference: .22 stroke radius, 35 stroke force, three pressure passes, .98 velocity dissipation, .86 pressure dissipation, .9 grain drag, and .75 radians/second volume rotation. The computation uses the reference's shared bitangent noise field; per-grain noise frequencies would make the silhouette shimmer and spread. Social selection adds its half-second turbulence burst. Grains use the reference's size, motion highlight, and custom blending.

Pointer projection follows the displayed camera lens, aspect ratio, and portrait zoom. Strokes accumulate at a 16 ms cadence and keep circulating after input stops. GitHub, LinkedIn, WhatsApp, and Gmail use the same fluid impulses, bitangent noise, volume attraction, drag, and selection burst. The worker converts Tuaha's icon masks into rounded 128³ distance volumes, retaining the holes and disconnected parts. Flat icons face the reader with a slight rocking motion; GitHub keeps its full rotation. Reduced motion displays a static surface and disables the simulation. Run `npm run test:particles-browser` against the local server to check GPU flow persistence, scattering and recovery for every icon, resting volume accuracy, desktop/portrait projection, and reduced-motion suspension. Screenshots are saved under `.preview/`.

The particle simulation now starts before the ring reveal, with the reference's forming turbulence and white-to-pale fade. Highlights are bounded before bloom, and the ring bloom is narrower and weaker so the distant sculpture remains granular. This removes the dark blue silhouette at low opacity and the blue-white halo during the descent. `npm run test:ring-reveal` scrolls forward and backward through the reveal, reads the GPU's pre-bloom output to check its brightness bounds, and verifies reduced-motion suspension and WebGL errors. Reference and local screenshots were compared at matching reveal stages; the surrounding scene remains the local grey ice implementation.


### Daylight / Nightfall

The lower-right theme control switches between the original grey ice scene and a midnight expedition. Fresh visits always start in light mode, regardless of the device color scheme. A manual choice is saved as `portfolio-theme` in local storage and restored on later visits. Storage-disabled browsers still support switching for the current visit.

Nightfall uses procedural star fields and layered auroral curtains in the existing sky and crystal transmission shaders, moonlit terrain and ice, spectral ring illumination, and an accretion halo. Mountain geometry stays identical in both themes; switching changes lighting and colors without resizing the landscape. Theme uniforms interpolate without rebuilding the scene or moving the scroll playhead. Reduced motion freezes ambient animation and applies theme changes immediately. No new runtime dependencies, textures, render targets, or postprocessing passes were added.

Run `npm run test:theme-browser` against the development server to verify the light-first default, saved preference persistence, scroll preservation, crystal dialogs, mobile layouts, reduced motion, and WebGL compilation. Review the desktop and mobile captures under `.preview/theme-*.png`. The existing journey, landing, audio, and interaction checks remain available.


The night sky uses a shared visible-tab animation clock across all three environments. Forward scrolling moves the stars upward at different depths; reversing retraces their positions, including through the journey loop. Auroral folds continue flowing while idle, and occasional seeded shooting stars appear with short fading trails. Reduced motion freezes the sky and disables shooting stars. The igloo retains the daylight seam illumination, opening glow, and reflected light on the snow, combined with the detailed night ice shading.

Run `npm run test:sky-browser` for GPU uniform checks of continuous sky time, forward/reverse star movement, hover illumination captures, and reduced-motion suspension.


### Project artwork

The twelve project covers share a centered 16:10 composition. Full-size WebP files are 1600 x 1000; 800 x 500 variants serve smaller screens. Images use `object-fit: contain`, a fixed aspect ratio, and no zoom so subjects remain fully visible. Original project pictures remain in `public/images/projects/`; generated PNG masters are retained locally in `.preview/project-artwork-sources/`.

The covers are conceptual illustrations generated with the built-in image tool, rather than screenshots of the applications. The final prompt set and repository sources are recorded in `docs/project-artwork.json`. Selection notes are in `docs/project-selection.md`.
