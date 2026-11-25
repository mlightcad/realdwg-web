---
'@mlightcad/libredwg-converter': patch
---

chore(libredwg-converter): use libredwg-web 0.9.4 association types

Bump `@mlightcad/libredwg-web` to 0.9.4, which exposes the `ACDBASSOC*`
objects, and read them through its own types (`DwgDatabase.objects.ASSOC*`)
instead of locally declared shapes. DWG associative arrays read through
LibreDWG are now live associative arrays out of the box.
