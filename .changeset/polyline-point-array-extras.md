---
'@mlightcad/data-model': patch
---

`acdbPointArrayProperty` accepts optional `extraFields` for per-vertex floats (bulge, widths). `AcDbPolyline` and `AcDb2dPolyline` vertex properties now use that helper so copies stay consistent with other point arrays.
