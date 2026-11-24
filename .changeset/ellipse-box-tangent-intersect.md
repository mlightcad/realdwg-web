---
'@mlightcad/geometry-engine': patch
'@mlightcad/data-model': patch
---

Fix `AcGeEllipseArc3d` bounding box for rotated full ellipses stored with equal start/end angles (AutoCAD convention): it collapsed to a single point, so `geometricExtents` was wrong and `intersectWith` missed every intersection with such ellipses. The box is now computed exactly from the axis extrema. Line–circle and line–ellipse intersections also detect tangency with a length-based tolerance, so a tangent line reports exactly one point at large world coordinates instead of none or two.
