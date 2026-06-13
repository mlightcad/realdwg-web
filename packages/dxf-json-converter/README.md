# @mlightcad/dxf-json-converter

The `dxf-json-converter` package provides a DXF file converter for the RealDWG-Web ecosystem, enabling reading and conversion of DXF files into the AutoCAD-like drawing database structure. It is based on [@mlightcad/dxf-json](https://www.npmjs.com/package/@mlightcad/dxf-json).

## Overview

This package implements a DXF file converter compatible with the RealDWG-Web data model. It allows you to register DXF file support in your application and convert DXF files into the in-memory drawing database.

DXF parsing runs in a dedicated Web Worker bundle so that GPL-licensed parser code can be loaded on demand and kept separate from the main application bundle.

## Key Features

- **DXF File Support**: Read and convert DXF files to the drawing database
- **Worker-based Parsing**: Optional Web Worker parsing for better UI responsiveness
- **Integration**: Designed to work with the RealDWG-Web data model and converter manager

## Installation

```bash
npm install @mlightcad/dxf-json-converter
```

> **Peer dependencies:**
> - `@mlightcad/data-model`

## Usage Example

```typescript
import { AcDbDatabaseConverterManager, AcDbFileType } from '@mlightcad/data-model';
import { AcDbDxfConverter } from '@mlightcad/dxf-json-converter';

const dxfConverter = new AcDbDxfConverter({
  useWorker: true,
  parserWorkerUrl: './assets/dxf-parser-worker.js'
});
AcDbDatabaseConverterManager.instance.register(AcDbFileType.DXF, dxfConverter);
```

Deploy `dxf-parser-worker.js` from this package's `dist/` folder to a public URL accessible by your application.

## API

- **AcDbDxfConverter**: Main converter class for DXF files (extends `AcDbDatabaseConverter`)

## Dependencies

- **@mlightcad/data-model**: Drawing database and entity definitions
- **@mlightcad/dxf-json**: DXF file parser (GPL-3.0)

## API Documentation

For detailed API documentation, visit the [RealDWG-Web documentation](https://mlight-lee.github.io/realdwg-web/).

## Contributing

This package is part of the RealDWG-Web monorepo. Please refer to the main project README for contribution guidelines.
