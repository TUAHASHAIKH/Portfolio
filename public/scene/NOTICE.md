# Scene asset sources

The LinkedIn and WhatsApp particle silhouettes are drawn locally with Canvas paths and sampled as extruded surfaces in a worker. They do not use the reference's Discord or Telegram volumes. A local GPU simulation stores independent particle positions and velocities for cursor momentum, illumination and surface reassembly; native links and controls point to Tuaha's own profiles.

The ring passage uses the reference's public `shattered_ring2`, `shattered_ring`, `shattered_ring_smoke` and `floor` Draco meshes, their baked color/emission maps, `clouds_noise`, `noises/blue-8-128-rgb`, `scroll-datatexture` and the `peachesbody_64` signed-distance volume. These are third-party assets. The scroll camera, fragment animation, portal fields, particle surface extraction and post-processing integration are implemented locally; reference JavaScript bundles are not distributed.

The ice, ground, mountain and patch meshes, baked texture maps and color lookup were downloaded from the public assets of the user-supplied visual reference:

https://my-portfolio-mu-vert-67.vercel.app/

The reference uses the Igloo Inc. visual scene originally created by Abeto / Bureaux. These scene assets are third-party work, not original models or textures created for this portfolio. The React scene controller, asset integration, interaction, and UI in this repository are implemented separately; the reference application's JavaScript bundles are not shipped.

The Draco and Basis decoder files are distributed with Three.js and retain their embedded license notices. IBM Plex Mono uses the Open Font License included at `/fonts/OFL.txt`.

The introduction also uses the reference's public cage, outline, particle geometry and number atlas. Its animation and shaders are implemented locally in React Three Fiber.

The landscape reveal uses the reference's public `/assets/images/mosaic.ktx2`, stored as `textures/intro_mosaic.ktx2`. The reference's igloo and crystal triangle atlases are identical; the existing `crystal_triangles.ktx2` is reused for the terrain scan, without projecting that pattern onto the igloo. The cage and outline assets contain line segments, not triangle faces.

The first portfolio crystal uses the reference's cube3 and abstractlogo meshes, normal and roughness maps, core color texture and cubes_env reflection environment. These are third-party assets. The native scroll controller, transition post-processing, React crystal scene and accessible skills panel are implemented separately.

Crystal refinement also uses the reference's cube_scene color LUT, perlin-datatexture and triangles_tiling textures for the palette, mist and hover grid.

The surface-frost simulation uses the reference's public cubes/advect.png flow texture and the crystal's secondary UV atlas. The React GPU feedback controller and shader integration are implemented locally.

The original downloaded crystal mesh remains unchanged on disk. At runtime, a small right-hand recess is smoothed to remove the dark puncture reported by the portfolio owner, retaining the reference UVs and texture maps.

The second (projects) crystal uses the same reference's public `cubes/cube1.drc`, `cubes/cube1_normal.ktx2` and `cubes/cube1_roughness.ktx2`, stored locally as `projects-crystal.drc` and `projects_crystal_*`. Its secondary UV atlas is preserved for the existing hover simulation. The scroll choreography, labels and React integration are implemented locally; both crystals share the reflection environment and color grade.

The third (about) crystal uses the reference's `cubes/cube2.drc`, `cubes/cube2_normal.ktx2` and `cubes/cube2_roughness.ktx2`, stored as `about-crystal.drc` and `about_crystal_*`. Its own surface maps and secondary UVs are retained. All three crystals share the reflection environment, core geometry and color grade; the third crystal's scrolling, hover and personalized About Me panel are implemented locally.

The particle simulation uses the reference's four-dimensional bitangent noise math (PCG hashes and crossed simplex gradients). Its fluid passes and distance-volume integration are implemented locally in `components/polar/particle-flow.ts` and `particle-simulation.ts`. Parameters, the computation triangle's constant noise input, half-second selection turbulence, grain size, and blending were checked against the supplied site's public `assets/App3D-f554a111.js` and its live WebGL state. Camera projection and reduced-motion handling are adapted to this portfolio. LinkedIn, WhatsApp, and Gmail volumes are generated locally from Tuaha's icon silhouettes and use the same particle solver as GitHub.
