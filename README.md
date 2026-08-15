# RealDWG-Web

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![npm version](https://img.shields.io/npm/v/@mlightcad/data-model.svg)](https://www.npmjs.com/package/@mlightcad/data-model)

AutoCAD RealDWG is a software development toolkit (SDK) provided by Autodesk that allows developers to read, write, and create DWG and DXF files (AutoCAD's native drawing file formats) without needing AutoCAD installed.

The target of this project is to create one web-version of AutoCAD RealDWG by providing the similar API. For now, it supports reading DWG and DXF file only. In the future, it will support write DWG and DXF too.

- [**🌐 Live Demo**](https://mlightcad.com/realdwg-web-example/)
- **🌐 API Docs**: [Read the Docs](https://realdwg-web.readthedocs.io/en/latest/) (versioned) · [GitHub Pages](https://mlightcad.github.io/realdwg-web/) (latest/dev)

## App Based on Realdwg-Web

- [Google Drive DWG Viewer](https://workspace.google.com/u/0/marketplace/app/dwg_viewer/641533811831)

## Converter Registration Mechanism

To support reading both DXF and DWG files (and potentially other formats in the future), this project provides a flexible mechanism for registering and unregistering file converters. This is managed by the `AcDbDatabaseConverterManager` class.

### How It Works

- Each file type (e.g., DXF, DWG) is associated with a converter class that knows how to parse and import that file format into the drawing database.
- The `AcDbDatabaseConverterManager` maintains a registry of these converters, allowing you to register or unregister converters for specific file types at runtime.
- **DXF is registered by default.** `AcDbDatabaseConverterManager` registers the built-in MIT `AcDbNativeDxfConverter` when the singleton is created. You only need to register a DXF converter if you want to replace that default.
- **DWG is not registered by default.** Register a DWG converter (typically `@mlightcad/libredwg-converter`) before calling `AcDbDatabase.read()` on DWG files.

`@mlightcad/libredwg-converter` runs its LibreDWG parser in a Web Worker. That is a deliberate licensing choice: the upstream parser is copyleft (GPL), so keeping it in a separate worker bundle helps isolate that code from the main application. The built-in `AcDbNativeDxfConverter` does **not** need a worker — it is MIT-licensed and runs on the main thread.

Deprecated GPL converters (`@mlightcad/dxf-json-converter`, `@mlightcad/libdxfrw-converter`) have moved to the separate [dwg-dxf-converter](https://github.com/mlightcad/dwg-dxf-converter) repository and are no longer documented here.

### Registering Converters

DXF works out of the box. Register a DWG converter before reading DWG files:

```ts
import {
  AcDbDatabaseConverterManager,
  AcDbFileType
} from '@mlightcad/data-model'
import { AcDbLibreDwgConverter } from '@mlightcad/libredwg-converter'

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

Deploy `libredwg-parser-worker.js` and its sibling `libredwg-web.wasm` from `@mlightcad/libredwg-converter`'s `dist/` folder to the same public directory (see [example vite config](./packages/example/vite.config.ts)).

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

For a complete example, see the [example project](./packages/example/src/main.ts) in this repository, or the customer-facing demo [realdwg-web-example](https://github.com/mlightcad/realdwg-web-example).

### Font Loading and Self-Hosting

When using a viewer such as `@mlightcad/cad-simple-viewer`, fonts are loaded from a
`baseUrl` (default: jsDelivr CDN). If the CDN is unreachable, `@mlightcad/data-model`
continues parsing DWG/DXF entities by default; text may fall back until fonts load.

For self-hosted fonts, templates, `fonts.json`, and server setup, see
[Self Hosted Fonts and Templates](https://github.com/mlightcad/cad-viewer/wiki/Self-Hosted-Fonts-and-Templates)
in the cad-viewer wiki.

### Extensibility

This mechanism allows you to:
- Add support for new file types by implementing and registering new converters.
- Replace or remove converters at runtime as needed.
- Listen for registration/unregistration events if you need to react to changes in available converters.

This design ensures the system is open for extension and can easily adapt to new requirements or file formats in the future.

## Architecture

AutoCAD holds an absolute dominant position in the 2D CAD field. A large number of vertical applications and third-party plugins have been developed based on AutoCAD ObjectARX, and there are many software engineers familiar with AutoCAD ObjectARX. Therefore, this project mimics the architecture of AutoCAD ObjectARX and adopts similar API interfaces to AutoCAD ObjectARX.

### libredwg-converter (DWG file support)

This module provides a DWG file converter for the RealDWG-Web ecosystem, enabling reading and conversion of DWG files into the drawing database. It is powered by the LibreDWG library compiled to WebAssembly and is designed to be registered with the converter manager for DWG file support.

DWG parsing is provided through a dedicated Web Worker bundle (`libredwg-parser-worker.js`). Worker-only usage is a licensing choice, not a platform constraint: it keeps the copyleft LibreDWG parser separate from the main application bundle so that MIT-licensed apps can integrate DWG support more safely.

### AcDbNativeDxfConverter (DXF file support)

`@mlightcad/data-model` ships a built-in MIT DXF converter, `AcDbNativeDxfConverter`. It is registered by default when `AcDbDatabaseConverterManager` is created, streams DXF pairs into the database on the main thread, and requires no Web Worker or extra parser assets.

Deprecated GPL alternatives (`@mlightcad/dxf-json-converter`, `@mlightcad/libdxfrw-converter`) live in the separate [dwg-dxf-converter](https://github.com/mlightcad/dwg-dxf-converter) repository.

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

This module contains the core classes for interacting with AutoCAD's database and entities (e.g., lines, circles, blocks, etc.). It also includes the built-in MIT DXF converter `AcDbNativeDxfConverter`, which is registered by default for `AcDbFileType.DXF`.

- Defining and manipulating AutoCAD entities.
- Handling entity attributes and geometric data.
- Storing and retrieving data from the drawing database.
- Reading DXF files without an extra converter package.

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

## Private packages (maintainers)

`@mlightcad/dwg-converter` is **not** part of this public repository and is never
built or published by public GitHub CI. Maintainers who need it locally can clone
it into the workspace:

```bash
pnpm setup:private
pnpm install
pnpm --filter @mlightcad/dwg-converter build
```

Override the clone URL with `DWG_CONVERTER_REPO_URL` if needed. The directory
`packages/dwg-converter` is gitignored so it cannot be committed here. Local
`pnpm install` may temporarily add that package to `pnpm-lock.yaml` — **do not
commit** those lockfile changes; public CI must keep a lockfile without it.

**Customers** install the same package from GitHub Packages (not public npm). Do
not point the whole `@mlightcad` scope at GitHub Packages—only authenticate, then
install with an explicit registry:

```ini
# .npmrc
registry=https://registry.npmjs.org/
//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
```

```bash
pnpm add @mlightcad/data-model
pnpm add @mlightcad/dwg-converter --registry https://npm.pkg.github.com
```

Publishing `@mlightcad/dwg-converter` happens only from its private repository CI.

## Contributing

Contributions are welcome! Please open issues or pull requests for bug fixes, new features, or suggestions. For bug reports, providing a link to the problematic drawing will help in reproducing and fixing the issue.

## License

This project is generally licensed under the [MIT License](LICENSE). However, this license does not apply to `@mlightcad/libredwg-converter` (GPL-3.0) in this repository.

Deprecated GPL converters (`@mlightcad/dxf-json-converter`, `@mlightcad/libdxfrw-converter`) live in the separate [dwg-dxf-converter](https://github.com/mlightcad/dwg-dxf-converter) repository. Please refer to that repository and each package's license for details.

### Prefer the built-in DXF converter

For DXF files, use the built-in **`AcDbNativeDxfConverter`** in `@mlightcad/data-model`:

- **No GPL license issues for DXF** — it is MIT-licensed and part of the core SDK.
- **Faster and simpler** — streams DXF into the database on the main thread with no Web Worker and no extra parser assets.
- **Registered by default** — accessing `AcDbDatabaseConverterManager` is enough to call `AcDbDatabase.read(..., AcDbFileType.DXF)`.

For DWG, register a separate converter package (prefer `@mlightcad/libredwg-converter` with worker mode).

### GPL copyleft and Web Worker isolation

The MIT-licensed core (`@mlightcad/data-model`, `@mlightcad/geometry-engine`, `@mlightcad/graphic-interface`, `@mlightcad/common`) does **not** depend on any GPL parser. Reading DXF through `AcDbNativeDxfConverter` stays entirely under MIT.

GPL copyleft therefore does **not** automatically apply to your application merely because you use the RealDWG-Web SDK—**provided that any GPL parser code you do use runs only inside separate Web Worker bundles**.

For DWG via `@mlightcad/libredwg-converter`, the recommended integration is:

```ts
const dwgConverter = new AcDbLibreDwgConverter({
  useWorker: true,
  parserWorkerUrl: './assets/libredwg-parser-worker.js'
})
```

Deploy `libredwg-parser-worker.js` and its sibling `libredwg-web.wasm` from `@mlightcad/libredwg-converter`'s `dist/` folder as static assets in the same directory (see [example vite config](./packages/example/vite.config.ts)).

**How this limits copyleft propagation**

| Component | License | Worker isolation |
| --- | --- | --- |
| Core SDK (`data-model`, including `AcDbNativeDxfConverter`) | MIT | N/A — no GPL dependency |
| `libredwg-converter` (main bundle) | GPL | Orchestrates parsing; GPL parser execution stays in worker |
| `libredwg-parser-worker.js` + `libredwg-web.wasm` | GPL | Separate worker + wasm assets; loaded at runtime; communicates via `postMessage` |

When `useWorker: true` is configured and the worker script is deployed separately:

1. GPL parser code is bundled only into the worker script, not into your main application bundle.
2. The worker and main thread exchange data through `postMessage` (file bytes in, parsed JSON model out)—a runtime boundary rather than static linking of GPL code into the MIT core.
3. Your MIT-licensed application code can stay under MIT, while the GPL worker bundle remains a separate distributable component that must comply with GPL on its own (source availability, license notice, etc.).

**Important caveats**

- **Prefer `AcDbNativeDxfConverter` for DXF** to avoid GPL entirely for that format.
- **Worker scripts are still GPL.** You must satisfy GPL obligations for those bundles (e.g., provide corresponding source and license notices when you distribute them).
- **DWG via LibreDWG is worker-only.** `@mlightcad/libredwg-converter` requires a Web Worker; it cannot run on the main thread.
- **This is an architectural description, not legal advice.** Interpretation of GPL in browser/Web Worker contexts may vary by jurisdiction and use case. Consult qualified legal counsel for your product if license compliance is critical.