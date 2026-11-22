---
'@mlightcad/data-model': minor
'@mlightcad/libredwg-converter': minor
---

Adds `AcDbMInsertBlock` for MINSERT entities (rows × columns arrays of a block), matching ObjectARX. The array fields `columnCount`, `rowCount`, `columnSpacing` and `rowSpacing` moved from `AcDbBlockReference` to `AcDbMInsertBlock` as `columns`, `rows`, `columnSpacing` and `rowSpacing`. Array spacing is in drawing units and is no longer multiplied by the block scale factors, as in AutoCAD. DXF and DWG import create an `AcDbMInsertBlock` when the INSERT has more than one row or column (or the `AcDbMInsertBlock` subclass marker), and DXF export writes it as `INSERT` with that marker.
