---
'@mlightcad/data-model': patch
---

fix(data-model): create layers that entities reference but the LAYER table lacks

Drawings whose entities point at undeclared layers (for example R12 DXF files
without a TABLES section) lost those entities in viewers, which only create a
layer group on `layerAppended` ("layer 'FRAME' doesn't exist!").
`AcDbBlockTableRecord.appendEntity` now adds such layers with AutoCAD's defaults
(color 7, Continuous, on, thawed) before `entityAppended` fires, as AutoCAD does
on load. See mlightcad/cad-viewer#901.
