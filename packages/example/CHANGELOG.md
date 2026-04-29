# @mlightcad/realdwg-web-example

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
