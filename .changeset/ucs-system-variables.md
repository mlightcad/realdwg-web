---
'@mlightcad/data-model': minor
'@mlightcad/libredwg-converter': patch
---

Add AutoCAD UCS system variables (`UCSAXISANG`, `UCSBASE`, `UCSFOLLOW`, `UCSICON`, `UCSNAME`, `UCSORG`, `UCSSELECTMODE`, `UCSVIEW`, `UCSXDIR`, `UCSYDIR`, `WORLDUCS`). `UCSFOLLOW` / `UCSICON` are backed by VPORT `*Active` (ObjectARX), DXF HEADER mirrors them, and `WORLDUCS` stays in sync when the current UCS origin or axes change. LibreDWG conversion maps the drawing-backed UCS header fields.
