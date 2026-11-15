---
'@mlightcad/data-model': patch
'@mlightcad/libredwg-converter': patch
---

Keep DWG linear, diameter and radius dimensions looking like AutoCAD after their block is regenerated (SCALE, grip edits).

- libredwg-converter: DIMENSION_LINEAR, which libredwg-web reports with the aligned subclass marker, is now read as `AcDbRotatedDimension` based on the dimension type. Its rotation comes from the definition points, because libredwg-web reports the block insert rotation instead of the dimension rotation.
- data-model: diametric and radial dimensions whose text sits at a user position keep that position when the block is rebuilt. Horizontal text (DIMTIH / DIMTOH) gets AutoCAD's layout: one arrowhead, a dimension line up to the text height and a one-arrow-size horizontal landing.
