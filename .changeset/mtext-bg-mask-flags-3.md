---
'@mlightcad/data-model': patch
'@mlightcad/libredwg-converter': patch
---

Treat MTEXT background-mask flags 3 as canvas background

AutoCAD stores "Use drawing background" as DXF group 90 = 3 (bit 0x02).
Converters and DXF in/out only recognised 2, so paper-space masks fell back
to a solid fill and could hide text. Also keep ACI fill indices (including
ACI 7) as ByACI so foreground contrast follows the canvas background.

LibreDWG often still emits a ByLayer CMC placeholder (`0xC0000000`) with
flags 2/3; the LibreDWG converter now ignores that colour when using the
canvas background so the mask is not painted black.
