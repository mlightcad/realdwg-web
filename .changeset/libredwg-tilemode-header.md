---
'@mlightcad/libredwg-converter': patch
---

Read TILEMODE from the DWG header

The LibreDWG converter never set `AcDbDatabase.tilemode`, so DWG drawings
saved with a paper-space layout active were reported as model space and opened
on Model. Map `header.TILEMODE` the same way the DXF header reader maps
`$TILEMODE`, defaulting to model space when the variable is missing.
