# CAD Fidelity Extensions (Fork Roadmap)

This document describes the **planned and in-progress extensions** on the
[`OuroborosNo2/realdwg-web`](https://github.com/OuroborosNo2/realdwg-web) fork of
[`mlightcad/realdwg-web`](https://github.com/mlightcad/realdwg-web)
(`@mlightcad/data-model` and related packages).

**Audience**: maintainers of MLightCAD / RealDWG-Web, and consumers who need
DXF/DWG round-trip fidelity for AutoCAD-compatible toolchains (e.g. ODA File
Converter).

**Scope**: generic CAD entities, parameters, symbol tables, and blocks.
**Out of scope**: process-card / manufacturing / product-specific schemas.

License remains **MIT** (same as upstream).

---

## 1. Goals

| Goal | Success criterion |
|------|-------------------|
| ODA-readable `dxfOut` | Minimal database (LINE + CIRCLE) → DXF → ODA → DWG (ACAD2010) succeeds |
| DIMENSION definition points | Linear / aligned / angular / diameter / radius expose and serialize definition points matching DXF group codes |
| HATCH boundary loops | Stable ordered loops (polyline and/or edge list) survive `dxfIn` / dump / `dxfOut` |
| Upstream-friendly PRs | One concern per PR; English commit/PR text; minimal reproducible DXF fixtures |

Consumers may lock this fork via `pnpm.overrides` / git tags while patches are
proposed upstream. Upstream merge is **desirable but not required** for fork use.

---

## 2. Packages touched

| Package | Role in extensions |
|---------|-------------------|
| `@mlightcad/data-model` | Entity classes, `dxfIn` / `dxfOut`, handles, tables |
| `@mlightcad/geometry-engine` | Loop / polyline / edge geometry for HATCH |
| `@mlightcad/graphic-interface` | Only if dump/render APIs must expose new fields |
| `@mlightcad/libredwg-converter` | Only if DWG path differs from DXF native path (secondary) |

Primary work lands in **`packages/data-model`**.

---

## 3. Track A — `dxfOut` handles / symbol tables (ODA)

### Problem

Even a minimal drawing (one `LINE`, one `CIRCLE`) produced by `dxfOut` can fail
ODA File Converter with errors such as:

- `Duplicate or invalid handle`
- `AcDbBlockTableRecord can't be cast to AcDbDictionary`
- Suspicious header `$HANDSEED` (e.g. `1` while entities already consume handles)

### Parameters / tables involved

| Item | DXF / API surface | Notes |
|------|-------------------|-------|
| `$HANDSEED` | HEADER group 9 / 5 | Must be the **next** unused handle (hex), not a stale seed |
| Entity handles | group 5 | Monotonic, unique across database |
| Soft/hard pointers | groups 330 / 360 / 340… | Must point at real objects of the declared type |
| Block table | `BLOCK_RECORD` / `*Model_Space` / `*Paper_Space` | Must remain block records, not dictionaries |
| Named object dictionary | `ACAD_GROUP`, layout dict, etc. | Owner/reactor graph must be consistent |
| `AcDbDxfFiler.nextHandle` | filer state during `dxfOut` | Seed written at end of HEADER must match filer |

### Entities used in the minimal fixture

- `LINE` (start / end)
- `CIRCLE` (center / radius)
- Implicit: `BLOCK` / `BLOCK_RECORD` for model space; layer `0`; default linetype

### Acceptance

1. Fixture DXF opens in AutoCAD / ODA without handle errors.
2. `$HANDSEED` > max assigned handle.
3. Regression test (or documented ODA CLI smoke) in CI or `tools/`.

### Upstream PR shape

- **Title**: `fix(dxfOut): emit valid $HANDSEED and consistent handles for ODA`
- **Do not bundle** DIMENSION or HATCH changes.

---

## 4. Track B — DIMENSION definition points

### Problem

Public dump / extract paths often expose only `measurement` / `textPosition` /
style name. Downstream rebuilders need **definition points** (DXF `defpoints`)
to recreate the dimension without guessing geometry.

### Dimension entity types in scope

| Class | DXF type | Definition parameters (WCS unless noted) |
|-------|----------|------------------------------------------|
| `AcDbAlignedDimension` | DIMENSION (aligned) | `xLine1Point`, `xLine2Point`, `dimLinePoint`, `oblique`, `rotation` |
| `AcDbRotatedDimension` | DIMENSION (rotated) | Same family as aligned + rotation angle for dim line |
| `AcDb3PointAngularDimension` | DIMENSION (angular) | Angle vertex + two extension-line points + arc point |
| `AcDbDiametricDimension` | DIMENSION (diameter) | `chordPoint`, far chord / opposite point, leader length |
| `AcDbRadialDimension` | DIMENSION (radius) | `center`, `chordPoint`, leader length |
| `AcDbArcDimension` | DIMENSION (arc) | Center / ext points / arc point (as implemented) |
| `AcDbOrdinateDimension` | DIMENSION (ordinate) | Origin / defining point / leader end |
| `AcDbDimension` (base) | — | `dimBlockId`, `dimBlockPosition` (g12), `_dxfDefinitionPoint` (g10), `dimensionText`, `measurement`, `textPosition`, `textRotation`, `horizontalRotation`, `dimensionType` (g70), `attachmentPoint` (g71), `dimensionStyleName`, `normal` |

### Related tables / blocks

| Item | Role |
|------|------|
| `DIMSTYLE` table record | Arrow, text height, ext-line suppress, dimscl, etc. |
| Anonymous dimension block (`*D…`) | Geometry block referenced by `dimBlockId`; **read** for display; prefer typed definition points for rebuild |
| Layer `DEFPOINTS` | Definition points layer convention (do not treat as ordinary geometry) |

### DXF group codes to preserve (non-exhaustive)

| Code | Meaning |
|------|---------|
| 10 | Definition point (subclass-specific; often dim-line / center) |
| 11 | Middle of dimension text |
| 12 | Insertion point for dimension block (clone) |
| 13 / 14 | Extension-line start points (linear / aligned) |
| 15 / 16 | Angular / diameter / radius specific points |
| 40 | Leader length (radial / diametric) |
| 50 | Rotation (rotated dimension) |
| 51 | Horizontal direction |
| 70 | Dimension type flags |
| 1 / 2 | User text / block name |

### Acceptance

1. Round-trip: DXF with each subtype → `dxfIn` → dump exposes definition points → `dxfOut` keeps codes 10/13/14/…  
2. Unit tests per subtype with a **minimal** fixture (no product drawings).  
3. Anonymous `*D` blocks remain readable; rebuild APIs must not require exploding them.

### Upstream PR shape

- **Title**: `feat(dimension): expose and serialize definition points for extract/dxfOut`
- Separate PR from HATCH / HANDSEED.

---

## 5. Track C — HATCH boundary loops

### Problem

`AcDbHatch` may load with empty or incomplete `loops` after `dxfIn`, so
consumers cannot reconstruct a closed boundary (`boundary_points` / edge list).
Rendering thickeners (PDF stroke width) are **not** a substitute for loop API
fidelity.

### Hatch parameters in scope

| Parameter / API | Meaning |
|-----------------|--------|
| `patternName` / `patternType` | `UserDefined` / `Predefined` / `Custom` (`AcDbHatchPatternType`) |
| `hatchStyle` | `Normal` / `Outer` / `Ignore` (`AcDbHatchStyle`) |
| `patternAngle` / `patternScale` / `patternSpace` / `patternDouble` | Pattern layout |
| `associative` | Whether hatch tracks boundary objects |
| `objectType` | Classic hatch vs gradient (`AcDbHatchObjectType`) |
| Gradient fields | `gradientName`, angle, colors (when `GradientObject`) |
| `add(loop)` / `_geo.loops` | Ordered outer-then-inner loops (`AcGeLoop2d` / `AcGePolyline2d` / curve edges) |
| Color / transparency / layer | Standard entity props |

### Boundary representation (target dump / API)

Prefer a stable export shape (illustrative):

```ts
type HatchBoundaryLoop = {
  /** 0 = outer, then islands */
  index: number
  /** polyline vertices in OCS or WCS (document which) */
  polyline?: { bulge?: number; point: [number, number, number?] }[]
  /** optional edge list when not a simple polyline */
  edges?: Array<
    | { type: 'line'; start: number[]; end: number[] }
    | { type: 'arc'; center: number[]; radius: number; startAngle: number; endAngle: number }
    | { type: 'ellipse' | 'spline'; /* … */ }
  >
  isClosed: boolean
}
```

### Related entities / blocks

| Item | Role |
|------|------|
| Boundary path entities | LINE / ARC / CIRCLE / ELLIPSE / SPLINE / LWPOLYLINE referenced when associative |
| Pattern definition | `acad.pat` predefined names (`ANSI31`, `SOLID`, …) |
| Block references | Only if hatch is inside a block; loops still in hatch OCS |

### Acceptance

1. Fixture HATCH with one outer polyline loop round-trips with non-empty loops.  
2. Island (inner) loop order preserved.  
3. Dump API documents coordinate space (OCS vs WCS).

### Upstream PR shape

- **Title**: `fix(hatch): preserve ordered boundary loops on dxfIn/dump/dxfOut`
- Do not mix with DIMENSION definition-point work.

---

## 6. Secondary / follow-up (not first wave)

| Topic | Entities / params | Notes |
|-------|-------------------|-------|
| SPLINE control / fit points | `AcDbSpline`: degree, control points, fit points, knots, weights | Needed when dump returns empty `control_points` |
| Full entity property dump | All `AcDbEntity` subclasses | `detail=full` style extract |
| Default group-code presets | lineweight 370, thickness 39, transparency | Align `dxfOut` defaults with common samples |
| ACI color profile for PDF | Not data-model core | Belongs in viewer / PDF plugin |

---

## 7. Blocks and symbol tables (cross-cutting)

| Name / pattern | Treatment in this fork |
|----------------|------------------------|
| `*Model_Space` / `*Paper_Space` | Must remain valid `BLOCK_RECORD`s in `dxfOut` |
| Anonymous dimension `*D…` | Read-only geometry for display; rebuild via definition points |
| Anonymous hatch/other `*U…` / `*X…` | Do not orphan-explode as ordinary named blocks |
| `DEFPOINTS` layer | Keep; do not promote to plot geometry |
| Layer / Linetype / Text style / Dim style tables | Preserve handles and name refs used by entities above |

---

## 8. How to consume this fork

Until packages are published under a scoped npm name:

```yaml
# pnpm-workspace.yaml (consumer example)
overrides:
  '@mlightcad/data-model': link:../realdwg-web/packages/data-model
  '@mlightcad/common': link:../realdwg-web/packages/common
  '@mlightcad/geometry-engine': link:../realdwg-web/packages/geometry-engine
  '@mlightcad/graphic-interface': link:../realdwg-web/packages/graphic-interface
  '@mlightcad/emf-converter': link:../realdwg-web/packages/emf-converter
```

Build the fork first (`pnpm install && pnpm build` at repo root). Pin a **git tag**
on this fork for reproducible consumer builds.

---

## 9. Issue / PR hygiene (for upstream contribution)

1. **One track per PR** (A / B / C).  
2. English titles and bodies; generic CAD wording only.  
3. Attach a minimal DXF under `packages/data-model/__tests__/fixtures/` (or equivalent).  
4. State ODA version when claiming Track A.  
5. Do **not** include product-specific JSON schemas or manufacturing semantics.

Tracking issues on this fork:

- Track A — ODA-readable `dxfOut` / `$HANDSEED`
- Track B — DIMENSION definition points
- Track C — HATCH boundary loops

(See GitHub Issues; link them here when filed.)

---

## 10. Relationship to upstream

| Action | Status |
|--------|--------|
| Maintain this public fork | Active |
| Propose patches to `mlightcad/realdwg-web` | Intended after each track hardens |
| Require upstream merge for fork usefulness | **No** |

When opening an upstream PR, paste the relevant section of this document and the
minimal fixture checklist.
