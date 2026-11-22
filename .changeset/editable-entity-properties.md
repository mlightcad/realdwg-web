---
'@mlightcad/data-model': minor
---

Entity `properties` are now fully editable for a property palette. Point and vector edits go through the entity setters, so extents and derived data stay correct. Array properties (polyline, 2D/3D polyline, spline, leader, multiline, trace/solid, 3D face and mesh vertices) return copies and accept a whole array through `accessor.set`. Circle diameter, circumference and area are editable, Ray/Xline get a second point, and Text justification and the MLeader leader/text colors can be edited. Normals and structural fields (table grid size, OLE type, solid ids) are now read-only. `editable` now always matches whether `accessor.set` exists. Adds the `acdbCreateProperty`, `acdbPoint3dProperties`, `acdbVector3dProperties`, `acdbPointArrayProperty` and `acdbEnumOptions` helpers. Fixes the ellipse `majorAxisRadius` property writing to the center X coordinate.
