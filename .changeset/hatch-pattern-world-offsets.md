---
'@mlightcad/data-model': patch
---

Fix pattern hatch line spacing. HATCH entities read from DXF no longer keep the
lines expanded from the bundled PAT library next to their own definition lines
(two interleaved families of strokes, spacings differing by √2). Lines expanded
from a predefined pattern now store their offset as a world-space vector, like
DXF group codes 45/46 and every renderer expect, and DXF output bakes the
pattern angle into them.
