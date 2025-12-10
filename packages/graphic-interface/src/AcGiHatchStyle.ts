import { AcGePoint2dLike } from '@mlightcad/geometry-engine'

export interface AcGiHatchPatternLine {
  angle: number
  origin: AcGePoint2dLike
  delta: AcGePoint2dLike
  dashPattern: number[]
}

/**
 * Hatch style
 */
export interface AcGiHatchStyle {
  solidFill: boolean
  patternAngle: number
  patternLines: AcGiHatchPatternLine[]
}
