---
'@mlightcad/data-model': patch
---

Keep LEADER, MULTILEADER and MLINE style colors from following the layer color

`worldDraw` records whether the entity's own color was ByLayer on the renderer
traits. LEADER (DIMCLRD, including DSTYLE overrides), MULTILEADER (leader line
and text style colors) and MLINE (style element and fill colors) swapped in
their own draw color but kept that flag, so a ByLayer leader on layer 0 whose
DIMCLRD is red was repainted with the layer's ACI 7 once the viewer re-synced
layer materials. The substituted color now carries its own ByLayer provenance,
through the new protected `AcDbEntity.applyTraitsColor` helper.
