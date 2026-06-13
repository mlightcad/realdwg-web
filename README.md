# RealDWG-Web

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![npm version](https://img.shields.io/npm/v/@mlightcad/data-model.svg)](https://www.npmjs.com/package/@mlightcad/data-model)

AutoCAD RealDWG is a software development toolkit (SDK) provided by Autodesk that allows developers to read, write, and create DWG and DXF files (AutoCAD's native drawing file formats) without needing AutoCAD installed.

The target of this project is to create one web-version of AutoCAD RealDWG by providing the similar API. For now, it supports reading DWG and DXF file only. In the future, it will support write DWG and DXF too.

- [**🌐 DWG/DXF JSON Viewer**](https://dwg.thingraph.site/dwg_json_viewer.html)
- [**🌐 API Docs**](https://mlightcad.github.io/realdwg-web/)

## App Based on Realdwg-Web

- [Google Drive DWG Viewer](https://workspace.google.com/u/0/marketplace/app/dwg_viewer/641533811831)

## Converter Registration Mechanism

To support reading both DXF and DWG files (and potentially other formats in the future), this project provides a flexible mechanism for registering and unregistering file converters. This is managed by the `AcDbDatabaseConverterManager` class.

### How It Works

- Each file type (e.g., DXF, DWG) is associated with a converter class that knows how to parse and import that file format into the drawing database.
- The `AcDbDatabaseConverterManager` maintains a registry of these converters, allowing you to register or unregister converters for specific file types at runtime.
- No converters are registered by default. Register the DXF and DWG converters from their respective packages before calling `AcDbDatabase.read()`.

Both `@mlightcad/dxf-json-converter` and `@mlightcad/libredwg-converter` are designed to run their parsers in a Web Worker only. This is not a technical or architectural limitation of the converters themselves; it is a deliberate licensing choice. The upstream parsers are copyleft (GPL/LGPL), so keeping them in a separate worker bundle helps isolate that code from the main application and makes license compliance easier for MIT-licensed apps built on RealDWG-Web.

### Registering Converters

Register DXF and DWG converters before reading files:

```ts
import {
  AcDbDatabaseConverterManager,
  AcDbFileType
} from '@mlightcad/data-model'
import { AcDbDxfConverter } from '@mlightcad/dxf-json-converter'
import { AcDbLibreDwgConverter } from '@mlightcad/libredwg-converter'

// DXF converter (GPL parser is loaded in a separate Web Worker for license isolation)
const dxfConverter = new AcDbDxfConverter({
  convertByEntityType: false,
  useWorker: true,
  parserWorkerUrl: './assets/dxf-parser-worker.js'
})
AcDbDatabaseConverterManager.instance.register(
  AcDbFileType.DXF,
  dxfConverter
)

// DWG converter (copyleft parser is loaded in a separate Web Worker for license isolation)
const dwgConverter = new AcDbLibreDwgConverter({
  convertByEntityType: false,
  useWorker: true,
  parserWorkerUrl: './assets/libredwg-parser-worker.js'
})
AcDbDatabaseConverterManager.instance.register(
  AcDbFileType.DWG,
  dwgConverter
)
```

Deploy `dxf-parser-worker.js` and `libredwg-parser-worker.js` from each converter package's `dist/` folder to a public URL (see [example vite config](./packages/example/vite.config.ts)).

### Unregistering a Converter

To unregister a converter for a file type:

```ts
import { AcDbDatabaseConverterManager, AcDbFileType } from '@mlightcad/data-model';

// Unregister the DWG converter
AcDbDatabaseConverterManager.instance.unregister(AcDbFileType.DWG);
```

### Getting a Converter

To get the converter for a specific file type (returns `undefined` if not registered):

```ts
const converter = AcDbDatabaseConverterManager.instance.get(AcDbFileType.DXF);
```


### Read DWG/DXF File

Once a File object is selected via an HTML file input control, you can read and parse the DWG/DXF file using the following code.

```ts
const buffer = await file.arrayBuffer();
const fileExtension = file.name.split('.').pop()?.toLocaleLowerCase();
const database = new AcDbDatabase();
// The following step is very important. The working database must be set before parsing DWG/DXF file
acdbHostApplicationServices().workingDatabase = database;
const options: AcDbOpenDatabaseOptions = {
  minimumChunkSize: 1000,
  readOnly: true
};
await database.read(
  buffer,
  options,
  fileExtension == 'dwg' ? AcDbFileType.DWG : AcDbFileType.DXF
);
```

For a complete example, see the [example project](./packages/example/src/main.ts).

### Extensibility

This mechanism allows you to:
- Add support for new file types by implementing and registering new converters.
- Replace or remove converters at runtime as needed.
- Listen for registration/unregistration events if you need to react to changes in available converters.

This design ensures the system is open for extension and can easily adapt to new requirements or file formats in the future.

## Architecture

AutoCAD holds an absolute dominant position in the 2D CAD field. A large number of vertical applications and third-party plugins have been developed based on AutoCAD ObjectARX, and there are many software engineers familiar with AutoCAD ObjectARX. Therefore, this project mimics the architecture of AutoCAD ObjectARX and adopts similar API interfaces to AutoCAD ObjectARX.

### libdxfrw-converter (DWG file support)

This module provides a DWG file converter for the RealDWG-Web ecosystem, enabling reading and conversion of DWG files into the drawing database. It is powered by the libdxfrw library compiled to WebAssembly and is designed to be registered with the converter manager for DWG file support.

### libredwg-converter (DWG file support)

This module provides a DWG file converter for the RealDWG-Web ecosystem, enabling reading and conversion of DWG files into the drawing database. It is powered by the LibreDWG library compiled to WebAssembly and is designed to be registered with the converter manager for DWG file support.

DWG parsing is provided through a dedicated Web Worker bundle (`libredwg-parser-worker.js`). Worker-only usage is a licensing choice, not a platform constraint: it keeps the copyleft LibreDWG parser separate from the main application bundle so that MIT-licensed apps can integrate DWG support more safely.

### dxf-json-converter (DXF file support)

This module provides a DXF file converter for the RealDWG-Web ecosystem. It is based on [@mlightcad/dxf-json](https://www.npmjs.com/package/@mlightcad/dxf-json) and is designed to be registered with the converter manager for DXF file support.

DXF parsing is provided through a dedicated Web Worker bundle (`dxf-parser-worker.js`). Worker-only usage is a licensing choice, not a platform constraint: it keeps the GPL-licensed `@mlightcad/dxf-json` parser separate from the main application bundle. The main `@mlightcad/data-model` package does not depend on `dxf-json`.

## geometry-engine (AcGe classes in AutoCAD ObjectARX)

This module provides geometric entities, operations, and transformations. It consists of two kinds of classes.

- Math: focuses on mathematical operations that underpin geometric calculations. This includes concepts such as vectors, matrices, transformations, and other linear algebra operations that are essential for performing geometric calculations in AutoCAD. To simplify implementation of math classes, most of math classes are 'stolen' from [THREE.js](https://threejs.org/docs/index.html) by modifying their class name.
- Geometry: focuses on more complex geometric entities and their operations. This includes lines, curves, surfaces, and intersections, among others. These classes define how geometric objects behave and how they interact in 2D or 3D space.

The key classes in this module are as follows.

- AcGePoint3d, AcGePoint2d: Represent 3D and 2D points.
- AcGeVector3d, AcGeVector2d: Represent 3D and 2D vectors.
- AcGeMatrix3d: AcGeMatrix2d: transformations in 3D space.
- AcGeLine3d, AcGeLine2d: Represent lines in 3D and 2D.
- AcGeCurve3d, AcGeCurve2d: Abstract base class for curves in 3D and 2D.
- ...

### data-model (AcDb classes in AutoCAD ObjectARX)

The same drawing database structure is used in this project so that it is easier for AutoCAD ObjectARX developers to develop their own application based on SDK of this project. Please refer to [AutoCAD Database Overview](https://help.autodesk.com/view/OARX/2024/ENU/?guid=GUID-4F4766EC-7BFC-456E-BE5B-7676B4658E15) to get more information on AutoCAD drawing database structure. 

This module contains the core classes for interacting with AutoCAD's database and entities (e.g., lines, circles, blocks, etc.).

- Defining and manipulating AutoCAD entities.
- Handling entity attributes and geometric data.
- Storing and retrieving data from the drawing database.

The key classes in this module are as follows.

- AcDbObject: Base class for database-resident objects.
- AcDbEntity: The base class for all objects that can be drawn in AutoCAD (e.g., lines, circles).
- AcDbBlockReference: Represents a reference to a block.
- AcDbPolyline: Represents a polyline entity.
- ...

Please refer to [AcDb classes](https://help.autodesk.com/view/OARX/2024/ENU/?guid=OARX-RefGuide-AcDb_Classes) in [AutoCAD ObjectARX Reference Guide](https://help.autodesk.com/view/OARX/2024/ENU/?guid=OARX-RefGuide-ObjectARX_Reference_Guide) to get more details on those classes.

### graphic-interface (AcGi classes in AutoCAD ObjectARX)

The differnt API interfaces from AutoCAD ObjectARX are used in this module because of the following reasons.

- It isn't friendly to implement API interfaces defined in AcGi classes in AutoCAD ObjectARX.
- Classes in AcGi module aren't used very frequently by AutoCAD ObjectARX developers. 

This module provides the graphics interface to control how AutoCAD entities are displayed on the screen.

- Rendering entities to drawble objects.
- Customizing how objects are displayed, including handling colors, layers, and visibility.

The key classes in this module are as follows.

- AcGiEntity: Base class for drawable objects.
- AcGiRenderer: Interface used to render entities to drawble objects.
- ...

## Contributing

Contributions are welcome! Please open issues or pull requests for bug fixes, new features, or suggestions. For bug reports, providing a link to the problematic drawing will help in reproducing and fixing the issue.

## License

This project is generally licensed under the [MIT License](LICENSE). However, this license does not apply to the following packages contained within this repository:

- `@mlightcad/dxf-json-converter` (GPL-3.0)
- `@mlightcad/libredwg-converter` (GPL-3.0)
- `@mlightcad/libdxfrw-converter` (GPL-2.0)

These packages depend on upstream GPL-licensed parsers (`@mlightcad/dxf-json`, `@mlightcad/libredwg-web`, `@mlightcad/libdxfrw-web`). Please refer to each package's license for details.

### GPL copyleft and Web Worker isolation

The MIT-licensed core (`@mlightcad/data-model`, `@mlightcad/geometry-engine`, `@mlightcad/graphic-interface`, `@mlightcad/common`) does **not** depend on any GPL parser. GPL copyleft therefore does **not** automatically apply to your application merely because you use the RealDWG-Web SDK—**provided that GPL parser code runs only inside separate Web Worker bundles**.

For `@mlightcad/dxf-json-converter` and `@mlightcad/libredwg-converter`, the recommended integration is:

```ts
const dxfConverter = new AcDbDxfConverter({
  useWorker: true,
  parserWorkerUrl: './assets/dxf-parser-worker.js'
})

const dwgConverter = new AcDbLibreDwgConverter({
  useWorker: true,
  parserWorkerUrl: './assets/libredwg-parser-worker.js'
})
```

Deploy the worker scripts (`dxf-parser-worker.js`, `libredwg-parser-worker.js`) from each converter package's `dist/` folder as static assets (see [example vite config](./packages/example/vite.config.ts)).

**How this limits copyleft propagation**

| Component | License | Worker isolation |
| --- | --- | --- |
| Core SDK (`data-model`, etc.) | MIT | N/A — no GPL dependency |
| `dxf-json-converter` / `libredwg-converter` (main bundle) | GPL | Orchestrates parsing; GPL parser execution stays in worker |
| `dxf-parser-worker.js` / `libredwg-parser-worker.js` | GPL | Separate bundle; loaded at runtime; communicates via `postMessage` |
| `libdxfrw-converter` | GPL-2.0 | **No** worker isolation — parser runs on the main thread |

When `useWorker: true` is configured and the worker scripts are deployed separately:

1. GPL parser code is bundled only into the worker scripts, not into your main application bundle.
2. The worker and main thread exchange data through `postMessage` (file bytes in, parsed JSON model out)—a runtime boundary rather than static linking of GPL code into the MIT core.
3. Your MIT-licensed application code can stay under MIT, while the GPL worker bundles remain separate distributable components that must comply with GPL on their own (source availability, license notice, etc.).

**Important caveats**

- **Worker scripts are still GPL.** You must satisfy GPL obligations for those bundles (e.g., provide corresponding source and license notices when you distribute them).
- **DXF main-thread parsing does not isolate GPL code.** `@mlightcad/dxf-json-converter` can parse on the main thread when `useWorker: false`; that mode links GPL parser code into the same JavaScript context as your app. Use `useWorker: true` in production if you want worker-based isolation.
- **DWG via LibreDWG is worker-only.** `@mlightcad/libredwg-converter` requires a Web Worker; it cannot run on the main thread.
- **`@mlightcad/libdxfrw-converter` is different.** It does not provide a worker-based parser bundle; using it loads GPL libdxfrw code on the main thread. Prefer `@mlightcad/libredwg-converter` with worker mode if copyleft isolation matters for your deployment.
- **This is an architectural description, not legal advice.** Interpretation of GPL in browser/Web Worker contexts may vary by jurisdiction and use case. Consult qualified legal counsel for your product if license compliance is critical.