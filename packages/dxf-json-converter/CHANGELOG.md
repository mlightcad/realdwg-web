# @mlightcad/dxf-json-converter

## 1.11.2

### Patch Changes

- fix: draw ATTDEF per AutoCAD semantics and fix DXF flags
- Updated dependencies
  - @mlightcad/data-model@1.11.2

## 1.11.1

### Patch Changes

- feat: upgraded to Vite 6 & dxf-json 1.2.8, and improved data model by storing block PreviewIcons as bytes and fixed nested layer filter behavior
- Updated dependencies
  - @mlightcad/data-model@1.11.1

## 1.11.0

### Patch Changes

- feat: adds support for OLE frames and layer filters, improves image frame selection, assigns TEMP handles to unbound AcDbObjects, and refactors helper naming with consistent acdb/acge prefixes for better maintainability
- Updated dependencies
  - @mlightcad/data-model@1.11.0

## 1.10.7

### Patch Changes

- feat: added block cross-reference flags & unresolved detection, and improved data model flexibility by making the CLASSES conversion stage optional
- Updated dependencies
  - @mlightcad/data-model@1.10.7

## 1.10.6

### Patch Changes

- feat: improved DXF compatibility and data integrity with corrected group codes, CLASSES and SOLID export support, fixed proxy DXF codes, preserved SHAPE round-trip identity, and maintained circular arc endpoints when reversing loop edges
- Updated dependencies
  - @mlightcad/data-model@1.10.6

## 1.10.5

### Patch Changes

- feat: added a heuristic memory estimator for AcDbDatabase and fixed saved view restoration by correctly applying VPORT view target and twist, improving memory estimation and view consistency
- Updated dependencies
  - @mlightcad/data-model@1.10.5

## 1.10.4

### Patch Changes

- feat: sync latest upstream changes for ACIS SAB decoding, 3DSOLID wireframes, CI update, and FCF GDT/TOLERANCE improvements
- Updated dependencies
  - @mlightcad/data-model@1.10.4

## 1.10.3

### Patch Changes

- feat: add AcDbFcf and AcDb3dSolid
- Updated dependencies
  - @mlightcad/data-model@1.10.3

## 1.10.2

### Patch Changes

- feat: improved data model reliability with structured database error reporting, resilient font loading, accurate leader hook line rendering, and global handle registry to prevent cross-table handle collisions
- Updated dependencies
  - @mlightcad/data-model@1.10.2

## 1.10.1

### Patch Changes

- fix: improved AutoCAD compatibility by normalizing symbol table names and enhanced wide polyline fill rendering for self-overlapping paths
- Updated dependencies
  - @mlightcad/data-model@1.10.1

## 1.10.0

### Minor Changes

- feat: refactor symbol table storage with typed attributes, enforce write access controls, dispatch layerModified events, fix entityModified dispatch on commit, and resolve MLine grip issues for improved data integrity

### Patch Changes

- Updated dependencies
  - @mlightcad/data-model@1.10.0

## 1.9.14

### Patch Changes

- fix(data-model): correct transforms for dimensions, proxy entities, and block attributes
- Updated dependencies
  - @mlightcad/data-model@1.9.14

## 1.9.13

### Patch Changes

- feat(data-model): enhance grip editing with GRIPS sysvar and entity-specific grips
- Updated dependencies
  - @mlightcad/data-model@1.9.13

## 1.9.12

### Patch Changes

- feat(data-model,dxf-json-converter): add edit shortcuts and binary DXF parsing
- Updated dependencies
  - @mlightcad/data-model@1.9.12

## 1.9.11

### Patch Changes

- feat: implement database transaction manager with undo/redo
- Updated dependencies
  - @mlightcad/data-model@1.9.11

## 1.9.10

### Patch Changes

- feat: support reading AcDb2LineAngularDimension and add DWGNAME system variable
- Updated dependencies
  - @mlightcad/data-model@1.9.10

## 1.9.9

### Patch Changes

- feat: introduced grip point editing across entity types and unified DWG/DXF font collection through AcDbFontNameCollector for improved editing and font management consistency
- Updated dependencies
  - @mlightcad/data-model@1.9.9

## 1.9.8

### Patch Changes

- feat: improve SPLINE conversion with tolerant factory methods
- Updated dependencies
  - @mlightcad/data-model@1.9.8

## 1.9.7

### Patch Changes

- feat: improve LibreDWG converter with enhanced MLeader conversion and SHAPE entity support, and restore initial view from \*ACTIVE VPORT with added sanity checks for robustness
- Updated dependencies
  - @mlightcad/data-model@1.9.7

## 1.9.6

### Patch Changes

- feat: refactor AcGiContext into a class, fix SHAPE font resolution, and add STYLE table shape file support with draw-time database context handling
- Updated dependencies
  - @mlightcad/data-model@1.9.6

## 1.9.5

### Patch Changes

- feat: fix rendering and color resolution: resolve sub-entity RGB at draw time via AcGiContext and correctly compute ByBlock/ByLayer attribute colors from owning INSERT, improving consistency of block and entity display
- Updated dependencies
  - @mlightcad/data-model@1.9.5

## 1.9.4

### Patch Changes

- feat: upgrade libredwg-web to v0.7.4 to fix some issues on parsing dwg files
- Updated dependencies
  - @mlightcad/data-model@1.9.4

## 1.9.3

### Patch Changes

- feat: support proxy entity for dwg file
- Updated dependencies
  - @mlightcad/data-model@1.9.3

## 1.9.2

### Patch Changes

- feat: add AcDbProxyEntity with proxy graphic decoding
- Updated dependencies
  - @mlightcad/data-model@1.9.2

## 1.9.1

### Patch Changes

- fix(data-model): break circular deps via direct imports and add CJS bundle test (#106)
- Updated dependencies
  - @mlightcad/data-model@1.9.1

## 1.9.0

### Major Changes

- Extract DXF conversion from `@mlightcad/data-model` into a standalone package
- Bundle GPL-licensed `@mlightcad/dxf-json` parser in a separate Web Worker

### Minor Changes

- feat: adds area support on curve, hatch, and geometry classes, extracts DXF conversion into the standalone @mlightcad/dxf-json-converter package, and documents GPL Web Worker isolation with example JSDoc

### Patch Changes

- Updated dependencies
  - @mlightcad/data-model@1.9.0
