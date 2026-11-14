---
'@mlightcad/data-model': patch
---

Make dimension grip edits behave like AutoCAD for every dimension type and add `AcDbDimension.recomputeDimBlock()` to regenerate the anonymous dimension block after editing.

- Linear (rotated) dimensions keep their rotation; aligned dimensions follow their extension line origins. Both expose AutoCAD's five grips (two origins, two dimension line ends, text), and dimension line grips only move the line along its normal.
- The text grip honors DIMTMOVE (0 moves the dimension line with the text, 1 adds a leader, 2 moves the text alone). The user-defined text position (DXF 70 bit 128, `isUsingDefaultTextPosition`) is kept when the block is rebuilt.
- Radius and diameter chord grips slide around the circle; dragging their text swings the dimension toward it and sets the leader length. Arc length origins stay on the arc. Angular and arc length text moves the dimension arc. Ordinate text moves the leader end point.
- Rebuilt blocks use a freshly computed measurement. New helpers `acdbAllocateDimBlockName` and `acdbDisposeDimBlock` are exported.
