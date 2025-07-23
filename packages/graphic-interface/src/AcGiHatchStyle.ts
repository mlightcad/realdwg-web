import { AcGePoint2dLike } from '@mlightcad/geometry-engine'

export interface AcGiHatchPatternLine {
  angle: number
  origin: AcGePoint2dLike
  delta: AcGePoint2dLike
  dashPattern: number[]
}

export interface AcGiHatchType {
  solidFill: boolean
  patternAngle: number
  patternLines: AcGiHatchPatternLine[]
}

/**
 * Hatch style
 */
export interface AcGiHatchStyle extends AcGiHatchType {
  /**
   * Line color
   */
  color: number
}
