---
'@mlightcad/data-model': patch
---

`AcDbHatch` now draws its island style (DXF code 75): `Normal` fills by odd parity, `Outer` fills only the outermost area and `Ignore` fills through every island. Previously every hatch was drawn as `Normal`, so `Outer` and `Ignore` hatches showed filled inner islands and changing `hatchStyle` had no visible effect. Setting `hatchStyle` now also refreshes the cached fill areas, so editing the style of an existing hatch changes its fill, as in AutoCAD.
