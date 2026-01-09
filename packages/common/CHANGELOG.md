# @mlightcad/common

## 1.3.1

### Patch Changes

- feat: update file type handling to support custom converter types

## 1.3.0

### Patch Changes

- feat: modify common, geometry-engine, and graphic-interface as dependencies of package data-model

## 1.2.7

### Patch Changes

- feat: add class AcCmTransparency

## 1.2.6

### Patch Changes

- feat: support changing layer color

## 1.2.5

### Patch Changes

- feat: refine logic to convert POLYLINE entity in dxf/dwg

## 1.2.4

### Patch Changes

- fix: bump version again because the wrong package was published in npm registry

## 1.2.3

### Patch Changes

- feat: support interruptting the entire workflow if one task throw one exception

## 1.2.2

### Patch Changes

- fix: fix bug that failed to convert one entity will result in the whole conversion interruptted

## 1.2.1

### Patch Changes

- fix: fix bug on parsing color

## 1.2.0

### Minor Changes

- fix: upgrade libredwg-web to fix bugs on getting layer name and line type name again

## 1.1.4

### Patch Changes

- fix: fix issue that AcDbBatchProcessing.processChunk doesn't wait for all chunks processed and then return

## 1.1.3

### Patch Changes

- feat: add 'FETCH_FILE' stage in AcDbDatabase.events.openProgress event

## 1.1.2

### Patch Changes

- refine methods to open database and refine typedocs of packages 'common' and 'data-model'

## 1.1.1

### Patch Changes

- add repo url in package.json

## 1.1.0

### Minor Changes

- refine constructor of spline related class to add one new parameter 'closed'

## 1.0.3

### Patch Changes

- bundle common, geometry-engine, and graphic-interface into data-model and remove dependency on lodash-es

## 1.0.2

### Patch Changes

- add readme for all of packages and remove dependencies on verb-nurbs-web
