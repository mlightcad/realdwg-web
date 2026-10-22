import { AcGeVector2d } from './AcGeVector2d.js'
import { AcGeVector3d } from './AcGeVector3d.js'

export type AcGeVector = AcGeVector2d | AcGeVector3d
export type AcGeVectorLike = {
  x: number
  y: number
  z?: number
}
