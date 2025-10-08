# @mlightcad/data-model

## 1.2.22

### Patch Changes

- feat: support 3dface entity

## 1.2.21

### Patch Changes

- feat: refine logic to set the extents of drawing database

## 1.2.20

### Patch Changes

- feat: add method createDefaultData in class AcDbDatabase

## 1.2.19

### Patch Changes

- feat: support returning statistics of parsing task

## 1.2.18

### Patch Changes

- fix: fix bug on parsing color

## 1.2.17

### Patch Changes

- feat: upgrade package dxf-json

## 1.2.16

### Patch Changes

- feat: upgrade version of lbredwg-web to fix type of clipping boundary path of wipeout entity

## 1.2.15

### Patch Changes

- feat: adjust dependencies of libreddwg-converter

## 1.2.14

### Patch Changes

- feat: upgrade version of libredwg-web to support wipeout entity

## 1.2.13

### Patch Changes

- feat: attach entity info after created one 'group' grpahic interface entity

## 1.2.12

### Patch Changes

- feat: add one flag to delay creating one rendered entity in function AcDbEntity.draw

## 1.2.11

### Patch Changes

- feat: attach entity info (such as objectId, layerName and etc.) in rendering cache entities

## 1.2.8

### Patch Changes

- feat: destory parser web worker once parsing finished

## 1.2.7

### Patch Changes

- feat: support batch append for entities

## 1.2.6

### Patch Changes

- feat: add property layoutId for class AcDbBlockTableRecord and set property blockTableRecordId value of AcDbLayout correctly when converting DXF/DWG

## 1.2.5

### Patch Changes

- feat: enable web worker for libredwg-converter

## 1.2.4

### Patch Changes

- feat: enable web worker for dxf parser

## 1.2.3

### Patch Changes

- feat: pass error in AcDbConversionProgressCallback if one error occurs when opening one file

## 1.2.2

### Patch Changes

- feat: add properties 'extmin' and 'extmax' for class AcDbDatabase

## 1.2.1

### Patch Changes

- feat: use static string to define entity type because constructor name will be changed by building tool

## 1.2.0

### Minor Changes

- fix: upgrade libredwg-web to fix bugs on getting layer name and line type name again

## 1.1.8

### Patch Changes

- fix: normalizes the name of a block table record and use verb-nurbs-web to implement spline

## 1.1.7

### Patch Changes

- feat: regularize block space name and paper space name

## 1.1.6

### Patch Changes

- feat: add parameter 'degree' for classes AcDbSpline and AcGeSpline3d

## 1.1.5

### Patch Changes

- fix: fix issue that AcDbBatchProcessing.processChunk doesn't wait for all chunks processed and then return

## 1.1.4

### Patch Changes

- feat: add 'FETCH_FILE' stage in AcDbDatabase.events.openProgress event

## 1.1.3

### Patch Changes

- refine methods to open database and refine typedocs of packages 'common' and 'data-model'

## 1.1.2

### Patch Changes

- add repo url in package.json

## 1.1.1

### Patch Changes

- Use CatmullRomCurve3 in three.js to create one closed spline

## 1.1.0

### Minor Changes

- refine constructor of spline related class to add one new parameter 'closed'

## 1.0.7

### Patch Changes

- fix: support 'closed' property in class AcGeSpline3d

## 1.0.6

### Patch Changes

- Updated dependencies
  - @mlightcad/geometry-engine@1.0.4
  - @mlightcad/graphic-interface@1.0.4

## 1.0.5

### Patch Changes

- bundle common, geometry-engine, and graphic-interface into data-model and remove dependency on lodash-es
- Updated dependencies
  - @mlightcad/geometry-engine@1.0.3
  - @mlightcad/common@1.0.3
  - @mlightcad/graphic-interface@1.0.3

## 1.0.4

### Patch Changes

- add readme for all of packages and remove dependencies on verb-nurbs-web
- Updated dependencies
  - @mlightcad/geometry-engine@1.0.2
  - @mlightcad/common@1.0.2
  - @mlightcad/graphic-interface@1.0.2
