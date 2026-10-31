---
'@mlightcad/data-model': patch
---

Expose LEADER properties for the property palette

`AcDbLeader` inherited the base `AcDbEntity.properties`, so selecting a LEADER
in the viewer showed only the generic handle/color/layer rows. Override it with
the DXF fields the entity actually stores:

- `leader` group: dimension style name, annotation type (mtext / tolerance /
  block / none), arrowhead, hook line, hook-line direction, spline flag,
  associated annotation handle, and ByBlock color.
- `text` group: text height and text width.
- `geometry` group: the vertex array plus normal, horizontal direction, and the
  optional block/annotation offsets (`undefined` until the DXF 212/213 vectors
  are present).

Property names and enum labels reuse the vocabulary the palette already
translates (`entity.property` and `entity.enum`), so the leader now renders
localized labels and editable editors like the other entities.
