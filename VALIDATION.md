# Validation — 14 November 2026

## 15 November update

- Replaced the coarse global elevation display with the local NASA MOLA 128-ppd signed-metre tile pyramid, with 512-ppd NASA polar source coverage resampled only for the outer polar caps.
- Added independently derived, true-scale normal maps from the MOLA height gradients. Surface color, topography, CTX, water-equivalent hydrogen, chlorine, and thermal-inertia maps remain separate selectable layers.
- Replaced the temporary destination overlay with editable route start/destination controls, map-point picking, a cancelable PHP terrain route request, and a route/dot overlay in both map views.
- Fixed 3D terrain patch material replacement during arrival. All terrain patches retain the selected local NASA layer while the terrain quadtree changes.
- Removed the opening color inversion. Added a 2,500 km 3D camera floor and per-layer 2D zoom floors to avoid visibly enlarged global imagery.

## Passed

- PHP 8.4.14 CLI: syntax checks for index.php, api.php and RoutePlanner.php.
- Eight routing tests: absent data, flat-grid shortest path, hazard detour, chemical barrier, combined independent barriers, incomplete mask, steep height barrier, non-NASA provenance rejection.
- HTTP page response 200 from the actual PHP development server.
- Actual route endpoint: valid coordinates return explicit unavailable coverage; out-of-range latitude returns HTTP 400.
- In-app browser: opening rendering, Free Roam, return, landmark suggestions, coordinate navigation, location marker, English/Turkish switching, HUD, synchronized surface/topography selection, route coverage feedback.
- No browser console errors observed on the final reload.
- At a 390 × 844 CSS viewport, document scroll width equals viewport width (no horizontal overflow).
- NASA MOLA source values preserved as numeric elevations; image layer is a documented elevation color rendering.

## Remaining limitations

- High-resolution terrain streaming and rock-scale observed normal maps are not implemented. Global MOLA is approximately 14.8 km per pixel at the equator; the display mesh is a coarser visualization sampled from it.
- No validated chemical, radiation or heat safety rasters have been loaded. Real safe-route calculation therefore remains unavailable. Synthetic tests verify algorithm behavior, not scientific validity.
- Pinch logic is implemented but was not tested on physical touch hardware.
- The camera curve is a documented smooth bounded approximation, not the ambiguous 1/nx formula in the initial brief.
- The 3D camera floor deliberately supersedes the earlier 100 m target because the available global imagery cannot support a close, non-pixelated inspection. The enlarged 2D map is the closer inspection surface.
- No public PHP hosting was configured. The deliverable is a local PHP project with deployment instructions.
