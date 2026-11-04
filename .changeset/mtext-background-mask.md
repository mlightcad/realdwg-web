---
'@mlightcad/data-model': patch
'@mlightcad/libredwg-converter': patch
---

Draw and convert MTEXT background masks (DXF groups 90 / 63 / 45 / 421)

MTEXT already stored background-fill fields and could round-trip some of them
in DXF, but LibreDWG conversion dropped the mask fields and `subWorldDraw`
never painted the object-level mask. Rendering now draws a solid mask behind
the text (drawing-window colour when group 90 = 2), and the LibreDWG
converter maps background-fill flags, scale, and colour.
