---
'@mlightcad/libredwg-converter': patch
---

Bump `@mlightcad/libredwg-web` to 0.8.8. Its model-space orphan handling now
skips entities owned by erased blocks (stale `*D` dimension pictures), so those
hidden lines, arrowheads and text no longer leak into drawings read from DWG.
