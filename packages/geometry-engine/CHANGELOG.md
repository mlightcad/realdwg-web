# @mlightcad/geometry-engine

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
