---
'@mlightcad/data-model': patch
---

Draw WIPEOUT as a solid mask instead of reusing the last hatch pattern

`AcDbWipeout.subWorldDraw` set `isBackgroundFill` but left `fillType` alone.
Renderer traits are shared across entities, so a wipeout drawn after a
patterned hatch inherited that hatch's pattern: the viewer painted it as
background-coloured hatch lines that did not mask, and PDF export tessellated
the pattern across the whole wipeout (a dense ANSI38 left about 750k strokes
per wipeout, so export of affected drawings never finished). Wipeouts now
reset `fillType` to a solid fill, like `AcDbTrace`.
