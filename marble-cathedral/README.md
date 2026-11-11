# The Marble Hall

A real-time, fully procedural 3D reconstruction of a marble cathedral hall, built in three.js from a single reference image. No external models or textures: all geometry and textures are generated in code at load.

## Reference

![Reference image](Marble-Cathedral.jpeg)

## Result

![Real-time render](preview.png)

## Running it

```sh
npm start        # serves on http://localhost:8377
```

It needs a local server; opening `index.html` directly will not work. three.js, n8ao and postprocessing load from the jsDelivr CDN at pinned versions (see the import map in `index.html`), so there is no install or build step, but the page needs internet access. Because every local path is relative, the repo can be served as-is by any static host, including GitHub Pages.

**Touch devices:** on phones and tablets an on-screen stick (walk), up/down buttons, and Next view / Tour buttons appear automatically; drag anywhere else to look. Touch devices also default to a lighter quality setting (`?q=0.75`).

**Controls:** drag to look, `WASD` to walk, `Q`/`E` down/up, `Shift` to run, scroll to change the lens, `1`–`7` for viewpoints, `T` for a guided tour, `H` to hide the interface.

## Process

1. **Studied the reference.** Cropped the image into regions (columns, throne, windows, floor) to work out the layout, proportions and where the sun comes from.
2. **Fixed a floor plan.** A nave 18 m wide with 13 m aisles, bays every 11 m, an 18 m crossing under the dome, and a semicircular apse. Every piece is placed off that grid.
3. **Generated the geometry in code** (`src/geo.js`, `src/hall.js`):
   - **Columns:** a parametric surface whose radius varies with angle and height to make twisted lobes, plus swept tubes for vines, gold threads and capital fronds.
   - **Vaults:** a height field taking the higher of two pointed-arch profiles per bay, with tube ribs along the edges and diagonals.
   - **Dome:** a spherical pendentive surface, drum and shell.
   - **Walls:** extruded shapes with arch-shaped holes, then tracery and glass set into the openings.
   - **Ivy:** about 45k instanced leaves.
   - Everything else is merged into one mesh per material to keep draw calls low.
4. **Generated the textures** (`src/textures.js`): stained glass, carved filigree and floor inlay are drawn on 2D canvases; marble veining is computed in the shader from a 3D noise texture, so it needs no UVs and has no seams.
5. **Lit it** (`src/main.js`, `src/materials.js`):
   - One shadow-casting sun, plus lantern, throne and dome lights.
   - The glass is rendered from the sun's viewpoint into a colour texture that tints the sunlight where it lands.
   - A cubemap captured from inside the hall, twice, provides bounce light.
   - The floor is re-rendered from a mirrored camera for reflections.
6. **Post-processed** (`src/post.js`): the HDR scene render goes through ambient occlusion, ray-marched light shafts against the sun's depth map, bloom, ACES tone mapping with a colour grade, and anti-aliasing.
7. **Iterated on screenshots.** Drove headless Chrome to capture seven viewpoints, compared against the reference, and tuned over about five rounds. The main fixes were noisy marble, fat columns, flat ambient light and blown-out glass.

## Cost and time

Built by Claude Fable 5.2 in Claude Code, in a single session from one prompt. Figures are read from the session transcript and cover the build only, from the request to the final verified screenshot.

| | |
|---|---|
| Wall-clock time | about 28 minutes |
| Output tokens | 143,621 |
| Input tokens (uncached) | 68 |
| Cache-write tokens | 207,304 |
| Cache-read tokens | 4,935,767 |
| Total tokens processed | about 5.29 million |
| Model requests | 32 |

Most of the total is cache reads: the growing conversation is re-read on every request, and those tokens are billed at a small fraction of the normal input rate.

### Equivalent API cost

At standard Claude Fable 5.2 API rates (standard speed, 1-hour cache writes, as recorded in the transcript):

| Token type | Tokens | Rate per million | Cost |
|---|---|---|---|
| Output | 143,621 | $40.00 | $5.74 |
| Cache write (1-hour) | 207,304 | $16.00 | $3.32 |
| Cache read | 4,935,767 | $0.20 | $0.99 |
| Input (uncached) | 68 | $8.00 | $0.00 |
| **Total** | | | **about $10.05** |

The session ran on a $200/month subscription, so nothing was billed per token; this is what the same usage would cost on pay-as-you-go API pricing, roughly 5% of one month's subscription fee. Rates are from the pricing reference bundled with Claude Code (cached 2026-11-03); the cache-write rate is that reference's 2x-input multiplier for 1-hour writes rather than a separately listed price.

## Scene statistics and hardware requirements

Measured in the running scene with headless Chrome on an Apple M5 Max (40-core GPU, 128 GB RAM). That is a top-end machine, so the frame times below are a best case, not what a typical laptop will see.

### Geometry

| Mesh (one per material) | Triangles |
|---|---|
| Marble (columns, walls, ribs, gallery, throne) | 1,215,460 |
| Gold (threads, trims, lantern frames) | 547,104 |
| Ivy leaves (45,171 instances of an 8-triangle leaf) | 361,368 |
| Vault and dome surfaces | 56,920 |
| Window tracery | 42,388 |
| Ivy stems | 23,178 |
| Everything else (glass, relief bands, lanterns, door, figure, floor) | 5,755 |
| **Total** | **2,252,173** |

- 1.17 million unique vertices, about 60 MB of vertex and index data.
- 18 mesh objects in the scene, plus 2,600 dust particles.
- 22 lights: one shadow-casting sun, one spotlight, one hemisphere fill and 19 point lights.

### Per-frame workload

| | |
|---|---|
| Draw calls per frame, all passes | 61 |
| Triangles submitted per frame | 4.5 million (the scene is drawn twice: main view and floor reflection) |
| Shader programs | 44 |
| Sun shadow map | 6144 x 6144, rendered once at load and reused |
| Frame time at 1920 x 1080 | 7.0 ms (about 140 fps uncapped) |
| Frame time at 2560 x 1440 | 9.5 ms (about 105 fps uncapped) |
| Load time (build geometry and textures) | 1 to 4 seconds |

The cost is mostly per pixel, not per triangle. Each visible pixel runs the marble shader (about 20 3D-texture lookups), loops over all 22 lights, and is 4x multisampled. On top of that come ambient occlusion (12 samples), light shafts (44 ray-march steps at half resolution), bloom and anti-aliasing. Frame time therefore scales with resolution.

### Memory

| | |
|---|---|
| JavaScript heap (measured) | about 215 MB |
| GPU memory at 1080p (estimated) | about 0.9 GB |
| GPU memory at 1440p (estimated) | about 1.2 GB |

The GPU figures are calculated from the buffer and texture sizes, not read from the driver. The largest items are the shadow map (150 to 300 MB), the two 4096 x 4096 floor textures (about 170 MB), the stained-glass light texture (about 130 MB) and the multisampled HDR render targets (270 MB at 1080p, 480 MB at 1440p).

### What you need to run it

These are estimates extrapolated from the measurements above. Only the M5 Max was actually tested.

| | Minimum | Recommended |
|---|---|---|
| GPU | Recent integrated graphics (Apple M1, Intel Iris Xe, Radeon 780M); expect roughly 20 to 30 fps at 1080p | Apple M-series Pro or Max, or a discrete card of GeForce RTX 3060 class or better, for 60 fps at 1440p |
| GPU memory | 2 GB | 4 GB or more |
| System RAM | 8 GB | 16 GB |
| Browser | A desktop browser with WebGL 2 and float render targets (current Chrome, Edge, Firefox, Safari) | Chrome or Edge |

Phones and tablets are unlikely to run it well.

### Reducing the load

- Add `?q=0.5` (or any value below 1) to the URL to lower the render resolution; below 1 it also drops the shadow map to 4096.
- Press `O`, `V` or `B` to switch off ambient occlusion, light shafts or bloom.
- The render resolution is already capped at 1.5x device pixels on high-density screens.

## Known differences from the reference

- The throne reads as a lotus of marble ribbons rather than dense interwoven carving.
- Walls and columns carry less relief carving.
- The hall is symmetric, so the right side has a matching gallery instead of the round balcony pod around the foreground column.
- The colour is slightly cooler and greener than the reference's cream-gold.

Tested only in headless Chrome on macOS; not tested in Safari, Firefox or on mobile.

## Technical Deepdive

Questions asked after the build, with the answers as given in the session. Only the heading levels inside the answers were lowered to fit under this section.

### Q1. Ok now lets do a technical deep dive - I can see all the code but I want to know about the guidance that generated the code - was it your design layout ? If so, was the design layout stored in any file or format ?

Yes, the layout was my own design, worked out from your reference image and your one-paragraph request. It was never stored as a separate design file; it exists only as numbers in the code and as a summary in the README.

#### How the design was produced

- **Inputs:** the reference image (which I also cropped into six detail regions) and your prompt. I used no templates, example scenes, or downloaded assets.
- **The plan:** I did it as reasoning before writing any code. I estimated real-world scale from the tiny figure in the image, decided the hall type (nave and aisles of equal height, which is why the tall windows fit under the vaults), and fixed a grid.
- **Deliberate departures from the image:** I made the hall symmetric, put a dome over one bay, and placed the sun so that light through the upper-left windows lands on the nave floor. Those were choices to get a walkable, complete building from a single camera angle, not things I could read off the picture.
- **Iteration:** proportions and lighting values were then adjusted from screenshots, so the final numbers differ from the first plan (the columns started 25% fatter, for example).

#### Where the layout lives now

| What | Where |
|---|---|
| Floor plan: aisle and nave widths, bay lines, vault spring height and rise, gallery height | Constants at the top of `src/hall.js` (`HX`, `NX`, `ZL`, `SPRING`, `RISE`, `GY`) |
| Placement of every element | `buildHall()` at the bottom of `src/hall.js`, which reads like an assembly list |
| Sun direction, light positions and intensities, the seven viewpoints | `src/main.js` |
| Floor pattern tile and how it lines up with the columns | `floorInlay()` in `src/textures.js` |
| Prose summary of the plan | The "Process" section of the README |

The reasoning behind those numbers isn't in the repo. The only record is this session's transcript on your machine, which may not include the planning reasoning itself, and it isn't a document meant for reading.

If it would be useful, I can write a proper design document for the repo: a dimensioned floor plan and cross-section diagram, with the reasoning for each choice.

### Q2. how are the sunlight rays and volumetric lighting implemented

The sunlight is three separate effects that share one piece of data: a view of the hall rendered from the sun's position. Nothing is ray traced, and the shafts are added as a screen-space pass after the scene is drawn.

#### The shared setup: the sun's view

At load, `src/main.js` creates an orthographic camera placed along the sun direction and fitted to the hall's bounding box. Two textures are rendered from it once and reused every frame, since nothing in the scene moves:

- **Sun depth map (2048²):** the distance from the sun to the first surface it hits. Any point farther away than that value is in shadow.
- **Stained-glass colour map (4096²):** only the window glass, drawn with its stained-glass textures on a white background. It works like a slide in a projector: it records what colour the sunlight is after passing through each window.

The glass is excluded from the depth map, so light passes through window openings but is blocked by walls, tracery, columns and vaults.

#### 1. Sunlight on surfaces

This is a standard three.js directional light with its own shadow map (6144², also rendered once). The one custom part is in `src/materials.js`: every material's shader is patched so the sun's colour is multiplied by the stained-glass colour map at that point. That is what puts coloured pools on the floor and gallery.

#### 2. The visible shafts (volumetric lighting)

This is the `VOL_FS` shader in `src/post.js`, run as a full-screen pass at half resolution:

1. **Reconstruct the pixel's world position** from the scene's depth buffer, giving a ray from the camera to the visible surface.
2. **March along that ray in 44 steps.** At each step, project the sample point into the sun's view and compare against the sun depth map. If the point is lit, it contributes light; if it's shadowed, it contributes nothing.
3. **Weight each lit sample** by three things:
   - Fog density, which is varied by a slowly drifting 3D noise texture and is thicker near the floor, so the haze looks uneven and alive.
   - A phase function (Henyey-Greenstein, g = 0.62) that makes shafts brighter when you look toward the sun than across it.
   - The stained-glass colour at half strength, so shafts pick up a slight tint.
4. **Hide the stepping artefacts.** Each pixel starts its march at a slightly different offset (a per-pixel noise pattern that changes every frame), which turns visible banding into fine grain. A two-pass Gaussian blur then smooths the grain away.
5. **Composite.** The result is added on top of the scene before bloom, so bright shafts also glow.

A shaft, then, is just the set of air samples that can see the sun through a window; the dark gaps between shafts are samples shadowed by mullions, columns and walls.

#### 3. Dust motes

There are 2,600 drifting point sprites (`makeDust` in `src/main.js`). Each one checks the same sun depth map and is only drawn if it is in direct sunlight, so the dust glints inside the shafts and disappears outside them.

#### Limits of this approach

- The sun and geometry are fixed. Moving the sun would mean re-rendering the depth, colour and shadow maps.
- The fog is lit only by the sun. Lanterns, the throne glow and the dome light don't produce shafts; their glow comes from bloom.
- Scattering is single-bounce, and the fog does not darken the surfaces behind it by much.

### Q3. ok what about the vines and leaves, how did yuo understand how to arrange them and where to put them ?

I didn't place any of them by hand. I looked at where the ivy sits in your image, turned that into a few placement rules, and let seeded randomness fill in the detail. The same approach produced the vines carved on the columns.

#### What I took from the reference

In the image the ivy appears in one kind of place only: along the gallery balustrades. It grows in uneven clumps with bare gaps between them. Some of it drapes over the handrail and some starts at the balcony edge, and the strands hang anywhere from under a metre to about four metres. It is bushy at the top and thins to single trailing strands.

#### How the rules reproduce that

This is `buildIvy()` in `src/hall.js`:

- **Where:** the code walks along the same curve the balustrade is built on, on both sides of the hall, so the ivy follows every scallop of the balcony automatically.
- **Clumps and gaps:** it advances along the curve in random steps, with a 30% chance of skipping ahead to leave a bare stretch. Each stop spawns a clump of 7 to 18 strands, with a random "size" factor per clump.
- **Start height:** about 45% of strands start up on the rail, and the rest start at the slab edge. All are offset slightly toward the nave so they hang clear of the stonework.
- **Length:** the random number is squared before scaling, which gives many short strands and a few long ones.
- **Hang:** each strand drops straight down with a small random sideways drift, so it reads as hanging under gravity without being ruler-straight.
- **Leaves:** one cluster every 5.5 cm, with three leaves near the top, two in the middle and one near the tip. The scatter is wider at the top and leaf size shrinks toward the tip, which gives the "bushy top, thin tail" shape.
- **Variation:** every leaf gets a random rotation and a random green (mostly dark, with about 6% noticeably lighter ones for highlights).

The random generator is seeded, so the ivy is identical on every load. The result is about 45,000 leaves drawn as instances of a single 8-triangle leaf shape, plus thin tubes for stems.

The density was tuned by eye. My first version looked sparse in the screenshots, so I raised the number of clumps, strands and leaf size in the second pass.

#### The vines on the columns

These are stone and gold, built in the `column()` function, and they are placed mathematically, not randomly:

- **Marble strands:** two per column, wound as a helix in the opposite direction to the column's twist and half sunk into the surface so they read as raised carving.
- **Gold threads:** each column is a twisted, lobed shape, and the threads are run along the grooves between the lobes, so they follow the twist exactly.
- **Gold curls and leaves:** small spirals branch off the threads at random heights and sides, wrapped onto the column surface.

#### What it doesn't do

There is no growth simulation or collision checking, so leaves can pass through a rail or scroll. The ivy also grows only on the galleries; the image shows a little near a column on the right that I didn't reproduce separately.

### Q4. how did you attain the reflective marble flooring and the shiny golden stripes of the pattern on the floor

The floor is one flat plane. The gold comes from two drawn textures that tell the shader which pixels are metal, and the mirror-like reflection comes from rendering the hall a second time upside down each frame.

#### Gold stripes

`floorInlay()` in `src/textures.js` draws the pattern twice onto two 4096 × 4096 canvases, using the same strokes for both:

- **Colour canvas:** white marble background, with the lines stroked in gold (`#e9b24c`), dark stone or grey.
- **Material canvas:** the same shapes, but the colour encodes surface properties. The green channel is roughness and the blue channel is metalness.

| Region | Roughness | Metalness |
|---|---|---|
| Marble | 0.10 | 0 |
| Dark stone | 0.09 | 0 |
| Gold lines | 0.29 | 1 |

Because the gold pixels are flagged as fully metallic, three.js's standard physically based shader treats them as metal: they have no diffuse colour and their reflections are tinted gold. The marble pixels stay non-metallic, so their reflections are uncoloured and strongest at shallow viewing angles. That difference is why the stripes read as inlaid brass and not as yellow paint.

The pattern itself (medallion under the dome, rings around the columns, long borders, curved bands and spirals) is one 24 m × 20 m tile. It is mirrored on repeat, so it lines up symmetrically across the nave and from bay to bay.

#### Reflections

A standard environment map can't give correct reflections on a large flat floor, so the floor uses a planar reflection:

1. **Mirrored camera:** every frame, `renderReflection()` in `src/main.js` flips the camera to below the floor and renders the scene into a texture, with the floor itself hidden.
2. **Clipping:** the mirrored camera's projection is modified so nothing below floor level is drawn (an oblique near clip plane).
3. **Lookup:** the floor shader (the `floor` branch of `patch()` in `src/materials.js`) projects each floor pixel into that texture to find what it reflects.
4. **Blur:** it takes seven samples, spread further apart where the roughness is higher and stretched vertically. This softens the reflection slightly and smears it toward the viewer, as a polished but imperfect floor does.
5. **Fresnel:** on marble the reflection is about 5% when you look straight down and rises steeply toward grazing angles. On gold it is strong at every angle and multiplied by the gold colour.
6. **Veins:** the marble veining computed in the shader reduces the reflection by up to 25% and raises the roughness slightly, so veins look faintly duller than the polished stone around them.

The planar result replaces the environment-map reflection the standard shader would otherwise add, so the two don't stack.

#### Cost and limits

- The reflection pass draws the whole scene a second time, which is why the README lists 4.5 million triangles per frame against a 2.25 million triangle scene.
- The blur is a fixed seven-sample pattern, so reflections don't get progressively softer with distance from the reflected object as they would in a ray-traced floor.
- The floor is perfectly flat; there is no bump or tile relief, and the gold lines are flush with the marble.

### Q5. How did you go about buiding the cathedral roof structure from the image ?

I read the roof's type and proportions off the image, reduced it to one curve (a pointed arch), and generated every roof surface and rib from that curve on the floor-plan grid.

#### What I took from the image

- **Type:** the ceiling is a Gothic ribbed vault. Each column fans out at the top into ribs that cross the hall as pointed arches, with diagonal ribs meeting at a gold boss in the centre of each bay.
- **Rhythm:** one vault bay per pair of columns, repeated down the nave, with lower-looking side aisles behind the columns.
- **Height:** I judged it from the columns and the figure near the throne. The ribs start at about 15 m (where the column capitals end) and peak about 9 m higher, so the crown is at 24 m.
- **Dome:** the image shows a bright opening high up near the throne end. I interpreted that as a dome over a crossing; the image doesn't show it fully, so its shape is my design.

#### The one curve everything uses

`pointedArch()` in `src/geo.js` gives the height of a pointed arch at any distance from its centre, for a given half-span and rise. It is two circular arcs meeting at a point, which is how real Gothic arches are drawn. The window heads, the ribs and the vault surfaces all call it, which is why they agree with each other.

#### Vault surfaces

`vaultBay()` in `src/hall.js` builds one bay as a rectangle between four columns:

- **Shape:** for every point of the rectangle, the ceiling height is the higher of two pointed arches, one spanning the bay's width and one spanning its length. Where the two intersect, a crease forms along the diagonals. That is a groin vault, produced with no modelling of the creases.
- **Mesh:** a 36 × 36 grid, with points bunched toward the edges where the curve is steepest.
- **Diagonal ribs:** two marble tubes follow the creases just under the surface, thicker at the ends, each with a thin gold tube beneath it.
- **Boss:** a gold rosette (flattened spheres and a pendant cone) where the diagonals cross.

#### Arch ribs

`archRib()` makes the big arches between columns: a marble tube along the pointed-arch curve with a gold line on each side. They run across the nave, across the aisles, and lengthwise between columns and along the walls. The arches around the crossing are thicker.

#### Dome

`crossingDome()` replaces the vault in the 18 m square bay at the crossing:

1. **Pendentives:** part of a sphere that sits on the four corners of the square and is cut by a circle 8 m in radius, which turns the square into a round opening.
2. **Ring and drum:** a marble ring on that circle, then a 3.6 m cylinder with a gold relief band and 12 small arched windows.
3. **Shell:** a dome 6.5 m tall with 12 marble-and-gold ribs, ending in a glowing circular opening 2.2 m in radius.

#### Assembly

`buildHall()` loops over the bays, placing a nave vault and two aisle vaults in each (or the dome at the crossing), then the ribs along the bay edges. The surfaces use the `vault` material, which has faint carved filigree and weaker veining than the walls.

#### Differences from the image and from a real building

- The aisle vaults spring and peak at the same height as the nave, so it is a hall church layout. The image suggests this but doesn't show it clearly.
- The ribs in the image branch organically out of the tree-like columns. Mine are plain geometric arches that meet the capitals; only the capital fronds suggest branching.
- It is a single inner shell with no thickness, no outer roof and no structure above it. It is only meant to be seen from inside.

### Q6. Are there any skills or MCP servers that you used for this ? What MCP server did you miss the most while building this ?

**Skills:** none for the build. The only skill I loaded in this session was `claude-api`, later on, to get the Fable 5.2 pricing for the cost section of the README.

**MCP servers:** none. The whole build used the basic file and shell tools:

- **Read:** to look at the reference image and crops of it.
- **Write/Edit:** to write the code.
- **Bash:** to install three.js, run the local server, and drive headless Chrome with a small `playwright-core` script for the screenshots I iterated on. That was a script I wrote, not a browser MCP.

Three MCP servers were configured but played no part:

- **`fxhoudini`:** connected, with 177 Houdini tools. I didn't use it.
- **`playcanvas`:** shows as failed to connect in this session. I can't confirm from what I have whether it was also down during the build.
- **Claude Docs:** not relevant to a 3D scene.

#### What would have helped most

The Houdini server, which was available and which I didn't use. The weakest parts of the result are the ones that need sculpted detail: the throne (which reads as ribbons, not dense interwoven carving), the relief on walls and columns, and ribs that branch organically out of the tree columns. Those are hard to write as formulas in JavaScript and are what Houdini is good at. Modelling them there and exporting glTF would likely have closed most of the gap to the reference.

The trade-off is that the scene would no longer be "fully procedural, no asset files": it would ship model files, need Houdini running to rebuild, and have a larger download.

Of things that weren't available, a working PlayCanvas connection would have mattered least; the engine wasn't the limit. A browser MCP would have saved a few minutes of scripting, but the Playwright script did the same job.

### Q7. One last thing - how were the arching windows coded up ?

Every window is described by five numbers, and two functions in `src/hall.js` turn that description into a hole in the wall, a pane of glass, stone tracery and a frame.

#### The description

A window is a small record: centre position along the wall, width, sill height, the height where the arch starts, the arch's rise, and the number of lights (the tall panes between the stone bars). The two standard ones are:

| | Width | Sill | Arch starts | Rise | Lights |
|---|---|---|---|---|---|
| Upper window (`upWin`) | 4.6 m | 9.3 m | 16.2 m | 5.2 m | 3 |
| Lower window (`lowWin`) | 4.6 m | 1.35 m | 3.5 m | 2.5 m | 3 |

The apse uses narrower two-light windows and the west wall has one 9 m wide, five-light window above the door.

#### The outline

`archOutline()` in `src/geo.js` turns that record into a closed 2D outline: up the left side, over the pointed arch, and down the right. The arch uses the same `pointedArch()` curve as the roof ribs. Everything below is built from this outline.

#### The wall

`wall()` draws each wall as a flat rectangle, adds every window outline (and the door) as a hole, and extrudes it 1.5 m thick. The extrusion gives the deep stone reveals around each opening without any extra modelling.

#### Each window

`addWindow()` then fills each hole with four layers:

1. **Glass:** the outline filled as a flat pane, set a little past the middle of the wall thickness. Its texture coordinates are stretched to the window's bounding box so the stained-glass image fits any window size.
2. **Tracery:** the outline again, with holes cut out of it and extruded 0.2 m as a stone screen in front of the glass:
   - one small pointed arch per light, separated by 13 cm stone bars;
   - a circular opening above them, sized to fit under the main arch, with a ring and six spokes inside to make a simple rose.
3. **Mouldings:** a marble tube and a thinner gold tube swept along slightly enlarged copies of the outline on the interior wall face.
4. **Sill:** a marble block under the opening.

#### Placement and glass

- **Placement:** `buildHall()` loops over the bays and puts an upper and a lower window in each side-wall bay (two of each in the longer crossing bay). Each wall has a transform matrix, so the same code works for side walls, end walls and the seven angled apse walls.
- **Glass image:** `stainedGlass()` in `src/textures.js` draws it on a canvas: a diamond lattice of leaded panes with a mirrored tree, leaves, stars and a gold border.
- **Sun side and shade side:** the glass doesn't transmit light physically. It is an unlit material brighter than white so it glows and blooms, with brighter, warmer versions on the sunlit wall and cooler, dimmer ones on the opposite wall.

The coloured light the windows cast on the floor comes from the separate sun-view render of the glass that I described under the lighting question, not from the window meshes themselves.

#### Limits

- The tracery is one fixed design (lancets plus one rose) scaled to each window; the reference shows more flowing, varied tracery.
- The tracery screen has square edges, with no chamfer or moulded profile on the bars.
- All windows of one type share one glass image.

### Q8. And did you have to use mesh boolean operations and parametric curves for this ?

**Mesh booleans: no.** There is no boolean (CSG) operation anywhere in the scene.

The openings are made in 2D instead. Each wall is a flat outline with the window outlines registered as holes, and three.js triangulates that shape with the holes already in it (using its built-in ear-clipping triangulator), then extrudes the result to the wall's thickness. The tracery works the same way: a window-shaped outline with lancet and circle holes, then extruded. Cutting holes in a 2D shape before extruding is cheaper and more reliable than subtracting one 3D mesh from another, and it gives clean edges with no leftover slivers.

The limit of this approach is that it only handles openings that go straight through a flat wall. A window cut into a curved wall, or a niche that goes only partway in, would need real booleans or a different construction. The apse avoids this by being seven flat wall panels and not one curved wall.

**Parametric curves: yes, throughout.** Nearly all the geometry is curves evaluated by formula and sampled into points:

- **Pointed arch:** an analytic function (two circular arcs) giving height from horizontal distance. It drives the window outlines, door, ribs and vault surfaces.
- **Smooth splines:** the tube helper passes a Catmull-Rom spline through a list of points and sweeps a circle along it. This makes the ribs, mouldings, column vines, gold threads, balustrade rails, throne ribbons and ivy stems.
- **Spirals and helices:** the curls on the columns, balustrade scrolls and throne roots are spirals; the column vines are helices wrapped around the trunk.
- **Bézier curves:** the ogee panels behind the throne and the flowing bands in the floor and glass textures.
- **Profile curves:** balusters, capitals, lanterns and bases are a 2D profile revolved around an axis.

The same idea extends to surfaces. The column trunks, vaults and domes are parametric surfaces: a function of two parameters gives each point, and a helper samples it into a grid of triangles and computes the normals.
