---
'@mlightcad/data-model': patch
---

Guard ensureMLineStyle against missing dictionary styleName

Incomplete MLINESTYLE dictionary entries (common from LibreDWG) can omit
`styleName`. Comparing with `.toUpperCase()` threw during
`ensureDatabaseDefaults` after parse, aborting otherwise-successful opens.
Optional-chain the key and styleName comparisons so defaults still fill in.
