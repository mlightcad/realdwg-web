---
'@mlightcad/data-model': minor
---

Add ObjectARX-style `AcDbEntity.explode()` / `subExplode()` and `AcDbEntity.setPropertiesFrom()`. Polylines (LWPOLYLINE, 2D/3D POLYLINE), block references (one level; ellipses for non-uniformly scaled circles and arcs; attribute definitions come back), dimensions, leaders, multileaders, tables, tolerances, multiline text, multilines, polyface/polygon meshes and pattern hatches can now be exploded. MINSERT, xref and unexplodable blocks return no entities. Also adds `AcDbPolyline.getBulgeAt()` / `getStartWidthAt()` / `getEndWidthAt()`, `AcDbBlockReference.isExplodable`, and explode helpers (`acdbTransformForExplode`, `acdbExplodeBlockContent`, `acdbTessellateHatchPattern`, ...).
