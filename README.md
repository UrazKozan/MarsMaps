# Mars Maps

**Mars Maps** is an interactive, bilingual (English/Turkish) web map for exploring Mars in 3D and 2D. It was created for the NASA Space Apps Challenge's *Interplanetary Survival Guide: Martian Map* challenge.

**Live site:** [marsmaps.onrender.com](https://marsmaps.onrender.com)

> This is an educational prototype. Its route output is a terrain-aware candidate route, not an approved human, rover, or mission safety plan.

## What it does

- Renders a synchronized 3D Mars globe and enlarged 2D map.
- Lets users search for landmarks or coordinates, place locations, and plan a route between them.
- Offers separate selectable map layers rather than blending scientific datasets together.
- Uses a PHP route service that assesses terrain slope and local relief, with vehicle and cargo profiles.
- Shows route dots and a smooth visual route on both maps.
- Includes a Free Roam mode with clickable NASA-sourced landmarks, English and Turkish descriptions, source links, and available image references.
- Includes a hazard-assessment interface. It makes clear which layers are informational and which are actually used by the prototype route calculation.
- Plays optional ambient and route-found audio; the site remains usable if audio is blocked by the browser.

## Important safety and science limits

Mars Maps must not be used for real navigation, life-safety decisions, or mission planning.

- The route algorithm uses **terrain slope and local relief only** as movement constraints.
- Water-equivalent hydrogen, chlorine, and thermal-inertia layers are displayed as scientific context. They do **not** have a mission-approved safe/unsafe threshold in this application.
- Radiation and surface-temperature illustrations are intentionally excluded from the selectable map layers when they are not calibrated, georeferenced global navigation rasters.
- Global terrain cannot represent rocks, sand properties, landing hazards, traverseability, local weather, or time-dependent radiation.
- `Complete safety` mode returns unavailable rather than pretending that missing chemical, radiation, or heat data are safe.

The conservative walking slope limit is `rise/run = 0.8` for light cargo. Vehicle and heavier-cargo limits are more restrictive. These are prototype assumptions, not NASA operational limits.

## Data sources and layers

All scientific data and landmark references are NASA, NASA PDS, NASA/JPL, or NASA-linked mission-service sources. Source links are also shown in the app's Sources panel.

| Layer or feature | Dataset / provider | How Mars Maps uses it |
| --- | --- | --- |
| Terrain elevation and normal maps | [NASA PDS MGS/MOLA MEGDR](https://pds-geosciences.wustl.edu/missions/mgs/megdr.html) | Signed-metre elevation, terrain shading, local slope, and relief calculations. |
| Color shaded relief | [NASA Trek MOLA Global Color Shaded Relief](https://trek.nasa.gov/tiles/Mars/EQ/Mars_MGS_MOLA_ClrShade_merge_global_463m/1.0.0/WMTSCapabilities.xml) | Selectable topographic visualization; it is not mixed into the surface layer. |
| Surface imagery | [NASA Trek Viking MDIM21 color mosaic](https://trek.nasa.gov/tiles/apidoc/trekAPI.html?body=mars) | Selectable global visual surface layer. |
| CTX imagery | [NASA-linked MRO CTX service metadata](https://astro.arcgis.com/arcgis/rest/services/OnMars/CTX/MapServer?f=pjson) | Separate regional grayscale imagery layer, streamed only to its native useful resolution. |
| Water-equivalent hydrogen and chlorine | [Mars Odyssey GRS, NASA PDS](https://pds.nasa.gov/ds-view/pds/viewDataset.jsp?dsid=ODY-M-GRS-5-ELEMENTS-V1.0) | Informational abundance layers only. |
| Night thermal inertia | [MGS TES thermal-inertia map, NASA PDS](https://pds.nasa.gov/ds-view/pds/viewProfile.jsp?dsid=MGS-M-TES-5-TIMAP-V1.0) | Informational material-property layer; not temperature. |
| Day thermal-inertia visualization | [NASA Mars OWeb TES image](https://marsoweb.nas.nasa.gov/globalData/images/fullscale/TES_original.jpg) | Separate user-requested visualization; not used for routing. |
| Radiation illustration | [NASA Photojournal PIA03480](https://science.nasa.gov/photojournal/estimated-radiation-dosage-on-mars/) | Retained as source material only; not rendered as a navigable quantitative map. |

The bundled `elevation-16.bin` is a 16-pixels-per-degree overview derived from MOLA data. A local development checkout may also contain an optional 128-pixels-per-degree MOLA tile cache. That roughly 2 GB cache is excluded from Git and is not required for the hosted site to run; the PHP route service detects its absence and uses the bundled overview instead.

## Run locally

### Requirements

- PHP 8.1 or newer
- A modern browser with WebGL enabled

From the project directory:

```sh
php -S 127.0.0.1:8080 -t public
```

Then open [http://127.0.0.1:8080](http://127.0.0.1:8080).

On macOS, `Start.command` performs the same task and looks for a PHP executable. If macOS blocks it, allow it in System Settings or run the command above in Terminal.

## Deploy on Render

The repository includes `render.yaml` and a `Dockerfile`. Render runs PHP's built-in server as a read-only hackathon demo server.

1. Push the desired commit to the Git branch connected to Render.
2. In Render, create or connect a **Web Service** using this repository.
3. Choose the Docker runtime. The included configuration listens on Render's `PORT` automatically.
4. Confirm the health check path is `/` and deploy.

When diagnosing routes, Render logs should show these server messages after a route button press:

```text
Route request: <start latitude>,<start longitude> -> <end latitude>,<end longitude>
Route result: <status> in <seconds>s
```

If no `Route request` line appears, the browser did not reach `api.php`; inspect the browser console and make sure the new deployment finished. If a result takes too long, try nearby locations first—the route search is intentionally bounded.

## Project layout

```text
public/
  index.html              Browser interface
  api.php                 PHP JSON route endpoint
  assets/                 UI, maps, audio, source manifests, translations
src/
  GlobalRoute.php         Terrain-aware global candidate route search
  MarsRaster.php          Efficient numerical MOLA raster reader
  RoutePlanner.php        Synthetic-grid routing test implementation
tests/route-test.php      Algorithm tests using synthetic fixtures only
tools/build_mola_tiles.py Optional local MOLA tile preparation utility
Dockerfile                Render container entry point
render.yaml               Render service definition
```

## Route API

`POST /api.php?action=route`

Example request:

```json
{
  "start": { "lat": 18.44463, "lon": 77.45088 },
  "end": { "lat": 18.0, "lon": 77.0 },
  "mode": "terrain",
  "vehicle": "feet",
  "cargoKg": 10
}
```

The response contains a `status`, route points when a terrain candidate is found, distance, ascent, sampled slope, estimated travel time, source-resolution metadata, and an explicit statement of unassessed hazards. HTTP validation errors return a JSON `error` message.

## Tests

With PHP installed, run:

```sh
php tests/route-test.php
```

The test suite uses synthetic grids to test route-search behavior. It does not validate scientific safety or turn the hazard layers into approved operational data.

See [VALIDATION.md](VALIDATION.md) for the recorded validation history and remaining limitations.

## License

See [LICENSE](LICENSE). NASA names, mission data, and imagery remain subject to their respective terms and attribution requirements.

