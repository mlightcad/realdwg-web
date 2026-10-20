---
'@mlightcad/data-model': patch
'@mlightcad/libredwg-converter': patch
---

Register TILEMODE as an AutoCAD-compatible integer system variable

Expose `AcDbDatabase.tilemode` as a drawing-resident sysvar (`0` = paper
space, `1` = model space) through `AcDbSystemVariables` /
`AcDbSysVarManager`, matching AutoCAD's Integer type and header semantics.
