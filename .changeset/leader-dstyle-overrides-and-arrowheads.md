---
'@mlightcad/data-model': patch
---

Honor per-entity DSTYLE overrides and draw LEADER arrowheads/hook lines per DXF

AutoCAD stores per-entity dimension variable changes as an `ACAD` / `DSTYLE`
XData subsection (`1070 . <DIMSTYLE group code>` pairs). Dimensions, leaders and
tolerance frames only read the referenced `DIMSTYLE` table record, so edits made
in the Properties palette — arrow size, gap, arrow block, text style — were
dropped on import and the entities were drawn with the drawing-wide defaults.

Add `misc/AcDbDimStyleOverrides.ts`, which reads that subsection, resolves
handle-valued variables (`340`–`344`) to block/text style names, and layers the
result over a detached copy of the referenced record. `AcDbDimension`,
`AcDbLeader` and `AcDbFcf` now resolve their style through it and drop the cached
copy when `ACAD` XData changes or the entity moves to another database;
`AcDbObject` gained `iterateXData` so the read path never materializes the
compact imported XData, plus `onXDataChanged` / `onDatabaseChanged` hooks.

Also fix LEADER rendering to follow the entity's own DXF flags:

- DXF 71 now draws an arrowhead sized from DIMASZ and taken from DIMLDRBLK,
  generating missing AutoCAD built-in arrow blocks (`_DOT`, `_ARCHTICK`) the way
  dimensions do. Leaders that may draw an arrowhead opt out of the batched
  `lineStrip` path.
- DXF 75 is authoritative for the hook line, so a leader without one is no
  longer extended over an unrelated nearby MTEXT, and DXF 73 = 3 leaders no
  longer borrow a neighbour's width. A negative DXF 41 flips the landing side.

Fix DIMDSEP overrides: the separator arrives as its ASCII code in a `1070`
pair, and assigning that number to the string property made `replace` splice
the code into the measurement (`10.00` → `104400`).
