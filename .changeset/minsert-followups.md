---
'@mlightcad/data-model': patch
'@mlightcad/libredwg-converter': patch
---

Hardens MINSERT import: `acdbCreateEntityForDxfIn('INSERT')` returns null so callers must use `acdbDxfInEntity` / `acdbDxfInInsert` (which pick `AcDbMInsertBlock` vs `AcDbBlockReference`). DXF and DWG import now keep 1×1 inserts with non-zero array spacing as `AcDbMInsertBlock` instead of dropping groups 44/45.
