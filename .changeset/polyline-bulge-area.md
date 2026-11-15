---
'@mlightcad/geometry-engine': patch
'@mlightcad/data-model': patch
---

Measure polyline area exactly instead of tessellating bulged arcs.

- `AcGePolyline2d.area` no longer requires three vertices, so a closed two-vertex LWPOLYLINE with `bulge = 1` on both vertices (a circle or a DONUT centerline) reports `PI * r * r` instead of `0`.
- Bulged segments contribute the exact circular-segment area, so a closed two-vertex semicircle reports `12.5 * PI` for a diameter-10 chord, and mixed line/arc polylines no longer lose the tessellation error of the previous 128-point approximation.
- `AcDbPolyline.area` and `AcDb2dPolyline.area` follow through their delegating getters.
