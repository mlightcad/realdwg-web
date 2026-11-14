---
'@mlightcad/data-model': patch
---

Make multileader (MLEADER) creation and grip editing behave like AutoCAD.

- Grips: `AcDbMLeader` now exposes one grip per leader vertex (arrowhead and intermediate vertices), one landing grip, one landing-end grip and one content grip, instead of every internal point. Previously coincident grips were stacked and their indices were shifted, so dragging the arrowhead moved the text and dragging the landing or text did nothing. The landing and content grips move the text together with its landings (leader tips stay) and flip the landing to the other side when the text crosses its leader. The landing-end grip lengthens the landing and keeps the text attached.
- New `applyMLeaderStyle(style, annotationScale)` copies a style's text height, arrow size, landing length/gap (scaled by the overall scale, or by the annotation scale for annotative styles), leader type, text style and text attachment settings onto an entity.
- New `attachContentToLanding()` places MText next to the landing the AutoCAD way: attached by its left or right side depending on the landing direction, one landing gap away, at the height given by the left/right text attachment type.
- New `addLeaderLineAtPoint(point)` joins a new leader line to the landing on the side of the content facing it, or creates a landing past the far edge of the content on the other side.
- Leader lines with intermediate vertices now always connect to their landing, spline leaders are drawn as curves, and a content base point on the other side of the content no longer draws a landing across the text. `AcDbMLeaderPropertyOverrideFlag` is exported.
