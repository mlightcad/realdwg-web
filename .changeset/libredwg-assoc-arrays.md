---
'@mlightcad/libredwg-converter': minor
'@mlightcad/data-model': patch
---

feat(libredwg-converter): convert associative arrays from DWG

DWG files read through LibreDWG now keep their associative arrays (path,
polar, rectangular): the converter builds the ACDBASSOC* network, actions,
dependencies, array action bodies and action parameters from libredwg-web's
`objects.ASSOC*` collections, links the top-level network into the named
object dictionary, and attaches dependencies as persistent reactors. Needs a
libredwg-web release that exposes these objects; with older releases arrays
load as plain block references, as before.

data-model keeps an associative-array item's relative transform and second
entity handle (item flags 2 / 0x10) through DXF and DWG import and DXF export.
