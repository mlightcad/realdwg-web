import { AcGiLineWeight } from '@mlightcad/data-model'
import type { DwgDatabase } from '@mlightcad/libredwg-web'

/**
 * Lineweights (hundredths of a millimetre) addressed by DWG lineweight
 * indexes 0–23. Indexes 24–28 are unused.
 */
const DWG_LINEWEIGHTS: readonly AcGiLineWeight[] = [
  0, 5, 9, 13, 15, 18, 20, 25, 30, 35, 40, 50, 53, 60, 70, 80, 90, 100, 106,
  120, 140, 158, 200, 211
]

/**
 * Converts a DWG lineweight index into the {@link AcGiLineWeight} value used
 * by DXF group code 370 and the drawing database.
 *
 * DWG files do not store lineweights as hundredths of a millimetre. They store
 * a 5-bit index instead: 0–23 address the standard weights, 29 is ByLayer,
 * 30 is ByBlock and 31 is Default. LibreDWG hands that index through as is.
 *
 * @param index Raw DWG lineweight index.
 * @param fallback Value returned for an index outside the table.
 * @returns The matching lineweight, or `fallback` for unused indexes.
 */
export function acdbLineWeightFromDwgIndex(
  index: number,
  fallback: AcGiLineWeight = AcGiLineWeight.ByLayer
): AcGiLineWeight {
  if (index === 29) return AcGiLineWeight.ByLayer
  if (index === 30) return AcGiLineWeight.ByBlock
  if (index === 31) return AcGiLineWeight.ByLineWeightDefault
  return DWG_LINEWEIGHTS[index] ?? fallback
}

interface LineWeightCarrier {
  lineweight?: number
  attribs?: LineWeightCarrier[]
  vertices?: LineWeightCarrier[]
}

/**
 * Rewrites the lineweights LibreDWG reports as DWG indexes into
 * {@link AcGiLineWeight} values, in place.
 *
 * LibreDWG stores the index for both DWG and DXF input: when reading DXF it
 * maps group 370 to the index (`-2` ByBlock becomes 30, an omitted 370
 * becomes 29 ByLayer). Indexes and real values overlap (30 is ByBlock as an
 * index but 0.30 mm as a value), so every entity and layer is converted.
 *
 * Pre-R2000 DWG files have no lineweights at all, so their entities become
 * ByLayer and their layers Default, matching how AutoCAD opens them. DXF
 * files are not version-gated: LibreDWG already fills defaults for missing
 * group 370 values.
 *
 * @param database Database returned by LibreDWG's `convertEx`.
 * @param isDwg Whether the database was read from a DWG (not DXF) file.
 */
export function acdbNormalizeLibreDwgLineWeights(
  database: DwgDatabase,
  isDwg: boolean
) {
  const hasLineWeights = !isDwg || isR2000OrLater(database.header?.ACADVER)

  for (const layer of database.tables?.LAYER?.entries ?? []) {
    if (layer.lineweight == null) continue
    layer.lineweight = hasLineWeights
      ? acdbLineWeightFromDwgIndex(
          layer.lineweight,
          AcGiLineWeight.ByLineWeightDefault
        )
      : AcGiLineWeight.ByLineWeightDefault
  }

  // Model-space entities are reachable from both `database.entities` and the
  // model-space block record, so track visits to convert each entity once.
  const visited = new Set<LineWeightCarrier>()
  const visit = (entities?: LineWeightCarrier[]) => {
    if (!entities) return
    for (const entity of entities) {
      if (visited.has(entity)) continue
      visited.add(entity)
      if (entity.lineweight != null) {
        entity.lineweight = hasLineWeights
          ? acdbLineWeightFromDwgIndex(entity.lineweight)
          : AcGiLineWeight.ByLayer
      }
      visit(entity.attribs)
      visit(entity.vertices)
    }
  }
  visit(database.entities as LineWeightCarrier[])
  for (const btr of database.tables?.BLOCK_RECORD?.entries ?? []) {
    visit(btr.entities as LineWeightCarrier[])
  }
}

/** Whether `acadver` (e.g. `AC1015`) is AutoCAD 2000 or later. */
function isR2000OrLater(acadver: unknown): boolean {
  const match =
    typeof acadver === 'string' ? /^AC(\d{4})$/.exec(acadver.trim()) : null
  // Unknown versions are assumed modern: LibreDWG fills ACADVER for every
  // file it reads, and R2000+ drawings are by far the most common.
  return match ? Number(match[1]) >= 1015 : true
}
