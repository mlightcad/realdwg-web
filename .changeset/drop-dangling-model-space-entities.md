---
'@mlightcad/libredwg-converter': patch
---

Hide DWG entities left over from erased anonymous blocks (e.g. stale `*D` dimension pictures). LibreDWG adopted these block-owned entities into `*Model_Space` because their owner block no longer exists, so geometry that AutoCAD does not show became visible.
