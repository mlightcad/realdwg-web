---
'@mlightcad/data-model': minor
'@mlightcad/libredwg-converter': minor
---

feat(data-model): add dimension text fill and view direction DIMSTYLE fields

Add `dimtfill` (DIMTFILL), `dimtfillclr` (DIMTFILLCLR) and
`dimtxtdirection` (DIMTXTDIRECTION) to `AcDbDimStyleTableRecord` so the
Dimension Style Manager can render the AutoCAD Text tab fields
"Fill color" and "View direction". DXF output uses group codes 69/70 for
the fill pair and 295 for DIMTXTDIRECTION (294 accepted on input).
