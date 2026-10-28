---
'@mlightcad/data-model': patch
---

Allow multiple consecutive redo steps

`AcDbDatabaseTransactionManager.redo()` restored the replayed record with
`AcDbUndoStack.push()`, which also clears the redo stack. After one redo the
remaining redo records were discarded, so `canRedo()` returned false and only
a single step could ever be redone.

Add `AcDbUndoStack.pushUndo()`, which restores the record on the undo stack
(trimming to `maxDepth`) without touching the redo stack, and use it from
`redo()`. `push()` keeps clearing redo history for new user operations.
