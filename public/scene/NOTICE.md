# Scene asset sources

The ice, ground, mountain and patch meshes, baked texture maps and color lookup were downloaded from the public assets of the user-supplied visual reference:

https://my-portfolio-mu-vert-67.vercel.app/

The reference uses the Igloo Inc. visual scene originally created by Abeto / Bureaux. These scene assets are third-party work, not original models or textures created for this portfolio. The React scene controller, asset integration, interaction, and UI in this repository are implemented separately; the reference application's JavaScript bundles are not shipped.

The Draco and Basis decoder files are distributed with Three.js and retain their embedded license notices. IBM Plex Mono uses the Open Font License included at `/fonts/OFL.txt`.

The introduction also uses the reference's public cage, outline, particle geometry and number atlas. Its animation and shaders are implemented locally in React Three Fiber.

The first portfolio crystal uses the reference's cube3 and abstractlogo meshes, normal and roughness maps, core color texture and cubes_env reflection environment. These are third-party assets. The native scroll controller, transition post-processing, React crystal scene and accessible skills panel are implemented separately.

Crystal refinement also uses the reference's cube_scene color LUT, perlin-datatexture and triangles_tiling textures for the palette, mist and hover grid.

The surface-frost simulation uses the reference's public cubes/advect.png flow texture and the crystal's secondary UV atlas. The React GPU feedback controller and shader integration are implemented locally.

The original downloaded crystal mesh remains unchanged on disk. At runtime, a small right-hand recess is smoothed to remove the dark puncture reported by the portfolio owner, retaining the reference UVs and texture maps.

The second (projects) crystal uses the same reference's public `cubes/cube1.drc`, `cubes/cube1_normal.ktx2` and `cubes/cube1_roughness.ktx2`, stored locally as `projects-crystal.drc` and `projects_crystal_*`. Its secondary UV atlas is preserved for the existing hover simulation. The scroll choreography, labels and React integration are implemented locally; both crystals share the reflection environment and color grade.

The third (about) crystal uses the reference's `cubes/cube2.drc`, `cubes/cube2_normal.ktx2` and `cubes/cube2_roughness.ktx2`, stored as `about-crystal.drc` and `about_crystal_*`. Its own surface maps and secondary UVs are retained. All three crystals share the reflection environment, core geometry and color grade; the third crystal's scrolling, hover and personalized About Me panel are implemented locally.
