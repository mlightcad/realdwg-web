# @mlightcad/realdwg-web-example

## 0.3.8

### Patch Changes

- feat: improve SPLINE conversion with tolerant factory methods
- Updated dependencies
  - @mlightcad/data-model@1.9.8
  - @mlightcad/dxf-json-converter@1.9.8
  - @mlightcad/libredwg-converter@3.7.8

## 0.3.7

### Patch Changes

- feat: improve LibreDWG converter with enhanced MLeader conversion and SHAPE entity support, and restore initial view from \*ACTIVE VPORT with added sanity checks for robustness
- Updated dependencies
  - @mlightcad/data-model@1.9.7
  - @mlightcad/dxf-json-converter@1.9.7
  - @mlightcad/libredwg-converter@3.7.7

## 0.3.6

### Patch Changes

- feat: refactor AcGiContext into a class, fix SHAPE font resolution, and add STYLE table shape file support with draw-time database context handling
- Updated dependencies
  - @mlightcad/data-model@1.9.6
  - @mlightcad/dxf-json-converter@1.9.6
  - @mlightcad/libredwg-converter@3.7.6

## 0.3.5

### Patch Changes

- feat: fix rendering and color resolution: resolve sub-entity RGB at draw time via AcGiContext and correctly compute ByBlock/ByLayer attribute colors from owning INSERT, improving consistency of block and entity display
- Updated dependencies
  - @mlightcad/data-model@1.9.5
  - @mlightcad/dxf-json-converter@1.9.5
  - @mlightcad/libredwg-converter@3.7.5

## 0.3.4

### Patch Changes

- feat: upgrade libredwg-web to v0.7.4 to fix some issues on parsing dwg files
- Updated dependencies
  - @mlightcad/libredwg-converter@3.7.4
  - @mlightcad/data-model@1.9.4
  - @mlightcad/dxf-json-converter@1.9.4

## 0.3.3

### Patch Changes

- feat: support proxy entity for dwg file
- Updated dependencies
  - @mlightcad/data-model@1.9.3
  - @mlightcad/dxf-json-converter@1.9.3
  - @mlightcad/libredwg-converter@3.7.3

## 0.3.2

### Patch Changes

- feat: add AcDbProxyEntity with proxy graphic decoding
- Updated dependencies
  - @mlightcad/data-model@1.9.2
  - @mlightcad/dxf-json-converter@1.9.2
  - @mlightcad/libredwg-converter@3.7.2

## 0.3.1

### Patch Changes

- fix(data-model): break circular deps via direct imports and add CJS bundle test (#106)
- Updated dependencies
  - @mlightcad/data-model@1.9.1
  - @mlightcad/dxf-json-converter@1.9.1
  - @mlightcad/libredwg-converter@3.7.1

## 0.3.0

### Minor Changes

- feat: adds area support on curve, hatch, and geometry classes, extracts DXF conversion into the standalone @mlightcad/dxf-json-converter package, and documents GPL Web Worker isolation with example JSDoc

### Patch Changes

- Updated dependencies
  - @mlightcad/data-model@1.9.0
  - @mlightcad/dxf-json-converter@1.9.0
  - @mlightcad/libredwg-converter@3.7.0

## 0.2.4

### Patch Changes

- feat: added drawNoPlotLayers policy for controlling no-plot layer visibility, fixed hatch pattern angle handling when explicit lines are defined, updated project license, and migrated npm publishing to Trusted Publishing via OIDC
- Updated dependencies
  - @mlightcad/data-model@1.8.4
  - @mlightcad/libredwg-converter@3.6.4

## 0.2.3

### Patch Changes

- feat: geometricExtents for text, dimensions, table, and viewport; VPORT aspect ratio; case-insensitive VPORT lookup
- Updated dependencies
  - @mlightcad/data-model@1.8.3
  - @mlightcad/libredwg-converter@3.6.3

## 0.2.2

### Patch Changes

- feat(data-model): add SHAPE entity support and honor DXF visibility in blocks
- Updated dependencies
  - @mlightcad/data-model@1.8.2
  - @mlightcad/libredwg-converter@3.6.2

## 0.2.1

### Patch Changes

- feat: extend object snap support across entities and add ORTHOMODE, POLARMODE, POLARANG, and POLARADDANG system variables
- Updated dependencies
  - @mlightcad/data-model@1.8.1
  - @mlightcad/libredwg-converter@3.6.1

## 0.2.0

### Minor Changes

- feat: replace WHITEBKCOLOR with MODELBKCOLOR and PAPERBKCOLOR

### Patch Changes

- Updated dependencies
  - @mlightcad/data-model@1.8.0
  - @mlightcad/libredwg-converter@4.0.0

## 0.1.40

### Patch Changes

- fix: resolve text styles during progressive conversion and fix TRACE boundary order
- Updated dependencies
  - @mlightcad/data-model@1.7.40
  - @mlightcad/libredwg-converter@3.5.40

## 0.1.39

### Patch Changes

- feat: add AcDbCurve::getOffsetCurves and centralize offset tolerance checks with AcGeTol
- Updated dependencies
  - @mlightcad/data-model@1.7.39
  - @mlightcad/libredwg-converter@3.5.39

## 0.1.38

### Patch Changes

- fix: default layout manager factory survives production tree-shaking
- Updated dependencies
  - @mlightcad/data-model@1.7.38
  - @mlightcad/libredwg-converter@3.5.38

## 0.1.37

### Patch Changes

- feat: improve tree-shaking with explicit ESM exports and add geometry snap helpers
- Updated dependencies
  - @mlightcad/data-model@1.7.37
  - @mlightcad/libredwg-converter@3.5.37

## 0.1.36

### Patch Changes

- feat: add AcDbFormatter for AutoCAD-style length, point, and angle display
- Updated dependencies
  - @mlightcad/data-model@1.7.36
  - @mlightcad/libredwg-converter@3.5.36

## 0.1.35

### Patch Changes

- feat: LUNITS/LUPREC/AUPREC, VPORT fallbacks, angbase/angdir; pnpm 10 + CI
- Updated dependencies
  - @mlightcad/data-model@1.7.35
  - @mlightcad/libredwg-converter@3.5.35

## 0.1.34

### Patch Changes

- fix: build entity color via assignment to support AcDbHatch override
- Updated dependencies
  - @mlightcad/data-model@1.7.34
  - @mlightcad/libredwg-converter@3.5.34

## 0.1.33

### Patch Changes

- fix: prefer anonymous table blocks when rendering AcDbTable
- Updated dependencies
  - @mlightcad/data-model@1.7.33
  - @mlightcad/libredwg-converter@3.5.33

## 0.1.32

### Patch Changes

- feat: add SVG rendering support for hatch gradient previews and correct anchor for non-default TEXT/ATTRIB alignment
- Updated dependencies
  - @mlightcad/data-model@1.7.32
  - @mlightcad/libredwg-converter@3.5.32

## 0.1.31

### Patch Changes

- feat: add hatch related system variables and fix SOLID hatch handling & preview rendering
- Updated dependencies
  - @mlightcad/data-model@1.7.31
  - @mlightcad/libredwg-converter@3.5.31

## 0.1.30

### Patch Changes

- feat: add PAT parsing, predefined libraries, and SVG preview support
- Updated dependencies
  - @mlightcad/data-model@1.7.30
  - @mlightcad/libredwg-converter@3.5.30

## 0.1.29

### Patch Changes

- feat: refine mline rendering
- Updated dependencies
  - @mlightcad/data-model@1.7.29
  - @mlightcad/libredwg-converter@3.5.29

## 0.1.28

### Patch Changes

- feat: add mline and mleader supports
- Updated dependencies
  - @mlightcad/data-model@1.7.28
  - @mlightcad/libredwg-converter@3.5.28

## 0.1.27

### Patch Changes

- fix: fix cad-viewer issue #243 and #183
- Updated dependencies
  - @mlightcad/data-model@1.7.27
  - @mlightcad/libredwg-converter@3.5.27

## 0.1.26

### Patch Changes

- feat: add gradient hatch support
- Updated dependencies
  - @mlightcad/data-model@1.7.26
  - @mlightcad/libredwg-converter@3.5.26

## 0.1.25

### Patch Changes

- feat: introduce explicit draw order and fix issues on closed wide LWPOLYLINE rendering and OCS arc/circle conversion
- Updated dependencies
  - @mlightcad/data-model@1.7.25
  - @mlightcad/libredwg-converter@3.5.25

## 0.1.24

### Patch Changes

- fix: fix issues on dimension selection and snapping
- Updated dependencies
  - @mlightcad/data-model@1.7.24
  - @mlightcad/libredwg-converter@3.5.24

## 0.1.23

### Patch Changes

- fix: fix block reference osnap resolution for transformed and nested entities and issue on color resolution for libredwg-converter
- Updated dependencies
  - @mlightcad/data-model@1.7.23
  - @mlightcad/libredwg-converter@3.5.23

## 0.1.22

### Patch Changes

- feat: render wide LWPOLYLINE entities as filled geometry and add SVG linetype previews and demo rendering in example app
- Updated dependencies
  - @mlightcad/data-model@1.7.22
  - @mlightcad/libredwg-converter@3.5.22

## 0.1.21

### Patch Changes

- feat: add CELTYPE support across database and DXF/DWG converters
- Updated dependencies
  - @mlightcad/data-model@1.7.21
  - @mlightcad/libredwg-converter@3.5.21

## 0.1.20

### Patch Changes

- fix: fix issue #200 in cad-viewer
- Updated dependencies
  - @mlightcad/data-model@1.7.20
  - @mlightcad/libredwg-converter@3.5.20

## 0.1.19

### Patch Changes

- feat: add clone method
- Updated dependencies
  - @mlightcad/data-model@1.7.19
  - @mlightcad/libredwg-converter@3.5.19

## 0.1.18

### Patch Changes

- feat: improve text style fallback resolution and bump libredwg-web to 0.6.10
- Updated dependencies
  - @mlightcad/data-model@1.7.18
  - @mlightcad/libredwg-converter@3.5.18

## 0.1.17

### Patch Changes

- feat: implement missing geometry/entity transforms and expand transform regression coverage
- Updated dependencies
  - @mlightcad/data-model@1.7.17
  - @mlightcad/libredwg-converter@3.5.17

## 0.1.16

### Patch Changes

- feat(sysvars): add DYNMODE and DYNPROMPT system variables
- Updated dependencies
  - @mlightcad/data-model@1.7.16
  - @mlightcad/libredwg-converter@3.5.16

## 0.1.15

### Patch Changes

- feat: improve geometry and optimize build configuration
- Updated dependencies
  - @mlightcad/data-model@1.7.15
  - @mlightcad/libredwg-converter@3.5.15

## 0.1.14

### Patch Changes

- fix: improve DXF export functionality and refine AcDbSpline
- Updated dependencies
  - @mlightcad/data-model@1.7.14
  - @mlightcad/libredwg-converter@3.5.14

## 0.1.13

### Patch Changes

- fix: fix #issue 150 in cad-viewer (#43)
- Updated dependencies
  - @mlightcad/data-model@1.7.13
  - @mlightcad/libredwg-converter@3.5.13

## 0.1.12

### Patch Changes

- fix: upgrade dxf-json to fix bug #132 in cad-viewer repo
- Updated dependencies
  - @mlightcad/data-model@1.7.12
  - @mlightcad/libredwg-converter@3.5.12

## 0.1.11

### Patch Changes

- fix issue on converting spline with fit points
- Updated dependencies
  - @mlightcad/data-model@1.7.11
  - @mlightcad/libredwg-converter@3.5.11

## 0.1.10

### Patch Changes

- fix: fix bugs on building loops for hatch and revome dependency on verb-nurbs
- Updated dependencies
  - @mlightcad/data-model@1.7.10
  - @mlightcad/libredwg-converter@3.5.10

## 0.1.9

### Patch Changes

- feat: improve DXF export
- Updated dependencies
  - @mlightcad/data-model@1.7.9
  - @mlightcad/libredwg-converter@3.5.9

## 0.1.8

### Patch Changes

- fix: fix issue on reading dxf file caused by last release
- Updated dependencies
  - @mlightcad/data-model@1.7.8
  - @mlightcad/libredwg-converter@3.5.8

## 0.1.7

### Patch Changes

- feat: add DXF export support
- Updated dependencies
  - @mlightcad/data-model@1.7.7
  - @mlightcad/libredwg-converter@3.5.7

## 0.1.6

### Patch Changes

- feat: support changing foreground color
- Updated dependencies
  - @mlightcad/data-model@1.7.6
  - @mlightcad/libredwg-converter@3.5.6

## 0.1.5

### Patch Changes

- chore: add system variables MEASUREMENTCOLOR, OSMODE, and TEXTCOLOR
- Updated dependencies
  - @mlightcad/data-model@1.7.5
  - @mlightcad/libredwg-converter@3.5.5

## 0.1.4

### Patch Changes

- feat: add configurable parser worker timeout for drawing conversion and centralize database system variable names
- Updated dependencies
  - @mlightcad/data-model@1.7.4
  - @mlightcad/libredwg-converter@3.5.4

## 0.1.3

### Patch Changes

- fix: fix issue 101
- Updated dependencies
  - @mlightcad/data-model@1.7.3
  - @mlightcad/libredwg-converter@3.5.3

## 0.1.2

### Patch Changes

- feat(data-model): emit sysVarChanged only when sysvar value actually changes and add system variable 'LWDISPLAY'
- Updated dependencies
  - @mlightcad/data-model@1.7.2
  - @mlightcad/libredwg-converter@3.5.2

## 0.1.1

### Patch Changes

- feat: set entity line weight and line type scale for newly created entity
- Updated dependencies
  - @mlightcad/data-model@1.7.1
  - @mlightcad/libredwg-converter@3.5.1

## 0.1.0

### Patch Changes

- feat: support xdata and xrecord
- Updated dependencies
  - @mlightcad/data-model@1.6.11
  - @mlightcad/libredwg-converter@3.4.14

## 0.0.13

### Patch Changes

- feat: respect value of system variables 'cecolor' and 'clayer' when creating one new entity
- Updated dependencies
  - @mlightcad/data-model@1.6.10
  - @mlightcad/libredwg-converter@3.4.13

## 0.0.12

### Patch Changes

- feat: enhance polyline
- Updated dependencies
  - @mlightcad/data-model@1.6.9
  - @mlightcad/libredwg-converter@3.4.12

## 0.0.11

### Patch Changes

- fix: fix issues 89 and 90 in cad-viewer repo
- Updated dependencies
  - @mlightcad/data-model@1.6.8
  - @mlightcad/libredwg-converter@3.4.11

## 0.0.10

### Patch Changes

- feat: support ATTDEF ATTRIB entities when reading DXF file
- Updated dependencies
  - @mlightcad/data-model@1.6.7
  - @mlightcad/libredwg-converter@3.4.10

## 0.0.9

### Patch Changes

- feat: support ATTDEF and ATTRIB entities
- Updated dependencies
  - @mlightcad/data-model@1.6.6
  - @mlightcad/libredwg-converter@3.4.9

## 0.0.8

### Patch Changes

- Updated dependencies
  - @mlightcad/libredwg-converter@3.4.8
  - @mlightcad/data-model@1.6.5

## 0.0.7

### Patch Changes

- Updated dependencies
  - @mlightcad/data-model@1.6.4
  - @mlightcad/libredwg-converter@3.4.7

## 0.0.6

### Patch Changes

- Updated dependencies
  - @mlightcad/libredwg-converter@3.4.6

## 0.0.5

### Patch Changes

- Updated dependencies
  - @mlightcad/libredwg-converter@3.4.5

## 0.0.4

### Patch Changes

- Updated dependencies
  - @mlightcad/libredwg-converter@3.4.4
  - @mlightcad/data-model@1.6.3

## 0.0.3

### Patch Changes

- Updated dependencies
  - @mlightcad/libredwg-converter@3.4.3

## 0.0.2

### Patch Changes

- Updated dependencies
  - @mlightcad/libredwg-converter@3.4.2
  - @mlightcad/data-model@1.6.2
