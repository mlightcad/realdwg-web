---
'@mlightcad/data-model': minor
'@mlightcad/libredwg-converter': minor
---

**Breaking changes**

- Array fields moved off `AcDbBlockReference`: use `AcDbMInsertBlock` with `columns` / `rows` / `columnSpacing` / `rowSpacing` instead of the old `columnCount` / `rowCount` / `columnSpacing` / `rowSpacing` on `AcDbBlockReference`.
- Array spacing is in drawing units and is **no longer multiplied by the block scale factors** (AutoCAD behavior). Scaled MINSERT arrays will lay out differently than before.

Adds `AcDbMInsertBlock` for MINSERT entities (rows × columns arrays of a block), matching ObjectARX. DXF and DWG import create an `AcDbMInsertBlock` when the INSERT has more than one row or column, non-zero array spacing, or the `AcDbMInsertBlock` subclass marker; DXF export writes it as `INSERT` with that marker.
