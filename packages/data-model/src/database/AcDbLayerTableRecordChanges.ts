import { AcCmColor, AcCmTransparency } from '@mlightcad/common'

import {
  AcDbLayerTableRecord,
  AcDbLayerTableRecordAttrs
} from './AcDbLayerTableRecord'

/**
 * Captures the layer-table-record fields that participate in modification events.
 *
 * @param layer - Layer whose current property values should be snapshotted
 * @returns Attribute bag comparable across before/after states
 */
export function snapshotLayerTableRecordAttrs(
  layer: AcDbLayerTableRecord
): AcDbLayerTableRecordAttrs {
  return {
    name: layer.name,
    color: layer.color.clone(),
    description: layer.description,
    standardFlags: layer.standardFlags,
    isHidden: layer.isHidden,
    isInUse: layer.isInUse,
    isOff: layer.isOff,
    isPlottable: layer.isPlottable,
    transparency: layer.transparency.clone(),
    linetype: layer.linetype,
    lineWeight: layer.lineWeight,
    materialId: layer.materialId
  }
}

/**
 * Computes the attribute delta between two layer snapshots.
 *
 * @param before - State before a mutation
 * @param after - State after a mutation
 * @returns Changed properties from `before` to `after`, omitting unchanged fields
 */
export function diffLayerTableRecordAttrs(
  before: AcDbLayerTableRecordAttrs,
  after: AcDbLayerTableRecordAttrs
): Partial<AcDbLayerTableRecordAttrs> {
  const changes: Partial<AcDbLayerTableRecordAttrs> = {}

  if (before.name !== after.name) {
    changes.name = after.name
  }
  if (!colorsEqual(before.color, after.color)) {
    changes.color = after.color.clone()
  }
  if (before.description !== after.description) {
    changes.description = after.description
  }
  if (before.standardFlags !== after.standardFlags) {
    changes.standardFlags = after.standardFlags
  }
  if (before.isHidden !== after.isHidden) {
    changes.isHidden = after.isHidden
  }
  if (before.isInUse !== after.isInUse) {
    changes.isInUse = after.isInUse
  }
  if (before.isOff !== after.isOff) {
    changes.isOff = after.isOff
  }
  if (before.isPlottable !== after.isPlottable) {
    changes.isPlottable = after.isPlottable
  }
  if (!transparenciesEqual(before.transparency, after.transparency)) {
    changes.transparency = after.transparency.clone()
  }
  if (before.linetype !== after.linetype) {
    changes.linetype = after.linetype
  }
  if (before.lineWeight !== after.lineWeight) {
    changes.lineWeight = after.lineWeight
  }
  if (before.materialId !== after.materialId) {
    changes.materialId = after.materialId
  }

  return changes
}

/**
 * Computes the attribute delta between two layer table records.
 *
 * @param before - Layer state before a mutation
 * @param after - Layer state after a mutation
 * @returns Changed properties from `before` to `after`
 */
export function diffLayerTableRecords(
  before: AcDbLayerTableRecord,
  after: AcDbLayerTableRecord
): Partial<AcDbLayerTableRecordAttrs> {
  return diffLayerTableRecordAttrs(
    snapshotLayerTableRecordAttrs(before),
    snapshotLayerTableRecordAttrs(after)
  )
}

function colorsEqual(a: AcCmColor, b: AcCmColor): boolean {
  return a.equals(b)
}

function transparenciesEqual(
  a: AcCmTransparency,
  b: AcCmTransparency
): boolean {
  return a.equals(b)
}
