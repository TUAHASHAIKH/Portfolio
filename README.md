# Tuaha — Portfolio V2

A Next.js App Router portfolio with a React Three Fiber / Drei ice landscape. Development happens on `portfolio-v2`; `main` and `portfolio-v1` retain the original website.

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
- `components/polar/wind.tsx`: 1,200 GPU-animated snow particles traveling continuously left to right.
- `components/polar/assets.ts`: worker-based Draco and KTX2 loading and ice mesh separation.
- `components/polar/materials.ts`: baked surface rendering and frost emission during separation.
- `public/scene/`: detailed geometry, compressed baked maps, palette LUT, and decoder assets.
- `components/polar/audio-engine.ts`: default-on Web Audio mixer, scene crossfades, and interaction cues.
- `components/polar/glitch-effects.tsx`: short block reveals for labels and controls.
- `public/audio/`: the reference's 18 sound recordings and source attribution.
- `app/globals.css`: theme variables, locally hosted IBM Plex Mono, responsive layout.

The detailed meshes, baked textures, palette LUT, and font builds match the public assets on the supplied reference, https://my-portfolio-mu-vert-67.vercel.app/. Attribution is recorded in `public/scene/NOTICE.md`. Reference application code is not bundled. The scene and interaction are implemented in React. The LUT operates in display space, with bloom in linear light and one final output conversion. IBM Plex uses the included Open Font License. DOM text stays sharp without an MSDF atlas. There are no EXR assets to decode. Reference sound recordings are served locally with attribution in `public/audio/NOTICE.md`.

## Sound and glitch effects

Sound defaults to On. Mounting loads the 18 Ogg recordings in batches of three. When the browser blocks autoplay, the first click, tap, or keypress resumes the same AudioContext; loading never waits for autoplay permission. Muting before that gesture keeps sound off. Music and room ambience form the background; wind follows the igloo, portal sound follows ring proximity, and crystal/particle textures respond to pointer movement. Logo, labels, links, social selection, and detail entrance/exit have their matching UI cues. The main and detail sound controls share one mixer. Mute cancels pending cues; hidden tabs suspend playback; failed files can be retried without duplicating loops.

The logo uses its short sliced reveal. Labels, social controls, and detail links use brief block masks and horizontal offsets. Detail transitions use texture-driven block displacement and a small RGB separation inside the existing distortion pass. These effects finish at rest, preserve the grey scene, and turn off with reduced motion. Audio remains an independent preference.

Run `npm run test:audio` to check the local manifest, mix continuity, glitch envelopes, mute/retry behavior, and source cleanup. With a local server running, `npm run test:effects-browser` checks actual decoding of all 18 files, nonzero audio output, UI cues, mute, tab suspension, glitch cleanup, shader errors, and reduced-motion stillness. It accepts the same `PORTFOLIO_URL` and `CHROME_BIN` overrides as the scroll browser checks. Ogg playback was verified in Chromium; physical Safari/Android devices have not been tested.

Set `NEXT_PUBLIC_SITE_URL` to the eventual public origin before deployment so social images resolve to the right domain. An example is in `.env.example`. Next.js provides the route announcer automatically. WebGL2 is required for the scene; descriptive HTML and the sound control remain available when it is unsupported.

Rendering uses compressed GPU textures, capped device pixel ratio of 1.5, worker-based decoding, and pauses when the tab is hidden. Hover uses a stable interaction plane instead of raycasting against moving blocks. The reference's .05 pointer and .06 block interpolation coefficients at 60 Hz are converted into frame-rate-independent damping rates. Lower blocks stay anchored. The camera orbits the target with .07 horizontal and .025 vertical angular gain and .035 reference easing, including when the cursor is over the HTML overlay. Reduced-motion mode disables cursor orbit and the name animation. Actual frame rate depends on device and GPU. No deployment or merge into `main` is part of this screen build.

The reference's heading is a raster logo rather than an installable display font. `public/images/tuaha-wordmark.svg` recreates its geometric lettering for Tuaha; surrounding text uses the reference's IBM Plex Mono font files. The personalized wordmark is an interpretation of that logo, not a claim to an identified original font.

The measurement overlay selects up to five displaced pieces within two world units of the cursor's interaction point, shifted one unit toward the camera. Numbers are the final two digits of `floor(displacementDistance * 50)`. Crosses stay on the pieces while labels sit above and outward from them. Connections fade in over 100 ms and out over 60 ms. The DOM overlay stays outside post-processing so its fine white lines remain readable.

Ice emission is bounded and bloom is reduced to preserve the textured faces during opening. Wind combines directional snow, faster drifting valley wisps, and an animated ground-snow layer. Wind does not require audio or cursor movement. Reduced-motion mode removes the particles, freezes haze and ground flow, and clears the measurements as the blocks close.

The opening sequence assembles numeric particles, cage geometry and ice outlines before revealing the ice and terrain, with a descending camera over roughly eight seconds. The interface appears at 4.5 seconds. Temporary assembly draw calls are removed after the reveal. Reduced-motion mode skips this sequence. Foreground wind adds depth-tested wisps between the camera and igloo, alongside the world-space snow particles.

## Scroll journey

Scroll through the pinned 23-viewport track, from the igloo through skills, projects, about, the rings, and the contact chamber, then back to the igloo. Page position drives one damped camera path. Wheel input is normalized and bounded relative to the visible scene; touch and keyboard retain browser scrolling. The identity mark and sound control persist, while the introductory copy fades away.

`components/polar/crystal.tsx` renders the detailed ice shard with an HDR reflection environment, surface normal and roughness maps, a textured inner form and an animated 18-point 3D plexus. Its assets load independently of the hero through `crystal-assets.ts`. `crystal-readout.tsx` supplies sharp HTML annotations and a native modal dialog populated from the existing portfolio skills. The temperature readout is decorative reference-style telemetry, not a live sensor.

Reduced motion removes the radial distortion, camera interpolation and idle crystal/plexus movement. Each crystal opens a native dialog with Escape, keyboard focus containment and a close control. Skills and about show their content; projects opens the six-project gallery.

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
