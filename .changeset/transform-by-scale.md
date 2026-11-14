---
'@mlightcad/data-model': patch
---

Make `transformBy` behave like AutoCAD SCALE / MOVE / ROTATE / MIRROR for every entity.

- Hatch: explicit pattern definition lines (used by DWG/DXF-loaded hatches) now move, rotate and scale with the boundary.
- Arc: start/end angles are kept as OCS angles after any transform (they were reset to 0 / sweep); mirroring swaps the ends instead of flipping the normal.
- LWPOLYLINE / 2D polyline / 2D vertex: widths scale; OCS vertices are transformed correctly for non-+Z normals; bulges flip on mirror.
- Thickness scales on lines, points, circles, arcs, polylines, traces and solids; normals stay unit length.
- MText: defined annotation height, column width and gutter scale.
- Block reference / table: mirrored scale factor signs are preserved and the normal no longer flips to -Z.
- Leader / MLeader / MLine: direction and normal vectors stay unit length; text height, arrowhead size, landing gap, dogleg length, content scale and MLine scale scale with the matrix.
- Raster image / wipeout: grips, extents and drawing honor negative and clipped rotation.
- Dimensions: the cached block scales with the definition points until `recomputeDimBlock()` regenerates it at dimension-style size; the measurement and radial/diametric leader length update.
