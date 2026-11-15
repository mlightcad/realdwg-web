---
'@mlightcad/libredwg-converter': patch
---

Keep per-entity dimension style overrides that reference a block by handle.

- libredwg-converter: XData group 1005 arrives from LibreDWG as a `bigint` and was dropped on import, so a `ACAD`/`DSTYLE` override such as `(1070 . 341) (1005 . 0)` never reached the entity. Handles are now stored as uppercase hex strings, so a leader keeps its cleared DIMLDRBLK and AutoCAD's closed-filled arrow instead of falling back to a custom arrow block.
- Bumps `@mlightcad/libredwg-web` to 0.8.9, which reports linear (`DIMENSION_LINEAR`) dimensions with their own subclass marker and reads the LAYER locked/plot flags correctly.
