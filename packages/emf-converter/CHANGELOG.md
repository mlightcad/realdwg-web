# @mlightcad/emf-converter

## 1.15.3

### Patch Changes

- fix: corrects DXF import for DIMENSION block insertion, VIEWPORT width/height, hatch colors, multileader arrowhead size from CONTEXT_DATA, and $DWGCODEPAGE encoding for binary and legacy ASCII DXF. ATTRIB/ATTDEF ignore embedded Xrecord flags, and model space stays findable when it claims handle 2

## 1.15.2

### Patch Changes

- fix: maps OCS geometry into WCS so TRACE and SOLID corners convert correctly and entities with extrusion (0,0,-1) land in world space. Rendering cache is kept across convert finish so drawings do not drop cached graphics when conversion completes

## 1.15.1

### Patch Changes

- feat: paints wipeouts with the layout background fill so covered geometry stays hidden. DXF export expands XData points and binary chunks, and attribute definitions keep their owner ids when block table record handles collide. Imported XData is stored in a compacted form that uses less memory

## 1.15.0

### Minor Changes

- fix: aligns DWG converter license failure markers with the current @mlightcad/dwg-converter messages so expired evaluation and invalid license key errors classify correctly as license_expired and license_invalid instead of falling through as generic open failures

## 1.14.14

### Patch Changes

- feat: vendors emf-converter as the @mlightcad/emf-converter workspace package and exposes raster image and OLE frame properties so the property palette can edit them. Missing image paths draw without MTEXT control codes, and DWG import no longer aborts when handles are assigned before attributes
