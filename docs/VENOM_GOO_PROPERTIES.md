# Venom goo: properties and how we build each one

This is what the symbiote material and its tendrils have to do. Each property
comes from your feedback, film VFX write-ups, the mockup, or the physics of
real viscoelastic fluids. Next to each one is the technique that delivers it in
this project. Sources are listed at the end.

## A. Surface: how it looks up close

| # | Property | Evidence | How we build it |
|---|---|---|---|
| A1 | **Semi-dry, not chrome.** The gloss is uneven: wet in some patches, satin in others, looking smeared | DNEG on Venom: fully shiny looked like "black chrome", so they used "a semi-dry look ... not consistently the same wet look all over ... smeared and organic". Your note: "too much shiny ... not enough roughness" | Per-pixel *smear* noise drives the base roughness (about 0.25–0.65), the clearcoat strength (about 0.25–1) and the clearcoat roughness. Low-frequency, so it reads as patches of wet and drier goo |
| A2 | **Micro relief.** Ripples, pores and creases break highlights into flecks instead of mirror lines | The mockup's highlights are short, broken specks of blue-white light. Your note: "not enough textures ... smooth and shiny" | A procedural bump: layered 3D noise as a height field, perturbing the normal (Mikkelsen's surface-gradient bump, as three.js does it). It fades out where it would alias |
| A3 | **Fibrous striations along tendrils.** They look like stretched muscle rope, not smooth pipes | Film tendrils are "thick, muscular ropes"; Carnage's tendrils use procedural organic textures | On tubes the noise is stretched along the strand (long in length, tight around the circumference), giving grooves that run along each tendril |
| A4 | **Slowly flowing surface** | "Flowing tar" layered over the animated tendrils (Digital Domain); "complex rolling motion" of folding tissue (DNEG) | The noise on the mass drifts slowly through space, so the surface seems to crawl. The body's lumps churn too |
| A5 | **Dark cavities.** Folds, crotches and the spaces between merged strands go nearly black and lose their reflections | Porous layers revealing depth (DNEG). In the mockup, cavities are pure black and only the outer lips catch light | Ambient occlusion from the density field: for every vertex the worker checks how much goo lies just outside it and darkens its reflections to match |
| A6 | **Mostly shadow, with rim and streak highlights** | Carnage: "strong rim lighting while keeping most of his body in the shadows". Wraith Venom: "tight highlights" from small lights placed along the key | A dimmer exposure, a softer and darker studio environment, cool rim strips from behind, and fewer, smaller kicks |
| A7 | **Cool blue-violet tint in the highlights only**; the body itself stays black | The mockup; DNEG gave Wraith iridescence | The faint iridescence stays, and the strip lights are cool white |
| A8 | **Porous, holed membranes** | DNEG's "porous final look" | Holed webbing and the perforated shell (already built) |

## B. Matter: how the goo behaves as a fluid

| # | Property | Evidence | How we build it |
|---|---|---|---|
| B1 | **Fusion on contact.** Strands that touch merge into one | Image Engine: tendrils "mesh together when they collide, giving a liquid-like behaviour" | An implicit-surface soft union (already built). Now it's driven *dynamically* by the bundles in B2 |
| B2 | **Many into one, then one into many, over time.** Several strands zip into one wide rope, then the wide rope unzips back into several | Your note. Slime moulds fuse, thicken, prune and split their tubes continuously (Physarum network studies). Carnage's rig let tendrils "branch out and morph into multiple ... tips" | **Bundles**: groups of 2–4 neighbouring strands, plus every fork's arms. Each bundle runs its own zip cycle: a *zip front* travels outward along the strands, pulling them onto a shared centre line (they fuse into one thicker rope), holds, then travels back (the rope splits starting at its tip). Some bundles zip from the root, some from the middle (braids) |
| B3 | **Volume is conserved.** A fused rope is wider than each strand; a stretched string gets thinner | Bridge physics: R²·L stays constant while a liquid bridge stretches | Fused strands' density adds, so the rope grows wider. Each string's radius follows r = √(V / πL) |
| B4 | **Sticky: strings form when goo separates** | Your note: "the sticky nature of venom isn't there". The films' "strands of goo between the jaws"; "disgusting drool"; "webs of gooey tentacles" | **Goo strings** spawn wherever goo comes apart: between strands as a bundle unzips, between tips that touched and then separated, and between an arm and the cursor when it lets go |
| B5 | **Strings thin, form beads, and resist breaking** | Viscoelastic filaments thin into *beads on a string* and break late, because polymers resist stretching | As a string stretches, its middle thins (B3). Below a threshold, evenly spaced beads swell along it and the middle keeps thinning exponentially |
| B6 | **Snap and recoil** | Bridges break once thin enough; elastic goo springs back | When a string breaks, it becomes two tails that whip back to their anchors and are absorbed, each ending in a bead |
| B7 | **Sag under its own weight** | A string between two points hangs; drool drips | Strings sag in proportion to how slack they are, and wobble on springs |
| B8 | **Viscous, heavy motion, but with intent** | "Weight and intent", not like snakes, not saggy (Image Engine). Non-Newtonian references (2018 film) | Damped springs with per-strand viscosity. Reaches are committed motions, not drifting |

## C. Behaviour: how the tendrils act

| # | Property | Evidence | How we build it |
|---|---|---|---|
| C1 | **Every tendril has its own equations**: its own frequencies, phases, amplitudes, viscosity and temperament | Your note: "they all should have individual equations n maths so that everyone acts different". Octopus arms are each run by local ganglia, like "mini brains" | Each tendril gets a *motion genome*, a set of motion modes with its own coefficients: <br>• a travelling curvature wave in two axes <br>• a slow Lissajous sway of the whole arm with its own frequency ratio <br>• curl breathing (curling and uncurling) <br>• random twitches at its own rate <br>• peristaltic bulges running outward <br>Its temperament (bold, curious, nervous, lazy) scales how strongly and how often each of these happens |
| C2 | **Shared pattern: attend to the cursor** | The spec: the cursor perturbs the creature's life rather than controlling it | Every tendril senses the same stimulus (the cursor's nearness and the direction it faces) |
| C3 | **Not all at once: if some are already on it, the others don't follow** | Your note. Insect colonies: an individual takes on a task when the stimulus exceeds its threshold, and those already working *reduce* the stimulus others feel (the Bonabeau response-threshold model) | **Response thresholds**: each tendril has a threshold θ. Each one engaged lowers the stimulus the rest feel, so only 2–3 commit. Decisions run at each tendril's own reaction time, so they don't fire together. **Fatigue** raises the threshold of a tendril that has been holding, so it lets go and another takes over (they take turns) |
| C4 | **The rest still notice** | A living thing: some watch, some carry on, some guard | Tendrils that aren't engaged but face the cursor *lean* toward it a little (watching). Nervous ones hold back. The others carry on with their own motion |
| C5 | **Reaching is a bend travelling from base to tip** | In octopus reaching, "a bend propagates ... from the base of the arm toward the tip" | A reach front moves from root to tip at the tendril's own speed, and only the part behind the front has committed to the reach. Letting go runs the front back from tip to root, which reads as recoil |
| C6 | **Grab and coil** | The reel; Carnage's tendrils "tighten around a victim like a vine" | Irregular, tilted coils around the cursor (already built) |
| C7 | **Startle** | Shy creatures flinch | A fast cursor makes nervous tendrils recoil and causes engaged ones to let go, unless they're bold |
| C8 | **Mood changes stiffness** | Carnage's tendrils turn "rigid and sharp" in aggressive poses | While engaged, a tendril's springs stiffen and its own idle motion is damped, so it moves with purpose. When calm, it's loose and floppy |

## Out of scope for this pass
- Translucency or a subsurface look (Venom is opaque black)
- Full fluid simulation (too heavy for real time; the effects above stand in for it)
- The page UI from the mockup

## Sources
- DNEG on Venom (2018): [Cartoon Brew](https://www.cartoonbrew.com/feature-film/venom-what-happens-when-the-creature-you-have-to-create-is-so-many-different-things-165024.html)
- Venom (2018) FX layering, goo and drool: [The Credits](https://www.motionpictures.org/2018/10/vfx-artists-explain-how-they-made-venom-scary-as-hell/)
- Venom: The Last Dance: [DNEG](https://www.dneg.com/news/just-what-the-alien-symbiote-ordered-a-closer-look-at-our-work-on-venom-the-la), [Digital Domain (AWN)](https://www.awn.com/vfxworld/digital-domain-gets-symbiotic-venom-last-dance)
- Carnage tendrils: [Image Engine](https://image-engine.com/case-studies/venom-let-there-be-carnage/)
- Beads on a string and viscoelastic pinch-off: [APS 2009](https://archive.aps.org/dfd/2009/hn/4), [arXiv 2512.21059](https://arxiv.org/html/2512.21059v1), [JFM](https://www.cambridge.org/core/journals/journal-of-fluid-mechanics/article/transition-to-elastocapillary-thinning-dynamics-in-viscoelastic-jets/14B338C1654BD4DA0F6D79F415A54FDC)
- Liquid bridge thinning and volume conservation: [Wash U](https://profiles.wustl.edu/en/publications/extensional-flow-of-low-viscosity-fluids-in-capillary-bridges-for/), [Soft Matter 2026](https://pubs.rsc.org/en/content/articlehtml/2026/sm/d6sm00314a)
- Octopus bend propagation and arm autonomy: [Control-oriented modeling](https://ar5iv.labs.arxiv.org/html/2110.07211), [PMC6793066](https://pmc.ncbi.nlm.nih.gov/articles/PMC6793066)
- Slime mould fusion and remodelling: [Patino-Ramirez et al.](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC7810851/), [Tero model slides](https://www.informatics-europe.org/images/ECSS/ECSS2017/Slides/ECSS2017_Mehlhorn2.pdf)
- Response-threshold division of labour: [Bonabeau et al.](https://pmc.ncbi.nlm.nih.gov/articles/PMC1688885), [Theraulaz, Bonabeau and Deneubourg (1998)](https://ideas.repec.org/p/wop/safiwp/98-01-006.html)
- Procedural bump mapping: [Mikkelsen's surface gradient (via three.js)](https://mmikk.github.io/papers3d/mm_sfgrad_bump.pdf), [Unreal: bump without tangent space](https://dev.epicgames.com/documentation/en-us/unreal-engine/bump-mapping-without-tangent-space-in-unreal-engine)
- Wet-look pitfalls (a uniform gloss reads as oil or plastic): [OTOY forum](https://render.otoy.com/forum/viewtopic.php?p=212339)
