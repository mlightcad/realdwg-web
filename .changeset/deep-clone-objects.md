---
'@mlightcad/data-model': minor
---

Add AutoCAD-style deep cloning. `AcDbDatabase.deepCloneObjects()` copies entities within a drawing, `wblockCloneObjects()` copies them into another database, `wblock(ids)` writes them into a new database and `insert(transform | blockName, sourceDb)` inserts a database's model space as entities or as a new block. Every layer, linetype, text style, dimension style, block definition (recursively), MLINE/MLEADER style and image definition the entities reference comes along; `AcDbDuplicateRecordCloning` decides what happens to names the destination already has (Ignore, Replace, MangleName), and anonymous blocks such as dimension blocks always get a new name. `AcDbIdMapping` records the translation. Entities take part through the new `deepClone()`, `wblockClone()`, `collectCloneDependencies()` and `translateClonedReferences()` methods. `AcDbArcAlignedText` now implements `transformBy()`.
