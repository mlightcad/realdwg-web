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
`AcDbCurve.getPointAtDist` / `getFirstDeriv`. EXPLODE and grips tear down or
edit the action graph. DWG round-trip of assoc objects may still drop the
action body until LibreDWG import is extended — prefer DXF for persistence.
