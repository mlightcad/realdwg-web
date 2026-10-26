import { AcDbDimStyleTableRecord } from '../../database/AcDbDimStyleTableRecord.js'

/**
 * Scale applied to dimension text, arrows, gaps, and extension offsets.
 *
 * Annotative dimensions are drawn at paper size times the annotation scale
 * (drawing units per paper unit). That factor replaces DIMSCALE. Otherwise
 * DIMSCALE is used, and 0 falls back to 1.
 */
export function acdbDimFeatureScale(style: AcDbDimStyleTableRecord): number {
  const annotated = style.database?.getDimStyleAnnotationScale(style.name)
  if (annotated != null && annotated > 0) return annotated
  return style.dimscale > 0 ? style.dimscale : 1
}
