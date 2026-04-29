# @mlightcad/geometry-engine

## 3.2.27

### Patch Changes

- fix: fix cad-viewer issue #243 and #183
- Updated dependencies
  - @mlightcad/common@1.4.27

## 3.2.26

### Patch Changes

- feat: add gradient hatch support
- Updated dependencies
  - @mlightcad/common@1.4.26

## 3.2.25

### Patch Changes

- feat: introduce explicit draw order and fix issues on closed wide LWPOLYLINE rendering and OCS arc/circle conversion
- Updated dependencies
  - @mlightcad/common@1.4.25

## 3.2.24

### Patch Changes

- fix: fix issues on dimension selection and snapping
- Updated dependencies
  - @mlightcad/common@1.4.24

## 3.2.23

### Patch Changes

- fix: fix block reference osnap resolution for transformed and nested entities and issue on color resolution for libredwg-converter
- Updated dependencies
  - @mlightcad/common@1.4.23

## 3.2.22

### Patch Changes

- feat: render wide LWPOLYLINE entities as filled geometry and add SVG linetype previews and demo rendering in example app
- Updated dependencies
  - @mlightcad/common@1.4.22

## 3.2.21

### Patch Changes

- feat: add CELTYPE support across database and DXF/DWG converters
- Updated dependencies
  - @mlightcad/common@1.4.21

## 3.2.20

### Patch Changes

- fix: fix issue #200 in cad-viewer
- Updated dependencies
  - @mlightcad/common@1.4.20

## 3.2.19

### Patch Changes

- feat: add clone method
- Updated dependencies
  - @mlightcad/common@1.4.19

## 3.2.18

### Patch Changes

- feat: improve text style fallback resolution and bump libredwg-web to 0.6.10
- Updated dependencies
  - @mlightcad/common@1.4.18

## 3.2.17

### Patch Changes

- feat: implement missing geometry/entity transforms and expand transform regression coverage
- Updated dependencies
  - @mlightcad/common@1.4.17

## 3.2.16

### Patch Changes

- feat(sysvars): add DYNMODE and DYNPROMPT system variables
- Updated dependencies
  - @mlightcad/common@1.4.16

## 3.2.15

### Patch Changes

- feat: improve geometry and optimize build configuration
- Updated dependencies
  - @mlightcad/common@1.4.15

## 3.2.14

### Patch Changes

- fix: improve DXF export functionality and refine AcDbSpline
- Updated dependencies
  - @mlightcad/common@1.4.14

## 3.2.13

### Patch Changes

- fix: fix #issue 150 in cad-viewer (#43)
- Updated dependencies
  - @mlightcad/common@1.4.13

## 3.2.12

### Patch Changes

- fix: upgrade dxf-json to fix bug #132 in cad-viewer repo
- Updated dependencies
  - @mlightcad/common@1.4.12

## 3.2.11

### Patch Changes

- fix issue on converting spline with fit points
- Updated dependencies
  - @mlightcad/common@1.4.11

## 3.2.10

### Patch Changes

- fix: fix bugs on building loops for hatch and revome dependency on verb-nurbs
- Updated dependencies
  - @mlightcad/common@1.4.10

## 3.2.9

### Patch Changes

- feat: improve DXF export
- Updated dependencies
  - @mlightcad/common@1.4.9

## 3.2.8

### Patch Changes

- fix: fix issue on reading dxf file caused by last release
- Updated dependencies
  - @mlightcad/common@1.4.8

## 3.2.7

### Patch Changes

- feat: add DXF export support
- Updated dependencies
  - @mlightcad/common@1.4.7

## 3.2.6

### Patch Changes

- feat: support changing foreground color
- Updated dependencies
  - @mlightcad/common@1.4.6

## 3.2.5

### Patch Changes

- chore: add system variables MEASUREMENTCOLOR, OSMODE, and TEXTCOLOR
- Updated dependencies
  - @mlightcad/common@1.4.5

## 3.2.4

### Patch Changes

- feat: add configurable parser worker timeout for drawing conversion and centralize database system variable names
- Updated dependencies
  - @mlightcad/common@1.4.4

## 3.2.3

### Patch Changes

- fix: fix issue 101
- Updated dependencies
  - @mlightcad/common@1.4.3

## 3.2.2

### Patch Changes

- feat(data-model): emit sysVarChanged only when sysvar value actually changes and add system variable 'LWDISPLAY'
- Updated dependencies
  - @mlightcad/common@1.4.2

## 3.2.1

### Patch Changes

- feat: set entity line weight and line type scale for newly created entity
- Updated dependencies
  - @mlightcad/common@1.4.1

## 3.2.0

### Patch Changes

- feat: support xdata and xrecord
- Updated dependencies
  - @mlightcad/common@1.3.8

## 3.1.10

### Patch Changes

- feat: respect value of system variables 'cecolor' and 'clayer' when creating one new entity
- Updated dependencies
  - @mlightcad/common@1.3.7

## 3.1.9

### Patch Changes

- feat: enhance polyline
- Updated dependencies
  - @mlightcad/common@1.3.6

## 3.1.8

### Patch Changes

- fix: fix issues 89 and 90 in cad-viewer repo
- Updated dependencies
  - @mlightcad/common@1.3.5

## 3.1.7

### Patch Changes

- feat: support ATTDEF ATTRIB entities when reading DXF file
- Updated dependencies
  - @mlightcad/common@1.3.4

## 3.1.6

### Patch Changes

- feat: support ATTDEF and ATTRIB entities
- Updated dependencies
  - @mlightcad/common@1.3.3

## 3.1.5

### Patch Changes

- Updated dependencies
  - @mlightcad/common@1.3.2

## 3.1.4

### Patch Changes

- feat: update file type handling to support custom converter types
- Updated dependencies
  - @mlightcad/common@1.3.1

## 3.1.3

### Patch Changes

- feat: add property 'properties' for entities AcDb2dPolyline, AcDb3dPolyline, and AcDbPolyline

## 3.1.2

### Patch Changes

- fix: fix issue 38 in repo cad-viewer

## 3.1.1

### Patch Changes

- feat: refine entity osnap and properties

## 3.1.0

### Patch Changes

- feat: modify common, geometry-engine, and graphic-interface as dependencies of package data-model
- Updated dependencies
  - @mlightcad/common@1.2.8

## 3.0.9

### Patch Changes

- Updated dependencies
  - @mlightcad/common@1.2.7

## 3.0.8

### Patch Changes

- Updated dependencies
  - @mlightcad/common@1.2.6

## 3.0.7

### Patch Changes

- feat: refine snap related api

## 3.0.6

### Patch Changes

- feat: refine logic to convert POLYLINE entity in dxf/dwg
- Updated dependencies
  - @mlightcad/common@1.2.5

## 3.0.5

### Patch Changes

- fix: bump version again because the wrong package was published in npm registry
- Updated dependencies
  - @mlightcad/common@1.2.4

## 3.0.4

### Patch Changes

- feat: support interruptting the entire workflow if one task throw one exception
- Updated dependencies
  - @mlightcad/common@1.2.3

## 3.0.3

### Patch Changes

- Updated dependencies
  - @mlightcad/common@1.2.2

## 3.0.2

### Patch Changes

- fix: fix bug on parsing color
- Updated dependencies
  - @mlightcad/common@1.2.1

## 3.0.1

### Patch Changes

- feat: correct the angle system behavior of class AcGeCircArc2d

## 3.0.0

### Minor Changes

- fix: upgrade libredwg-web to fix bugs on getting layer name and line type name again

### Patch Changes

- Updated dependencies
  - @mlightcad/common@1.2.0

## 2.0.7

### Patch Changes

- fix: normalizes the name of a block table record and use verb-nurbs-web to implement spline

## 2.0.6

### Patch Changes

- feat: add parameter 'degree' for classes AcDbSpline and AcGeSpline3d

## 2.0.5

### Patch Changes

- Updated dependencies
  - @mlightcad/common@1.1.4

## 2.0.4

### Patch Changes

- feat: add 'FETCH_FILE' stage in AcDbDatabase.events.openProgress event
- Updated dependencies
  - @mlightcad/common@1.1.3

## 2.0.3

### Patch Changes

- refine methods to open database and refine typedocs of packages 'common' and 'data-model'
- Updated dependencies
  - @mlightcad/common@1.1.2

## 2.0.2

### Patch Changes

- add repo url in package.json
- Updated dependencies
  - @mlightcad/common@1.1.1

## 2.0.1

### Patch Changes

- Use CatmullRomCurve3 in three.js to create one closed spline

## 2.0.0

### Minor Changes

- refine constructor of spline related class to add one new parameter 'closed'

### Patch Changes

- Updated dependencies
  - @mlightcad/common@1.1.0

## 1.0.5

### Patch Changes

- fix: support 'closed' property in class AcGeSpline3d

## 1.0.4

### Patch Changes

- Fix bug on AcGeSpline3d.getPoints to calcuate the last point

## 1.0.3

### Patch Changes

- bundle common, geometry-engine, and graphic-interface into data-model and remove dependency on lodash-es
- Updated dependencies
  - @mlightcad/common@1.0.3

## 1.0.2

### Patch Changes

- add readme for all of packages and remove dependencies on verb-nurbs-web
- Updated dependencies
  - @mlightcad/common@1.0.2
