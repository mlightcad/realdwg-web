import type { AcDbObject } from '../../base/AcDbObject.js'
import { AcDbDimStyleTableRecord } from '../../database/AcDbDimStyleTableRecord.js'
import { acdbResolveAnnotationScaleDrawInfo } from '../../misc/AcDbAnnotationScale.js'

/**
 * Scale applied to dimension text, arrows, gaps, and extension offsets.
 *
 * Prefer the entity's matched annotation-scale context (CANNOSCALE) when the
 * dimension is annotative. Otherwise use the per-dimstyle annotative factor
 * from the database, then DIMSCALE (0 falls back to 1).
 */
export function acdbDimFeatureScale(
  style: AcDbDimStyleTableRecord,
  entity?: AcDbObject
): number {
  if (entity) {
    const resolved = acdbResolveAnnotationScaleDrawInfo(entity)
    if (resolved.preferred && resolved.preferred.scale.scaleFactor > 0) {
      return resolved.preferred.scale.scaleFactor
    }
  }
  try {
    // `.database` falls back to the host working DB and throws when unset
    // (detached dimstyles in unit tests / clones).
    const annotated = style.database?.getDimStyleAnnotationScale(style.name)
    if (annotated != null && annotated > 0) return annotated
  } catch {
    // Fall through to DIMSCALE.
  }
  return style.dimscale > 0 ? style.dimscale : 1
}
