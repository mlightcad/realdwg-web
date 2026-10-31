---
'@mlightcad/data-model': patch
'@mlightcad/libredwg-converter': patch
---

Paint LEADER lines from DIMCLRD and resolve DWG arrow-block handles

Leaders were drawn with the entity color, so a ByLayer leader stayed on the
layer color when DIMCLRD (or a DSTYLE override, or DXF group 77) named a
different color. The leader line and arrowhead now follow that dimension
color, including group 77 value 256 as ByLayer, and a leader whose line color
differs from the entity color leaves the direct `lineStrip` batch path.

LibreDWG exposes DIMLDRBLK as a numeric block handle and often leaves DIMBLK*
as a handle or `.`. Those values resolve to block names, and a missing block
table falls back to the closed-filled arrow instead of aborting conversion.
