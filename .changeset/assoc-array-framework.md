---
'@mlightcad/data-model': minor
---

feat(data-model): add ObjectARX-style associative array framework

Introduces `AcDbAssocNetwork` / `AcDbAssocAction` / `AcDbAssocDependency` /
`AcDbAssocManager` and `AcDbAssocArrayActionBody` with rectangular, polar, and
path parameters. Associative arrays remain `AcDbBlockReference` of anonymous
`*U` blocks; `createInstance` builds source/array blocks and evaluates item
transforms. Adds `ARRAYASSOCIATIVITY`, `ARRAYTYPE`, read-only
`ARRAYEDITSTATE` (`setArrayEditState`), anonymous `*U` allocation helpers, and
`AcDbCurve.getPointAtDist` / `getFirstDeriv`. Grips edit the array; erasing
or exploding the array INSERT orphans its action, which is then skipped by
evaluation and DXF export, so undo/redo restore a working array.

Associative arrays use AutoCAD's persistent layout, so arrays made in AutoCAD
load and arrays made here open in AutoCAD: networks live under
`ACAD_ASSOCNETWORK` (NOD and space-block extension dictionaries), parameters
are named value parameters of the `ACDBASSOCACTION`, item transforms are stored
in `ACDBASSOCARRAYACTIONBODY`, and the INSERT links to its action through
`{ACAD_REACTORS` dependencies. DXF export adds the needed `ObjectDBX Classes`
CLASS entries. `AcDbObject` gains persistent reactors (DXF round-trip), and
`AcDbAssocStatus` uses ObjectARX values.
