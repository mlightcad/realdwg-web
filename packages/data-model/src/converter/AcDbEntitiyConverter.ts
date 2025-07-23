import { ArcEntity } from '@mlightcad/dxf-json/dist/parser/entities/arc'
import { CircleEntity } from '@mlightcad/dxf-json/dist/parser/entities/circle'
import {
  AlignedDimensionEntity,
  AngularDimensionEntity,
  DimensionEntityCommon,
  OrdinateDimensionEntity,
  RadialDiameterDimensionEntity
} from '@mlightcad/dxf-json/dist/parser/entities/dimension/types'
import { EllipseEntity } from '@mlightcad/dxf-json/dist/parser/entities/ellipse'
import {
  ArcEdge,
  BoundaryPathEdge,
  EdgeBoundaryPath,
  EllipseEdge,
  HatchEntity,
  LineEdge,
  PolylineBoundaryPath,
  SplineEdge
} from '@mlightcad/dxf-json/dist/parser/entities/hatch/types'
import { ImageEntity } from '@mlightcad/dxf-json/dist/parser/entities/image'
import { InsertEntity } from '@mlightcad/dxf-json/dist/parser/entities/insert'
import { LeaderEntity } from '@mlightcad/dxf-json/dist/parser/entities/leader'
import { LineEntity } from '@mlightcad/dxf-json/dist/parser/entities/line'
import { MTextEntity } from '@mlightcad/dxf-json/dist/parser/entities/mtext'
import { PointEntity } from '@mlightcad/dxf-json/dist/parser/entities/point'
import { PolylineEntity } from '@mlightcad/dxf-json/dist/parser/entities/polyline'
import { RayEntity } from '@mlightcad/dxf-json/dist/parser/entities/ray'
import { CommonDxfEntity } from '@mlightcad/dxf-json/dist/parser/entities/shared'
import { SolidEntity } from '@mlightcad/dxf-json/dist/parser/entities/solid'
import { SplineEntity } from '@mlightcad/dxf-json/dist/parser/entities/spline'
import { TableEntity } from '@mlightcad/dxf-json/dist/parser/entities/table'
import { TextEntity } from '@mlightcad/dxf-json/dist/parser/entities/text'
import { ViewportEntity } from '@mlightcad/dxf-json/dist/parser/entities/viewport/types'
import { WipeoutEntity } from '@mlightcad/dxf-json/dist/parser/entities/wipeout'
import { XlineEntity } from '@mlightcad/dxf-json/dist/parser/entities/xline'
import {
  AcGeCircArc2d,
  AcGeEllipseArc2d,
  AcGeLine2d,
  AcGeLoop2d,
  AcGeMathUtil,
  AcGePoint2d,
  AcGePoint3d,
  AcGePoint3dLike,
  AcGePointLike,
  AcGePolyline2d,
  AcGeSpline3d,
  AcGeVector2d,
  AcGeVector3d
} from '@mlightcad/geometry-engine'
import {
  AcGiMTextAttachmentPoint,
  AcGiMTextFlowDirection
} from '@mlightcad/graphic-interface'

import {
  AcDb3PointAngularDimension,
  AcDbAlignedDimension,
  AcDbArc,
  AcDbBlockReference,
  AcDbCircle,
  AcDbDiametricDimension,
  AcDbDimension,
  AcDbEllipse,
  AcDbEntity,
  AcDbHatch,
  AcDbHatchPatternType,
  AcDbHatchStyle,
  AcDbLeader,
  AcDbLeaderAnnotationType,
  AcDbLine,
  AcDbLineSpacingStyle,
  AcDbMText,
  AcDbOrdinateDimension,
  AcDbPoint,
  AcDbPolyline,
  AcDbRadialDimension,
  AcDbRasterImage,
  AcDbRasterImageClipBoundaryType,
  AcDbRay,
  AcDbSpline,
  AcDbTable,
  AcDbTableCell,
  AcDbText,
  AcDbTextHorizontalMode,
  AcDbTextVerticalMode,
  AcDbTrace,
  AcDbViewport,
  AcDbWipeout,
  AcDbXline
} from '../entity'

export class AcDbEntityConverter {
  convert(entity: CommonDxfEntity): AcDbEntity | null {
    const dbEntity = this.createEntity(entity)
    if (dbEntity) {
      this.processCommonAttrs(entity, dbEntity)
    }
    return dbEntity
  }

  /**
   * Create the corresponding drawing database entity from data in dxf format
   * @param entity Input entity data in dxf format
   * @returns Return the converted drawing database entity
   */
  private createEntity(entity: CommonDxfEntity): AcDbEntity | null {
    if (entity.type == 'ARC') {
      return this.convertArc(entity as ArcEntity)
    } else if (entity.type == 'CIRCLE') {
      return this.convertCirle(entity as CircleEntity)
    } else if (entity.type == 'DIMENSION') {
      return this.convertDimension(entity as DimensionEntityCommon)
    } else if (entity.type == 'ELLIPSE') {
      return this.convertEllipse(entity as EllipseEntity)
    } else if (entity.type == 'HATCH') {
      return this.convertHatch(entity as HatchEntity)
    } else if (entity.type == 'IMAGE') {
      return this.convertImage(entity as ImageEntity)
    } else if (entity.type == 'LEADER') {
      return this.convertLeader(entity as LeaderEntity)
    } else if (entity.type == 'LINE') {
      return this.convertLine(entity as LineEntity)
    } else if (entity.type == 'MTEXT') {
      return this.convertMText(entity as MTextEntity)
    } else if (entity.type == 'POLYLINE' || entity.type == 'LWPOLYLINE') {
      return this.convertPolyline(entity as PolylineEntity)
    } else if (entity.type == 'POINT') {
      return this.convertPoint(entity as PointEntity)
    } else if (entity.type == 'RAY') {
      return this.convertRay(entity as RayEntity)
    } else if (entity.type == 'SPLINE') {
      return this.convertSpline(entity as SplineEntity)
    } else if (entity.type == 'ACAD_TABLE') {
      return this.convertTable(entity as TableEntity)
    } else if (entity.type == 'TEXT') {
      return this.convertText(entity as TextEntity)
    } else if (entity.type == 'SOLID') {
      return this.convertSolid(entity as SolidEntity)
    } else if (entity.type == 'VIEWPORT') {
      return this.convertViewport(entity as ViewportEntity)
    } else if (entity.type == 'WIPEOUT') {
      return this.convertWipeout(entity as WipeoutEntity)
    } else if (entity.type == 'XLINE') {
      return this.convertXline(entity as XlineEntity)
    } else if (entity.type == 'INSERT') {
      return this.convertBlockReference(entity as InsertEntity)
    }
    return null
  }

  private convertArc(arc: ArcEntity) {
    const dbEntity = new AcDbArc(
      arc.center,
      arc.radius,
      AcGeMathUtil.degToRad(arc.startAngle),
      AcGeMathUtil.degToRad(arc.endAngle)
    )
    return dbEntity
  }

  private convertCirle(circle: CircleEntity) {
    const dbEntity = new AcDbCircle(circle.center, circle.radius)
    return dbEntity
  }

  private convertEllipse(ellipse: EllipseEntity) {
    const majorAxis = new AcGeVector3d(ellipse.majorAxisEndPoint)
    const majorAxisRadius = majorAxis.length()
    const dbEntity = new AcDbEllipse(
      ellipse.center,
      AcGeVector3d.Z_AXIS,
      majorAxis,
      majorAxisRadius,
      majorAxisRadius * ellipse.axisRatio,
      ellipse.startAngle,
      ellipse.endAngle
    )
    return dbEntity
  }

  private convertLine(line: LineEntity) {
    const start = line.startPoint
    const end = line.endPoint
    const dbEntity = new AcDbLine(
      new AcGePoint3d(start.x, start.y, start.z || 0),
      new AcGePoint3d(end.x, end.y, end.z || 0)
    )
    return dbEntity
  }

  private convertSpline(spline: SplineEntity) {
    if (spline.numberOfControlPoints > 0 && spline.numberOfKnots > 0) {
      const dbEntity = new AcDbSpline(
        spline.controlPoints,
        spline.knots,
        spline.weights
      )
      dbEntity.closed = !!(spline.flag & 0x01)
      return dbEntity
    } else if (spline.numberOfFitPoints > 0) {
      const fitPoints = this.numberArrayToPointArray(
        spline.fitPoints,
        spline.numberOfFitPoints
      )
      if (fitPoints != null) {
        const dbEntity = new AcDbSpline(fitPoints, 'Uniform')
        dbEntity.closed = !!(spline.flag & 0x01)
        return dbEntity
      }
    }
    return null
  }

  private convertPoint(point: PointEntity) {
    const dbEntity = new AcDbPoint()
    dbEntity.position = point.position
    return dbEntity
  }

  private convertSolid(solid: SolidEntity) {
    const dbEntity = new AcDbTrace()
    solid.points.forEach((point, index) => dbEntity.setPointAt(index, point))
    dbEntity.thickness = solid.thickness
    return dbEntity
  }

  private convertPolyline(polyline: PolylineEntity) {
    // Polyline flag (bit-coded; default = 0):
    // https://help.autodesk.com/view/OARX/2023/ENU/?guid=GUID-ABF6B778-BE20-4B49-9B58-A94E64CEFFF3
    //
    // 1 = This is a closed polyline (or a polygon mesh closed in the M direction)
    // 2 = Curve-fit vertices have been added
    // 4 = Spline-fit vertices have been added
    // 8 = This is a 3D polyline
    // 16 = This is a 3D polygon mesh
    // 32 = The polygon mesh is closed in the N direction
    // 64 = The polyline is a polyface mesh
    // 128 = The linetype pattern is generated continuously around the vertices of this polyline
    const dbEntity = new AcDbPolyline()
    dbEntity.closed = !!(polyline.flag & 0x01)
    polyline.vertices.forEach((vertex, index) => {
      dbEntity.addVertexAt(
        index,
        new AcGePoint2d(vertex.x, vertex.y),
        vertex.bulge,
        vertex.startWidth,
        vertex.endWidth
      )
    })
    return dbEntity
  }

  private convertHatch(hatch: HatchEntity) {
    const dbEntity = new AcDbHatch()

    hatch.definitionLines?.forEach(item => {
      dbEntity.definitionLines.push({
        angle: item.angle,
        origin: item.base,
        delta: item.offset,
        dashPattern: item.numberOfDashLengths > 0 ? item.dashLengths : []
      })
    })
    dbEntity.hatchStyle = hatch.hatchStyle as unknown as AcDbHatchStyle
    dbEntity.patternName = hatch.patternName
    dbEntity.patternType = hatch.patternType as unknown as AcDbHatchPatternType
    dbEntity.patternAngle = hatch.patternAngle == null ? 0 : hatch.patternAngle
    dbEntity.patternScale = hatch.patternScale == null ? 0 : hatch.patternScale

    const paths = hatch.boundaryPaths
    paths.forEach(path => {
      const flag = path.boundaryPathTypeFlag
      // Check whether it is a polyline
      if (flag & 0x02) {
        const polylinePath = path as PolylineBoundaryPath
        const polyline = new AcGePolyline2d()
        polyline.closed = polylinePath.isClosed
        polylinePath.vertices.forEach((vertex, index) => {
          polyline.addVertexAt(index, {
            x: vertex.x,
            y: vertex.y,
            bulge: vertex.bulge
          })
        })
        dbEntity.add(polyline)
      } else {
        const edgePath = path as EdgeBoundaryPath<BoundaryPathEdge>
        const loop = new AcGeLoop2d()
        edgePath.edges.forEach(edge => {
          if (edge.type == 1) {
            const line = edge as LineEdge
            loop.add(new AcGeLine2d(line.start, line.end))
          } else if (edge.type == 2) {
            const arc = edge as ArcEdge
            loop.add(
              new AcGeCircArc2d(
                arc.center,
                arc.radius,
                AcGeMathUtil.degToRad(arc.startAngle || 0),
                AcGeMathUtil.degToRad(arc.endAngle || 0),
                !arc.isCCW
              )
            )
          } else if (edge.type == 3) {
            const ellipse = edge as EllipseEdge
            const majorAxis = new AcGeVector2d()
            majorAxis.subVectors(ellipse.end, ellipse.center)
            const majorAxisRadius = Math.sqrt(
              Math.pow(ellipse.end.x, 2) + Math.pow(ellipse.end.y, 2)
            )
            // Property name 'lengthOfMinorAxis' is really confusing.
            // Actually length of minor axis means percentage of major axis length.
            const minorAxisRadius = majorAxisRadius * ellipse.lengthOfMinorAxis
            let startAngle = AcGeMathUtil.degToRad(ellipse.startAngle || 0)
            let endAngle = AcGeMathUtil.degToRad(ellipse.endAngle || 0)
            const rotation = Math.atan2(ellipse.end.y, ellipse.end.x)
            if (!ellipse.isCCW) {
              // when clockwise, need to handle start/end angles
              startAngle = Math.PI * 2 - startAngle
              endAngle = Math.PI * 2 - endAngle
            }
            loop.add(
              new AcGeEllipseArc2d(
                { ...ellipse.center, z: 0 },
                majorAxisRadius,
                minorAxisRadius,
                startAngle,
                endAngle,
                !ellipse.isCCW,
                rotation
              )
            )
          } else if (edge.type == 4) {
            const spline = edge as SplineEdge
            if (spline.numberOfControlPoints > 0 && spline.numberOfKnots > 0) {
              const controlPoints: AcGePoint3dLike[] = spline.controlPoints.map(
                item => {
                  return {
                    x: item.x,
                    y: item.y,
                    z: 0
                  }
                }
              )
              let hasWeights = true
              const weights: number[] = spline.controlPoints.map(item => {
                if (item.weight == null) hasWeights = false
                return item.weight || 1
              })
              loop.add(
                new AcGeSpline3d(
                  controlPoints,
                  spline.knots,
                  hasWeights ? weights : undefined
                )
              )
            } else if (spline.numberOfFitData > 0) {
              const fitPoints: AcGePoint3dLike[] = spline.fitDatum.map(item => {
                return {
                  x: item.x,
                  y: item.y,
                  z: 0
                }
              })
              loop.add(new AcGeSpline3d(fitPoints, 'Uniform'))
            }
          }
        })
        dbEntity.add(loop)
      }
    })
    return dbEntity
  }

  private convertTable(table: TableEntity) {
    const dbEntity = new AcDbTable(
      table.name,
      table.rowCount,
      table.columnCount
    )
    dbEntity.attachmentPoint =
      table.attachmentPoint as unknown as AcGiMTextAttachmentPoint
    dbEntity.position.copy(table.startPoint)
    table.columnWidthArr.forEach((width, index) =>
      dbEntity.setColumnWidth(index, width)
    )
    table.rowHeightArr.forEach((height, index) =>
      dbEntity.setRowHeight(index, height)
    )
    table.cells.forEach((cell, index) => {
      dbEntity.setCell(index, cell as unknown as AcDbTableCell)
    })
    return dbEntity
  }

  private convertText(text: TextEntity) {
    const dbEntity = new AcDbText()
    dbEntity.textString = text.text
    dbEntity.styleName = text.styleName
    dbEntity.height = text.textHeight
    dbEntity.position.copy(text.startPoint)
    dbEntity.rotation = AcGeMathUtil.degToRad(text.rotation || 0)
    dbEntity.oblique = text.obliqueAngle ?? 0
    dbEntity.thickness = text.thickness
    dbEntity.horizontalMode = text.halign as unknown as AcDbTextHorizontalMode
    dbEntity.verticalMode = text.valign as unknown as AcDbTextVerticalMode
    dbEntity.widthFactor = text.xScale ?? 1
    return dbEntity
  }

  private convertMText(mtext: MTextEntity) {
    const dbEntity = new AcDbMText()
    dbEntity.contents = mtext.text.join('')
    if (mtext.styleName != null) {
      dbEntity.styleName = mtext.styleName
    }
    dbEntity.height = mtext.height
    dbEntity.width = mtext.width
    dbEntity.rotation = AcGeMathUtil.degToRad(mtext.rotation || 0)
    dbEntity.location = mtext.insertionPoint as AcGePoint3d
    dbEntity.attachmentPoint =
      mtext.attachmentPoint as unknown as AcGiMTextAttachmentPoint
    if (mtext.direction) {
      dbEntity.direction = new AcGeVector3d(mtext.direction)
    }
    dbEntity.drawingDirection =
      mtext.drawingDirection as unknown as AcGiMTextFlowDirection
    return dbEntity
  }

  private convertLeader(leader: LeaderEntity) {
    const dbEntity = new AcDbLeader()
    leader.vertices.forEach(point => {
      dbEntity.appendVertex(point)
    })
    dbEntity.hasArrowHead = leader.isArrowheadEnabled
    dbEntity.hasHookLine = leader.isHooklineExists
    dbEntity.isSplined = leader.isSpline
    dbEntity.dimensionStyle = leader.styleName
    dbEntity.annoType =
      leader.leaderCreationFlag as unknown as AcDbLeaderAnnotationType
    return dbEntity
  }

  private convertDimension(dimension: DimensionEntityCommon) {
    if (
      dimension.subclassMarker == 'AcDbAlignedDimension' ||
      dimension.subclassMarker == 'AcDbRotatedDimension'
    ) {
      const entity = dimension as AlignedDimensionEntity
      const dbEntity = new AcDbAlignedDimension(
        entity.subDefinitionPoint1,
        entity.subDefinitionPoint2,
        entity.definitionPoint
      )
      dbEntity.rotation = AcGeMathUtil.degToRad(entity.rotationAngle || 0)
      this.processDimensionCommonAttrs(dimension, dbEntity)
      return dbEntity
    } else if (dimension.subclassMarker == 'AcDb3PointAngularDimension') {
      const entity = dimension as AngularDimensionEntity
      const dbEntity = new AcDb3PointAngularDimension(
        entity.centerPoint,
        entity.subDefinitionPoint1,
        entity.subDefinitionPoint2,
        entity.definitionPoint
      )
      this.processDimensionCommonAttrs(dimension, dbEntity)
      return dbEntity
    } else if (dimension.subclassMarker == 'AcDbOrdinateDimension') {
      const entity = dimension as OrdinateDimensionEntity
      const dbEntity = new AcDbOrdinateDimension(
        entity.subDefinitionPoint1,
        entity.subDefinitionPoint2
      )
      this.processDimensionCommonAttrs(dimension, dbEntity)
      return dbEntity
    } else if (dimension.subclassMarker == 'AcDbRadialDimension') {
      const entity = dimension as RadialDiameterDimensionEntity
      const dbEntity = new AcDbRadialDimension(
        entity.definitionPoint,
        entity.centerPoint,
        entity.leaderLength
      )
      this.processDimensionCommonAttrs(dimension, dbEntity)
      return dbEntity
    } else if (dimension.subclassMarker == 'AcDbDiametricDimension') {
      const entity = dimension as RadialDiameterDimensionEntity
      const dbEntity = new AcDbDiametricDimension(
        entity.definitionPoint,
        entity.centerPoint,
        entity.leaderLength
      )
      this.processDimensionCommonAttrs(dimension, dbEntity)
      return dbEntity
    }
    return null
  }

  private processImage(
    image: ImageEntity | WipeoutEntity,
    dbImage: AcDbRasterImage
  ) {
    dbImage.position.copy(image.position)
    dbImage.brightness = image.brightness
    dbImage.contrast = image.contrast
    dbImage.fade = image.fade
    dbImage.imageDefId = image.imageDefHandle
    dbImage.isClipped = (image.flags | 0x0004) > 0
    dbImage.isImageShown = (image.flags | 0x0003) > 0
    dbImage.isImageTransparent = (image.flags | 0x0008) > 0
    image.clippingBoundaryPath.forEach(point => {
      dbImage.clipBoundary.push(new AcGePoint2d(point))
    })
    dbImage.clipBoundaryType =
      image.clippingBoundaryType as unknown as AcDbRasterImageClipBoundaryType

    // Calculate the scale factors
    dbImage.width =
      Math.sqrt(
        image.uPixel.x ** 2 + image.uPixel.y ** 2 + image.uPixel.z ** 2
      ) * image.imageSize.x
    dbImage.height =
      Math.sqrt(
        image.vPixel.x ** 2 + image.vPixel.y ** 2 + image.vPixel.z ** 2
      ) * image.imageSize.y

    // Calculate the rotation angle
    // Rotation is determined by the angle of the U-vector relative to the X-axis
    dbImage.rotation = Math.atan2(image.uPixel.y, image.uPixel.x)
  }

  private convertImage(image: ImageEntity) {
    const dbImage = new AcDbRasterImage()
    this.processImage(image, dbImage)
    return dbImage
  }

  private convertWipeout(wipeout: WipeoutEntity) {
    const dbWipeout = new AcDbWipeout()
    this.processImage(wipeout, dbWipeout)
    return dbWipeout
  }

  private convertViewport(viewport: ViewportEntity) {
    const dbViewport = new AcDbViewport()
    dbViewport.number = viewport.viewportId
    dbViewport.centerPoint.copy(viewport.viewportCenter)
    dbViewport.height = viewport.height
    dbViewport.width = viewport.width
    dbViewport.viewCenter.copy(viewport.displayCenter)
    dbViewport.viewHeight = viewport.viewHeight
    return dbViewport
  }

  private convertRay(ray: RayEntity) {
    const dbRay = new AcDbRay()
    dbRay.basePoint.copy(ray.firstPoint)
    dbRay.unitDir.copy(ray.unitDirection)
    return dbRay
  }

  private convertXline(xline: XlineEntity) {
    const dbXline = new AcDbXline()
    dbXline.basePoint.copy(xline.firstPoint)
    dbXline.unitDir.copy(xline.unitDirection)
    return dbXline
  }

  private convertBlockReference(blockReference: InsertEntity) {
    const dbBlockReference = new AcDbBlockReference(blockReference.name)
    if (blockReference.insertionPoint)
      dbBlockReference.position.copy(blockReference.insertionPoint)
    dbBlockReference.scaleFactors.x = blockReference.xScale || 1
    dbBlockReference.scaleFactors.y = blockReference.yScale || 1
    dbBlockReference.scaleFactors.z = blockReference.zScale || 1
    dbBlockReference.rotation =
      blockReference.rotation != null
        ? AcGeMathUtil.degToRad(blockReference.rotation)
        : 0
    dbBlockReference.normal.copy(blockReference.extrusionDirection)
    return dbBlockReference
  }

  private processDimensionCommonAttrs(
    entity: DimensionEntityCommon,
    dbEntity: AcDbDimension
  ) {
    dbEntity.dimBlockId = entity.name
    dbEntity.textPosition.copy(entity.textPoint)
    dbEntity.textRotation = entity.textRotation || 0
    if (entity.textLineSpacingFactor) {
      dbEntity.textLineSpacingFactor = entity.textLineSpacingFactor
    }
    if (entity.textLineSpacingStyle) {
      dbEntity.textLineSpacingStyle =
        entity.textLineSpacingStyle as unknown as AcDbLineSpacingStyle
    }
    dbEntity.dimensionStyleName = entity.styleName
    dbEntity.dimensionText = entity.text || ''
    dbEntity.measurement = entity.measurement
  }

  private processCommonAttrs(entity: CommonDxfEntity, dbEntity: AcDbEntity) {
    dbEntity.layer = entity.layer
    dbEntity.objectId = entity.handle
    dbEntity.ownerId = entity.ownerBlockRecordSoftId || ''
    if (entity.lineType != null) {
      dbEntity.lineType = entity.lineType
    }
    if (entity.lineweight != null) {
      dbEntity.lineWeight = entity.lineweight
    }
    if (entity.lineTypeScale != null) {
      dbEntity.linetypeScale = entity.lineTypeScale
    }
    if (entity.color != null) {
      dbEntity.color.color = entity.color
    }
    if (entity.colorIndex != null) {
      dbEntity.color.colorIndex = entity.colorIndex
    }
    if (entity.colorName != null) {
      dbEntity.color.colorName = entity.colorName
    }
    if (entity.isVisible != null) {
      dbEntity.visibility = entity.isVisible
    }
    if (entity.transparency != null) {
      dbEntity.transparency = entity.transparency
    }
  }

  private numberArrayToPointArray(numbers: number[], numberOfPoints: number) {
    const count = numbers.length
    let dimension = 0
    if (count / 2 == numberOfPoints) {
      dimension = 2
    } else if (count / 3 == numberOfPoints) {
      dimension = 3
    }
    if (dimension == 0) return undefined

    const points: AcGePointLike[] = []
    for (let index = 0, size = count / dimension; index < size; ++index) {
      points.push({
        x: numbers[index * dimension],
        y: numbers[index * dimension + 1],
        z: dimension == 3 ? numbers[index * dimension + 2] : undefined
      })
    }
    return points
  }
}
