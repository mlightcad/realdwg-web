---
'@mlightcad/data-model': minor
'@mlightcad/geometry-engine': minor
---

Add ObjectARX-style curve parameter, split and extend APIs. `AcDbCurve` gains `startParam` / `endParam`, `getParamAtPoint`, `getPointAtParam`, `getClosestPointTo`, `getDistAtParam`, `getSplitCurves`, `getSplitCurvesAtPoints`, `extend` and `extendToPoint`, implemented for lines, arcs, circles, ellipses, polylines (LWPOLYLINE, 2D, 3D), rays, xlines and splines. geometry-engine adds NURBS knot insertion, split, join and closest-parameter helpers (`acgeNurbs*`).
