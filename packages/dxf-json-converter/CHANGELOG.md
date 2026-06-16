# @mlightcad/dxf-json-converter

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
