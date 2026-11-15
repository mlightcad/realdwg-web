---
'@mlightcad/data-model': patch
---

Keep annotative dimensions in place when their DWG carries per-scale context data (e.g. read by `@mlightcad/dwg-converter`).

- data-model: `AcDbDimension.resolveAnnotativePresentation()` no longer uses the context's `definitionPoint` as the block insertion point. Per-scale `*D` blocks are already in WCS, and that point is the default text location (DWG `def_pt`, DXF 10), so dimensions were shifted by their text position (e.g. drawn far above the title frame in exported PDFs). Every per-scale block is now inserted at the dimension's own block position (DXF 12).
- data-model: adding an annotation scale to a dimension now seeds the new context's `definitionPoint` with the dimension's text position instead of its block position.
