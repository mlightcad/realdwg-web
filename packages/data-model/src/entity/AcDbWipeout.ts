import { AcGeArea2d, AcGePolyline2d } from '@mlightcad/geometry-engine'
import { AcGiRenderer } from '@mlightcad/graphic-interface'

import { AcDbRasterImage } from './AcDbRasterImage'

export class AcDbWipeout extends AcDbRasterImage {
  /**
   * @inheritdoc
   */
  draw(renderer: AcGiRenderer) {
    const points = this.boundaryPath()
    const area = new AcGeArea2d()
    area.add(new AcGePolyline2d(points))
    return renderer.area(area, {
      color: 0x000000,
      solidFill: true,
      patternAngle: 0,
      patternLines: []
    })
  }
}
