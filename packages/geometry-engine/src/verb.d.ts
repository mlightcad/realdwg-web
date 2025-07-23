import verb from 'verb-nurbs-web'

declare module 'verb-nurbs-web' {
  namespace geom {
    export class EllipseArc extends verb.geom.NurbsCurve {
      constructor(
        center: number[],
        xaxis: number[],
        yaxis: number[],
        minAngle: number,
        maxAngle: number
      )
    }
  }
}
