---
'@mlightcad/common': patch
'@mlightcad/geometry-engine': patch
'@mlightcad/data-model': patch
---

Hot-path performance optimizations for DXF entity loading and block rendering

- `AcCmObject.set` now short-circuits when every attribute already equals its
  current value (reference-equality pre-check): session bookkeeping resets like
  a real set but nothing dispatches, and the change walk lazily allocates the
  `changes` array.
- ASCII DXF pair reading parses group codes/values from byte spans (no per-line
  string allocations); encoding auto-detect trusts valid UTF-8 bytes first and
  only falls back to pre-2007 `$DWGCODEPAGE` when the bytes are not valid UTF-8.
- OCS/WCS transforms gained in-place variants (`acgeGetOcsReferenceVectorInto`,
  `acgeTransformOcsPointToWcsInto`) plus a +Z-axis short-circuit; `AcDbLine`,
  `AcDbCircle`, `AcDbArc` and `AcDbPolyline` dxfIn reuse scratch points instead
  of allocating temporaries per entity.
- `AcDbLine`, `AcDbCircle`, `AcDbArc`, `AcDbEllipse` and `AcDbSpline` no longer
  build default geometry in their constructors — geometry is created lazily on
  first access, and the DXF entity factory constructs them without arguments.
- `AcDbRenderingCache` gains an LRU budget (512 entries / 64MB estimated) with
  least-recently-used eviction; compacted templates are retired until
  document-close dispose because their geometry buffers are shared with live
  scene clones.
- Handle seed generation switches to BigInt once values exceed
  `Number.MAX_SAFE_INTEGER`, avoiding hangs on large `$HANDSEED` values.
- NURBS fit-point interpolation uses a banded sparse linear solver with a
  shared factorization across X/Y/Z right-hand sides.
