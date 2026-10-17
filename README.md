# Tuaha — Portfolio V2

A Next.js App Router portfolio with a React Three Fiber / Drei ice landscape. Development happens on `portfolio-v2`; `main` and `portfolio-v1` retain the original website.

## Run

Use Node.js 22 and npm:

```sh
npm ci
npm run dev
```

Open http://localhost:3000. Move over the igloo to separate nearby blocks and reveal the measurement annotations. Sound is off until the sound button is pressed. Narrow screens get a wider camera view; reduced-motion preferences disable block movement and snow particles.

```sh
npx tsc --noEmit
npm run build
npm start
```

## Structure

- `components/polar/experience.tsx`: accessible overlay, loading state, sound, WebGL fallback.
- `components/polar/scene.tsx`: scene controller, two-stage motion smoothing, camera, haze, bloom, and color grading.
- `components/polar/assets.ts`: worker-based Draco and KTX2 loading and ice mesh separation.
- `components/polar/materials.ts`: baked surface rendering and frost emission during separation.
- `public/scene/`: detailed geometry, compressed baked maps, palette LUT, and decoder assets.
- `public/workers/wind.js`: WAV ambient audio synthesis.
- `app/globals.css`: theme variables, locally hosted IBM Plex Mono, responsive layout.

The detailed meshes, baked textures, palette LUT, and font builds match the public assets on the supplied reference, https://my-portfolio-mu-vert-67.vercel.app/. Attribution is recorded in `public/scene/NOTICE.md`. Reference application code is not bundled. The scene and interaction are implemented in React. The LUT operates in display space, with bloom in linear light and one final output conversion. IBM Plex uses the included Open Font License. DOM text stays sharp without an MSDF atlas. There are no EXR assets to decode. Ambient audio is synthesized locally.

Set `NEXT_PUBLIC_SITE_URL` to the eventual public origin before deployment so social images resolve to the right domain. An example is in `.env.example`. Next.js provides the route announcer automatically. WebGL2 is required for the scene; descriptive HTML and the sound control remain available when it is unsupported.

Rendering uses compressed GPU textures, capped device pixel ratio of 1.5, worker-based decoding, and pauses when the tab is hidden. Hover uses a stable interaction plane instead of raycasting against moving blocks. Cascaded smoothing slows both opening and closing without abrupt resets. Lower blocks stay anchored. Actual frame rate depends on device and GPU. No deployment or merge into `main` is part of this screen build.
