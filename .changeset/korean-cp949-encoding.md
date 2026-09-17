---
'@mlightcad/data-model': minor
'@mlightcad/libredwg-converter': patch
---

Fix Korean (CP949/EUC-KR) text garbling in DXF/DWG files

`$DWGCODEPAGE CP949` (25) previously mapped to `'utf-8'`, garbling layer
names, annotations, text entities, and block attributes in Korean drawings; it
now maps to `'euc-kr'` (the WHATWG label whose decoder, windows-949, covers the
full CP949 range).

Added an `encoding` open option (`AcDbOpenDatabaseOptions.encoding`) that
overrides auto-detection when the declared code page is wrong — common aliases
such as `'cp949'` are normalized to `TextDecoder`-supported labels.

Bump `@mlightcad/libredwg-web` to `0.7.11` for DWG encoding / `\U+XXXX` /
orphan-entity recovery fixes.
