---
'@mlightcad/data-model': patch
---

fix(data-model): keep transactions, undo and redo linear for very large edits

Undoing a large append (for example a PDF import with ~340k entities) took close
to an hour and could throw "Maximum call stack size exceeded":

- `AcDbChangeRecorder` looked up earlier changes with a linear scan on every
  record. Modify, sysvar and append/remove lookups now go through indexes, and
  cancelled append/remove pairs are compacted in one pass.
- `AcDbChangeApplier` removed entities one by one during undo/redo, scanning the
  whole block each time. Consecutive removals from the same block now run as one
  `removeEntity(ids)` call.
- `AcDbDatabase.notifyEntityAppended/Erased` spread batched entities into
  `push(...items)`, which overflows the stack for large batches.

Undo of 338,821 imported entities now takes about 2 s.
