---
'@mlightcad/data-model': minor
---

Replace the vendored `@mlightcad/emf-converter` fork with upstream `emf-converter` (Excel OLE clip / LOGFONT fixes are upstream now). The workspace package `@mlightcad/emf-converter` is removed from this monorepo; consumers of that package should depend on `emf-converter` directly. OLE rasterization loads the converter via dynamic `import()` so apps that never touch OLE frames avoid the larger upstream bundle.
