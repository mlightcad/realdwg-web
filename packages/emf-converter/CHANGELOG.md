# @mlightcad/emf-converter

## 1.15.19

### Patch Changes

- fix: honors per-entity DSTYLE overrides on dimensions, leaders, and tolerance frames so Properties palette edits survive import. Leaders expose their DXF fields, draw arrowheads and hook lines from their own flags, and paint the line and generated arrow from DIMCLRD instead of the layer color. DIMLDRBLK handles resolve to block names, and a DIMDSEP override no longer splices its ASCII code into the measurement text

## 1.15.18

### Patch Changes

- fix: keeps entities on inactive paper-space layouts when opening DXF. ezdxf and AutoCAD store geometry for layouts other than the active \*Paper_Space block in the BLOCKS section, and the importer skipped every paper-space block, so those entities never appeared. Non-current layouts now keep their geometry and the drawing opens with the full paper-space content

## 1.15.17

### Patch Changes

- fix: restores multi-step redo so consecutive redo operations replay every undone record. `AcDbUndoStack.pushUndo()` reinstates a record without clearing the redo stack, and the transaction manager `redo()` uses it, so `canRedo()` stays true until the redo history is exhausted while new edits still invalidate it

## 1.15.16

### Patch Changes

- feat: adds DIMSTYLE text fill and view direction fields to dimension styles, so the Dimension Style Manager can render the AutoCAD Text tab "Fill color" and "View direction" options. DIMTFILL, DIMTFILLCLR and DIMTXTDIRECTION are persisted through the LibreDWG converter and exported to DXF with the proper group codes

## 1.15.15

### Patch Changes

- feat: expands annotative scale object context data and CANNOSCALE presentation, and generates dimension blocks from DIMSTYLE settings. Also recognizes ODA/BricsCAD $DWGCODEPAGE aliases and aligns TEXT grip and INS osnap with the placement anchor

## 1.15.14

### Patch Changes

- fix: published lib/ packages now load as native ESM in Node via NodeNext-relative .js import specifiers, and LibreDwg converter emits matching Node-native ESM under lib/. AC1015 DXF export is fixed so R2000 drawings open correctly in AutoCAD 2000 and 2007

## 1.15.13

### Patch Changes

- feat: adds a Node main-thread LibreDWG converter entry that parses without a Web Worker, and fills missing DWG preview images from classic previewAddress bytes. Linetype SVG previews now render embedded text shapes so complex linetypes display correctly in the UI

## 1.15.12

### Patch Changes

- feat: registers TILEMODE as an AutoCAD-compatible integer system variable and reads it from the DWG header so drawings saved in paper space open with the correct tilemode instead of always reporting model space. Also upgrades libredwg-web to v0.8.1 and adds LICENSE files across packages

## 1.15.11

### Patch Changes

- fix: guards browser-only globals so public package entry points load in both browsers and Node. File loading, converter workers, OLE metafile rasterization, and EMF decoding no longer assume document, window, or Worker exist when a module is first imported. A dual-runtime test bundles each public package in both environments so import-time DOM or worker access fails in CI before it ships.

## 1.15.10

### Patch Changes

- feat: adds annotation scale support for annotative MTEXT by reading SCALE, DICTIONARYVAR, and context data from DXF and LibreDWG, honoring CANNOSCALE when drawing so extents, grips, and osnap stay aligned with the active scale. Also reuses the objectId already-stored guard when filling materialized DICTIONARY entries so mojibake ACAD_LAYOUT names do not create a second layout slot

## 1.15.9

### Patch Changes

- fix: resolve nested INSERT osnap targeting and keep open wide polylines visible. Fixes osnap on nested INSERT entities by correctly resolving the #n occurrence index via gsMark. Also ensures open wide polylines remain visible by drawing a centerline stroke regardless of fill-area success.

## 1.15.8

### Patch Changes

- fix: keeps hatch boundary paths intact when edge endpoints drift, gives each wide-polyline subpath its own area so multi-area wide polylines stay off direct batching, and resolves large-block osnap plus loglevel side effects and read() input handling

## 1.15.7

### Patch Changes

- fix: keeps MLeader textWidth 0 as auto wrap and lands doglegs on contentBasePosition when dogleg length is undersized, and builds splines from fit-point arrays when the declared count is omitted. Also upgrades the LibreDWG web dependency to v0.8.0

## 1.15.6

### Patch Changes

- fix: renders nearly-closed wide polylines through offsetRing instead of rejecting open loops that close on themselves, drops the thin-ring area-ratio gate that blocked building-scale outlines, and makes area hierarchy nesting deterministic so polyline fills stay correct

## 1.15.5

### Patch Changes

- fix: restores R12 DXF read/write round-trip, skips mojibake ACAD_LAYOUT aliases that would collide with existing layouts, and prefers CONTENTS bitmaps over OlePres clipboard icons so OLE frames show the embedded picture instead of a generic icon

## 1.15.4

### Patch Changes

- feat: exposes paper-space viewport frozen layers so renderers can honor VPLAYER freezes. AcGiViewport now carries frozenLayerIds and the resolved frozen layer names from AcDbViewport, so model-space entities on layers frozen in a paper-space viewport can be hidden during display.

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
