# Independent NASA science layers

These images are **not composited with surface imagery or with one another**. Their colors encode the respective measurements, not human safety. No-data is opaque gray (`#1d2126`). Native bin/pixel resolution is retained; no upscaling creates fictitious detail.

## Water-equivalent hydrogen

- NASA Odyssey GRS, PDS `ODY-M-GRS-5-ELEMENTS-V1.0`, `H2O_2X2`, product version 2.0.
- Native bins 2° × 2°, rendered 180 × 90 with unmeasured/masked poles retained.
- Source: https://pds.nasa.gov/ds-view/pds/viewDataset.jsp?dsid=ODY-M-GRS-5-ELEMENTS-V1.0
- Original table: https://pds-geosciences.wustl.edu/ody/ody-m-grs-5-elements-v1/odgm_xxxx/data/unsmoothed/2x2/h2o_2x2.tab
- Weight percent water equivalent. This is not a confirmed accessible ice-depth map. GRS effective footprint is approximately 300 km; 2° bins do not imply independent 118 km measurements.

## Chlorine

- Same NASA GRS dataset, `CL_5X5`, product version 2.0.
- Native bins 5° × 5°, rendered 72 × 36.
- Original table: https://pds-geosciences.wustl.edu/ody/ody-m-grs-5-elements-v1/odgm_xxxx/data/unsmoothed/5x5/cl_5x5.tab
- Weight percent **total chlorine**, not perchlorate or a chemical toxicity classification.

Both JSON grids preserve PDS spectral-fit results in `rawValues`, including negative fits. `values` excludes those physically unrepresentable negative abundances. Missing and excluded values are `null`; `sigma` retains correction-factor-inclusive errors. No interpolation is used to fill gaps. Original detached PDS labels accompany these products.

## Thermal inertia

- NASA MGS TES, `MGS-M-TES-5-TIMAP-V1.0`, `GLOBAL_TI_NIGHT_2007`.
- Full native 7200 × 3600 display image, 20 pixels/degree (~2.96 km equatorial).
- Source: https://pds.nasa.gov/ds-view/pds/viewProfile.jsp?dsid=MGS-M-TES-5-TIMAP-V1.0
- Original image: https://pds-geosciences.wustl.edu/mgs/mgs-m-tes-5-timap-v1/mgst_9001/data/global_ti_night_2007.img
- Original interpolation mask: https://pds-geosciences.wustl.edu/mgs/mgs-m-tes-5-timap-v1/mgst_9001/data/global_ti_msk_night_2007.img
- Unit: J m^-2 K^-1 s^-1/2. This is a material thermal-response property, **not temperature**. The original mask excludes archive-interpolated values; zero and invalid values are also no-data.
- Numeric inspection JSON samples every tenth pixel, explicitly 720 × 360; display image retains every native pixel. The manifest provides the exact nonuniform color scale.

All maps use equirectangular coordinates: west −180°, east +180°, north +90°, south −90°, row-major north-to-south, pixels at bin centers. Sampling coordinates are `lon = -180 + (x+0.5)*360/width`, `lat = 90 - (y+0.5)*180/height`.

## Unavailable hazard layers

NASA's historical radiation illustration PIA03480 is not a georeferenced quantitative raster, and its colors have not been reverse-engineered into dose values. NASA RAD data are local/time-dependent. The TES temperature sampler comprises dated annotated GIFs rather than a global route-ready numerical field. These remain source-only unavailable entries. Thermal inertia is not silently substituted for temperature; chlorine abundance is not silently converted to toxicity. Safe exposure thresholds depend on mission, duration, shielding and equipment and have not been established by these datasets.
