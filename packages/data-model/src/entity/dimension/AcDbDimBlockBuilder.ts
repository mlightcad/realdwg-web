import { AcCmColor, AcCmColorMethod } from '@mlightcad/common'
import {
  AcGeLine3d,
  AcGePoint3d,
  AcGePoint3dLike,
  AcGeVector3d
} from '@mlightcad/geometry-engine'
import {
  AcGiArrowType,
  AcGiMTextAttachmentPoint
} from '@mlightcad/graphic-interface'

import type { AcDbObject } from '../../base/AcDbObject.js'
import { AcDbBlockTableRecord } from '../../database/AcDbBlockTableRecord.js'
import { AcDbDatabase } from '../../database/AcDbDatabase.js'
import {
  AcDbDimStyleTableRecord,
  AcDbDimTextVertical
} from '../../database/AcDbDimStyleTableRecord.js'
import { AcDbDataGenerator } from '../../misc/AcDbDataGenerator.js'
import { acdbDecodeDimStyleColor } from '../../misc/AcDbMLeaderStyleColorCodec.js'
import { AcDbArc } from '../AcDbArc.js'
import { AcDbBlockReference } from '../AcDbBlockReference.js'
import { AcDbLine } from '../AcDbLine.js'
import { AcDbMText } from '../AcDbMText.js'
import { acdbDimFeatureScale } from './AcDbDimFeatureScale.js'
import { acdbResolveDimensionAnnotation } from './AcDbDimMeasurementFormat.js'

export { acdbDimFeatureScale }

/** Closed filled uses empty dimblk in AutoCAD; we store geometry under this BTR name. */
export const CLOSED_FILLED_ARROW_BLOCK = '_CLOSEDFILLED'

export function acdbResolveArrowBlockName(
  dimblk: string | undefined | null
): string {
  if (
    dimblk == null ||
    dimblk === '' ||
    dimblk === AcGiArrowType.ClosedFilled
  ) {
    return CLOSED_FILLED_ARROW_BLOCK
  }
  if (dimblk === AcGiArrowType.None || dimblk.toUpperCase() === '_NONE') {
    return ''
  }
  return dimblk
}

export function acdbEnsureDimArrowBlocks(
  db: AcDbDatabase,
  style: AcDbDimStyleTableRecord
) {
  const generator = new AcDbDataGenerator(db)
  const names = new Set<string>()
  if (style.dimsah === 0) {
    names.add(acdbResolveArrowBlockName(style.dimblk))
  } else {
    names.add(acdbResolveArrowBlockName(style.dimblk1))
    names.add(acdbResolveArrowBlockName(style.dimblk2))
  }
  names.add(acdbResolveArrowBlockName(style.dimldrblk))
  for (const name of names) {
    if (name) generator.ensureArrowBlock(name)
  }
}

/**
 * Maps DIMCLRD / DIMCLRE / DIMCLRT onto {@link AcCmColor}.
 *
 * LibreDWG may hand back a CMC object or a packed CMC int32 rather than a
 * plain ACI; those must be decoded or MTEXT construction throws
 * `ACI not in range [0, 256]` (NaN colorIndex).
 */
function colorFromDimAci(aci: unknown): AcCmColor {
  return acdbDecodeDimStyleColor(aci)
}

export function acdbCreateDimLineEntity(
  start: AcGePoint3dLike,
  end: AcGePoint3dLike,
  style: AcDbDimStyleTableRecord,
  kind: 'dimension' | 'extension' = 'dimension'
): AcDbLine {
  const line = new AcDbLine(start, end)
  line.layer = '0'
  line.color = colorFromDimAci(
    kind === 'dimension' ? style.dimclrd : style.dimclre
  )
  return line
}

export function acdbCreateDimArrowInsert(
  pos: AcGePoint3dLike,
  rotation: number,
  scale: number,
  blockName: string
): AcDbBlockReference | null {
  if (!blockName) return null
  const insert = new AcDbBlockReference(blockName)
  insert.position = pos
  insert.rotation = rotation
  insert.scaleFactors = { x: scale, y: scale, z: scale }
  insert.layer = '0'
  insert.color = new AcCmColor(AcCmColorMethod.ByBlock)
  return insert
}

export function acdbArrowScaleFromStyle(
  style: AcDbDimStyleTableRecord,
  entity?: AcDbObject
): number {
  const scale = acdbDimFeatureScale(style, entity)
  if (style.dimtsz > 0) {
    return style.dimtsz * scale
  }
  return style.dimasz * scale
}

export function acdbTextHeightFromStyle(
  style: AcDbDimStyleTableRecord,
  entity?: AcDbObject
): number {
  return style.dimtxt * acdbDimFeatureScale(style, entity)
}

export function acdbCreateDimMText(options: {
  contents: string
  position: AcGePoint3dLike
  rotation: number
  style: AcDbDimStyleTableRecord
  attachmentPoint?: AcGiMTextAttachmentPoint
  entity?: AcDbObject
}): AcDbMText | null {
  if (!options.contents) return null
  const mtext = new AcDbMText()
  mtext.layer = '0'
  mtext.color = colorFromDimAci(options.style.dimclrt)
  mtext.location = options.position
  mtext.contents = options.contents
  mtext.height = acdbTextHeightFromStyle(options.style, options.entity)
  mtext.direction = {
    x: Math.cos(options.rotation),
    y: Math.sin(options.rotation),
    z: 0
  }
  mtext.styleName = options.style.dimtxsty
  mtext.attachmentPoint =
    options.attachmentPoint ?? attachmentFromDimTad(options.style.dimtad)
  return mtext
}

function attachmentFromDimTad(
  dimtad: AcDbDimTextVertical
): AcGiMTextAttachmentPoint {
  switch (dimtad) {
    case AcDbDimTextVertical.Above:
      return AcGiMTextAttachmentPoint.BottomCenter
    case AcDbDimTextVertical.Below:
      return AcGiMTextAttachmentPoint.TopCenter
    default:
      return AcGiMTextAttachmentPoint.MiddleCenter
  }
}

/**
 * Offset text position along the normal of the dimension line based on dimtad/dimgap.
 */
export function acdbOffsetTextAlongNormal(
  mid: AcGePoint3dLike,
  rotation: number,
  style: AcDbDimStyleTableRecord,
  entity?: AcDbObject
): AcGePoint3d {
  const gap =
    (style.dimgap >= 0 ? style.dimgap : 0) * acdbDimFeatureScale(style, entity)
  const height = acdbTextHeightFromStyle(style, entity)
  let offset = 0
  if (style.dimtad === AcDbDimTextVertical.Above) {
    offset = gap + height * 0.5
  } else if (style.dimtad === AcDbDimTextVertical.Below) {
    offset = -(gap + height * 0.5)
  } else if (style.dimtad === AcDbDimTextVertical.Outside) {
    offset = gap + height * 0.5
  }
  const nx = -Math.sin(rotation)
  const ny = Math.cos(rotation)
  return new AcGePoint3d(mid.x + nx * offset, mid.y + ny * offset, mid.z ?? 0)
}

export function acdbAppendCenterMark(
  block: AcDbBlockTableRecord,
  center: AcGePoint3dLike,
  style: AcDbDimStyleTableRecord,
  entity?: AcDbObject
) {
  const size = style.dimcen * acdbDimFeatureScale(style, entity)
  if (size === 0) return
  const abs = Math.abs(size)
  const c = new AcGePoint3d().copy(center)
  // Mark cross
  block.appendEntity(
    acdbCreateDimLineEntity(
      { x: c.x - abs, y: c.y, z: c.z },
      { x: c.x + abs, y: c.y, z: c.z },
      style,
      'extension'
    )
  )
  block.appendEntity(
    acdbCreateDimLineEntity(
      { x: c.x, y: c.y - abs, z: c.z },
      { x: c.x, y: c.y + abs, z: c.z },
      style,
      'extension'
    )
  )
  // dimcen < 0 also draws circle mark lines to radius (simplified: longer arms)
  if (size < 0) {
    const long = abs * 2
    block.appendEntity(
      acdbCreateDimLineEntity(
        { x: c.x - long, y: c.y, z: c.z },
        { x: c.x + long, y: c.y, z: c.z },
        style,
        'extension'
      )
    )
    block.appendEntity(
      acdbCreateDimLineEntity(
        { x: c.x, y: c.y - long, z: c.z },
        { x: c.x, y: c.y + long, z: c.z },
        style,
        'extension'
      )
    )
  }
}

export function acdbCreateEmptyDimBlock(
  blockName: string
): AcDbBlockTableRecord {
  const block = new AcDbBlockTableRecord()
  block.name = blockName
  return block
}

export function acdbBuildAnnotationText(
  measured: number,
  dimensionText: string | null | undefined,
  style: AcDbDimStyleTableRecord,
  kind: 'linear' | 'angular' | 'radial' | 'diametric'
): string {
  return acdbResolveDimensionAnnotation(measured, dimensionText, style, kind)
}

/**
 * Create a dimension-line arc for angular dimensions.
 */
export function acdbCreateDimArcEntity(
  center: AcGePoint3dLike,
  radius: number,
  startAngle: number,
  endAngle: number,
  style: AcDbDimStyleTableRecord
): AcDbArc {
  const arc = new AcDbArc(center, radius, startAngle, endAngle)
  arc.layer = '0'
  arc.color = colorFromDimAci(style.dimclrd)
  return arc
}

export function acdbUnitVectorFromAngle(angle: number): AcGeVector3d {
  return new AcGeVector3d(Math.cos(angle), Math.sin(angle), 0)
}

export function acdbAngleOfPoints(
  from: AcGePoint3dLike,
  to: AcGePoint3dLike
): number {
  return Math.atan2(to.y - from.y, to.x - from.x)
}

function acdbNormalizeAngle0To2Pi(angle: number): number {
  let v = angle
  while (v < 0) v += Math.PI * 2
  while (v >= Math.PI * 2) v -= Math.PI * 2
  return v
}

function acdbCcwContainsAngle(
  start: number,
  end: number,
  point: number
): boolean {
  if (start <= end) return point >= start && point <= end
  return point >= start || point <= end
}

/**
 * Resolve the CCW angular sweep from ray1→ray2 that contains `arcPoint`.
 * When the arc point lies on the complementary (major) arc, the start/end
 * rays are swapped so measurement matches drawn geometry.
 */
export function acdbResolveAngularSweep(options: {
  center: AcGePoint3dLike
  xLine1: AcGePoint3dLike
  xLine2: AcGePoint3dLike
  arcPoint: AcGePoint3dLike
}): { start: number; end: number; sweep: number } {
  const a1 = acdbAngleOfPoints(options.center, options.xLine1)
  const a2 = acdbAngleOfPoints(options.center, options.xLine2)
  const arcAngle = acdbAngleOfPoints(options.center, options.arcPoint)
  let start = a1
  let end = a2
  const ns = acdbNormalizeAngle0To2Pi(start)
  const ne = acdbNormalizeAngle0To2Pi(end)
  const na = acdbNormalizeAngle0To2Pi(arcAngle)
  if (!acdbCcwContainsAngle(ns, ne, na)) {
    start = a2
    end = a1
  }
  let sweep = end - start
  while (sweep < 0) sweep += Math.PI * 2
  while (sweep > Math.PI * 2) sweep -= Math.PI * 2
  return { start, end, sweep }
}

export function acdbPointAt(
  origin: AcGePoint3dLike,
  angle: number,
  distance: number
): AcGePoint3d {
  return new AcGePoint3d(
    origin.x + Math.cos(angle) * distance,
    origin.y + Math.sin(angle) * distance,
    origin.z ?? 0
  )
}

export function acdbMidPoint(
  a: AcGePoint3dLike,
  b: AcGePoint3dLike
): AcGePoint3d {
  return new AcGePoint3d(
    (a.x + b.x) / 2,
    (a.y + b.y) / 2,
    ((a.z ?? 0) + (b.z ?? 0)) / 2
  )
}

export function acdbExtendLineByDimDle(
  line: AcGeLine3d,
  style: AcDbDimStyleTableRecord,
  entity?: AcDbObject
) {
  const dle = style.dimdle * acdbDimFeatureScale(style, entity)
  if (dle !== 0) {
    line.extend(dle)
    line.extend(dle, true)
  }
}

/**
 * Allocates the next free anonymous dimension block name (`*D{n}`).
 *
 * @param db - Database whose block table is scanned.
 * @returns A `*D{n}` name one greater than the largest existing one.
 */
export function acdbAllocateDimBlockName(db: AcDbDatabase): string {
  let maxNum = 0
  for (const block of db.tables.blockTable.newIterator()) {
    const name = block.name
    if (!name.startsWith('*D')) continue
    const num = Number(name.slice(2))
    if (Number.isInteger(num) && num > maxNum) maxNum = num
  }
  return `*D${maxNum + 1}`
}

/**
 * Removes an anonymous dimension block and erases its entities.
 *
 * `blockTable.remove` alone leaves the child entities registered in the
 * database, so they are removed from the block record first.
 *
 * @param db - Database owning the block.
 * @param blockName - Name of the block to drop. Missing blocks are ignored.
 */
export function acdbDisposeDimBlock(db: AcDbDatabase, blockName: string) {
  const btr = db.tables.blockTable.getAt(blockName)
  if (!btr) return
  const ids: string[] = []
  for (const entity of btr.newIterator()) {
    ids.push(entity.objectId)
  }
  if (ids.length > 0) btr.removeEntity(ids)
  db.tables.blockTable.remove(blockName)
}

/**
 * Normalizes a text angle into (-π/2, π/2] so dimension text never reads
 * upside down, matching AutoCAD's aligned dimension text.
 */
export function acdbReadableTextAngle(angle: number): number {
  let v = Math.atan2(Math.sin(angle), Math.cos(angle))
  if (v > Math.PI / 2 + 1e-9) v -= Math.PI
  else if (v <= -Math.PI / 2 + 1e-9) v += Math.PI
  return v
}

/**
 * Returns the point where a leader from `from` should stop before reaching
 * dimension text centered at `text`, leaving the DIMGAP clearance.
 */
export function acdbLeaderEndBeforeText(
  from: AcGePoint3dLike,
  text: AcGePoint3dLike,
  style: AcDbDimStyleTableRecord,
  entity?: AcDbObject
): AcGePoint3d {
  const clearance =
    (style.dimgap >= 0 ? style.dimgap : 0) *
      acdbDimFeatureScale(style, entity) +
    acdbTextHeightFromStyle(style, entity) * 0.5
  const end = new AcGePoint3d().copy(text)
  const dir = new AcGeVector3d().subVectors(end, from)
  const length = dir.length()
  if (length <= clearance) return end
  return end.sub(dir.multiplyScalar(clearance / length))
}

/**
 * Re-places the dimension arc point of an angular or arc length dimension
 * so the dimension arc runs under text dragged to `text` (DIMTMOVE 0).
 *
 * @param center - Center of the dimension arc.
 * @param arcPoint - Arc point updated in place.
 * @param text - New text position.
 * @param textRadialOffset - Distance from the arc to the text center.
 */
export function acdbMoveArcPointUnderText(
  center: AcGePoint3dLike,
  arcPoint: AcGePoint3d,
  text: AcGePoint3dLike,
  textRadialOffset: number
) {
  const direction = new AcGeVector3d().subVectors(text, center)
  const distance = direction.length()
  if (distance < 1e-9) return
  const radius = Math.max(distance - textRadialOffset, distance * 0.1)
  arcPoint.copy(center).add(direction.multiplyScalar(radius / distance))
}

/**
 * Appends a leader line from `from` to text placed at a user-defined
 * position (DIMTMOVE 1), when the text is farther than one arrow size away.
 */
export function acdbAppendLeaderToText(
  block: AcDbBlockTableRecord,
  from: AcGePoint3dLike,
  text: AcGePoint3dLike,
  style: AcDbDimStyleTableRecord,
  entity?: AcDbObject
) {
  const start = new AcGePoint3d().copy(from)
  if (start.distanceTo(text) <= acdbArrowScaleFromStyle(style, entity)) return
  block.appendEntity(
    acdbCreateDimLineEntity(
      start,
      acdbLeaderEndBeforeText(start, text, style, entity),
      style
    )
  )
}

/**
 * Swings `point` around `center` toward `toward`, keeping its distance from
 * the center (radius and diameter chord grips stay on the circle).
 *
 * @param center - Circle center.
 * @param point - Point on the circle, updated in place.
 * @param toward - Location that sets the new direction from the center.
 */
export function acdbRotatePointAroundCenter(
  center: AcGePoint3dLike,
  point: AcGePoint3d,
  toward: AcGePoint3dLike
) {
  const radius = point.distanceTo(center)
  const direction = new AcGeVector3d().subVectors(toward, center)
  if (radius < 1e-9 || direction.lengthSq() < 1e-18) return
  point.copy(center).add(direction.normalize().multiplyScalar(radius))
}

/**
 * Leader length for radius/diameter text dragged `distance` from the center
 * of a circle of `radius`: zero inside the circle, otherwise the part of the
 * drag beyond the circle minus the horizontal landing drawn before the text.
 */
export function acdbLeaderLengthToText(
  distance: number,
  radius: number,
  style: AcDbDimStyleTableRecord,
  entity?: AcDbObject
): number {
  if (distance <= radius) return 0
  const landing = style.dimasz * acdbDimFeatureScale(style, entity) * 2
  return Math.max(distance - radius - landing, 1e-6)
}
