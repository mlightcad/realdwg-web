# @mlightcad/libredwg-converter

## 3.0.12

### Patch Changes

- feat: add one flag to delay creating one rendered entity in function AcDbEntity.draw
- Updated dependencies
  - @mlightcad/data-model@1.2.12

## 3.0.11

### Patch Changes

- feat: attach entity info (such as objectId, layerName and etc.) in rendering cache entities
- Updated dependencies
  - @mlightcad/data-model@1.2.11

## 3.0.9

### Patch Changes

- feat: destory parser web worker once parsing finished
- Updated dependencies
  - @mlightcad/data-model@1.2.8

## 3.0.8

### Patch Changes

- feat: support batch append for entities
- Updated dependencies
  - @mlightcad/data-model@1.2.7

## 3.0.7

### Patch Changes

- feat: add property layoutId for class AcDbBlockTableRecord and set property blockTableRecordId value of AcDbLayout correctly when converting DXF/DWG
- Updated dependencies
  - @mlightcad/data-model@1.2.6

## 3.0.6

### Patch Changes

- feat: let AcDbLibreDwgConverter run in web worker only

## 3.0.5

### Patch Changes

- feat: enable web worker for libredwg-converter
- Updated dependencies
  - @mlightcad/data-model@1.2.5

## 3.0.4

### Patch Changes

- feat: enable web worker for dxf parser
- Updated dependencies
  - @mlightcad/data-model@1.2.4

## 3.0.3

### Patch Changes

- Updated dependencies
  - @mlightcad/data-model@1.2.3

## 3.0.2

### Patch Changes

- feat: add properties 'extmin' and 'extmax' for class AcDbDatabase
- Updated dependencies
  - @mlightcad/data-model@1.2.2

## 3.0.1

### Patch Changes

- Updated dependencies
  - @mlightcad/data-model@1.2.1

## 3.0.0

### Minor Changes

- fix: upgrade libredwg-web to fix bugs on getting layer name and line type name again

### Patch Changes

- Updated dependencies
  - @mlightcad/data-model@1.2.0

## 2.0.11

### Patch Changes

- fix: upgrade libredwg-web to fix some bugs on getting entity layer name and line type name

## 2.0.10

### Patch Changes

- fix: upgrade libredwg-web to fix some bugs on decoding texts

## 2.0.9

### Patch Changes

- fix: upgrade libredwg-web to fix some bugs on decoding texts

## 2.0.8

### Patch Changes

- Updated dependencies
  - @mlightcad/data-model@1.1.8

## 2.0.7

### Patch Changes

- feat: regularize block space name and paper space name
- Updated dependencies
  - @mlightcad/data-model@1.1.7

## 2.0.6

### Patch Changes

- feat: add parameter 'degree' for classes AcDbSpline and AcGeSpline3d
- Updated dependencies
  - @mlightcad/data-model@1.1.6

## 2.0.5

### Patch Changes

- Updated dependencies
  - @mlightcad/data-model@1.1.5

## 2.0.4

### Patch Changes

- feat: add 'FETCH_FILE' stage in AcDbDatabase.events.openProgress event
- Updated dependencies
  - @mlightcad/data-model@1.1.4

## 2.0.3

### Patch Changes

- refine methods to open database and refine typedocs of packages 'common' and 'data-model'
- Updated dependencies
  - @mlightcad/data-model@1.1.3

## 2.0.2

### Patch Changes

- add repo url in package.json
- Updated dependencies
  - @mlightcad/data-model@1.1.2

## 2.0.1

### Patch Changes

- Updated dependencies
  - @mlightcad/data-model@1.1.1

## 2.0.0

### Minor Changes

- refine constructor of spline related class to add one new parameter 'closed'

### Patch Changes

- Updated dependencies
  - @mlightcad/data-model@1.1.0

## 1.0.2

### Patch Changes

- Updated dependencies
  - @mlightcad/data-model@1.0.7

## 1.0.1

### Patch Changes

- add libdxfrw-converter and libredwg-converter to support reading DWG file
