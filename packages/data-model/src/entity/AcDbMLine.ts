import { AcCmColor } from '@mlightcad/common'
import {
  AcGeBox3d,
  AcGeMatrix3d,
  AcGePoint3d,
  AcGePoint3dLike,
  AcGeVector3d,
  AcGeVector3dLike
} from '@mlightcad/geometry-engine'
import { AcGiEntity, AcGiRenderer } from '@mlightcad/graphic-interface'

import { AcDbDxfFiler } from '../base'
import { AcDbMlineStyle } from '../object'
import { AcDbEntity } from './AcDbEntity'
import { AcDbEntityProperties } from './AcDbEntityProperties'

/**
 * Defines MLINE justification relative to the style element offsets.
 */
export enum AcDbMLineJustification {
  Top = 0,
  Zero = 1,
  Bottom = 2
}

/**
 * Bit flags used by MLINE entities.
 */
export enum AcDbMLineFlags {
  HasVertex = 1,
  Closed = 2,
  SuppressStartCaps = 4,
  SuppressEndCaps = 8
}

/**
 * Input payload for one MLINE element in a segment.
 */
export interface AcDbMLineElementLike {
  parameterCount?: number
  parameters?: number[]
  fillCount?: number
  fillParameters?: number[]
}

/**
 * Normalized MLINE element data.
 */
export interface AcDbMLineElement {
  parameterCount: number
  parameters: number[]
  fillCount: number
  fillParameters: number[]
}

/**
 * Input payload for one MLINE segment.
 */
export interface AcDbMLineSegmentLike {
  position: AcGePoint3dLike
  direction: AcGeVector3dLike
  miterDirection: AcGeVector3dLike
  elements?: AcDbMLineElementLike[]
}

/**
 * Normalized MLINE segment data.
 */
export interface AcDbMLineSegment {
  position: AcGePoint3d
  direction: AcGeVector3d
  miterDirection: AcGeVector3d
  elements: AcDbMLineElement[]
}

/**
 * Represents the AutoCAD MLINE entity.
 */
export class AcDbMLine extends AcDbEntity {
  static override typeName: string = 'MLine'

  override get dxfTypeName() {
    return 'MLINE'
  }

  private _styleName: string
  private _styleObjectHandle: string
  private _scale: number
  private _justification: AcDbMLineJustification
  private _flags: number
  private _styleCount: number
  private _startPosition: AcGePoint3d
  private _normal: AcGeVector3d
  private _segments: AcDbMLineSegment[]

  constructor() {
    super()
    this._styleName = 'STANDARD'
    this._styleObjectHandle = ''
    this._scale = 1
    this._justification = AcDbMLineJustification.Zero
    this._flags = 0
    this._styleCount = 0
    this._startPosition = new AcGePoint3d()
    this._normal = new AcGeVector3d(0, 0, 1)
    this._segments = []
  }

  get styleName() {
    return this._styleName
  }
  set styleName(value: string) {
    this._styleName = value
  }

  get styleObjectHandle() {
    return this._styleObjectHandle
  }
  set styleObjectHandle(value: string) {
    this._styleObjectHandle = value
  }

  get scale() {
    return this._scale
  }
  set scale(value: number) {
    this._scale = value
  }

  get justification() {
    return this._justification
  }
  set justification(value: AcDbMLineJustification) {
    this._justification = value
  }

  get flags() {
    return this._flags
  }
  set flags(value: number) {
    this._flags = value
  }

  get styleCount() {
    return this._styleCount
  }
  set styleCount(value: number) {
    this._styleCount = Math.max(0, value)
  }

  get startPosition() {
    return this._startPosition
  }
  set startPosition(value: AcGePoint3dLike) {
    this._startPosition.copy(value)
  }

  get normal() {
    return this._normal
  }
  set normal(value: AcGeVector3dLike) {
    this._normal.copy(value)
  }

  get segments() {
    return this._segments.map(segment => this.cloneSegment(segment))
  }
  set segments(value: AcDbMLineSegmentLike[]) {
    this._segments = value.map(segment => this.createSegment(segment))
    this.updateHasVertexFlag()
  }

  get vertexCount() {
    return this._segments.length
  }

  get closed() {
    return (this._flags & AcDbMLineFlags.Closed) !== 0
  }
  set closed(value: boolean) {
    this.setFlag(AcDbMLineFlags.Closed, value)
  }

  get suppressStartCaps() {
    return (this._flags & AcDbMLineFlags.SuppressStartCaps) !== 0
  }
  set suppressStartCaps(value: boolean) {
    this.setFlag(AcDbMLineFlags.SuppressStartCaps, value)
  }

  get suppressEndCaps() {
    return (this._flags & AcDbMLineFlags.SuppressEndCaps) !== 0
  }
  set suppressEndCaps(value: boolean) {
    this.setFlag(AcDbMLineFlags.SuppressEndCaps, value)
  }

  appendSegment(segment: AcDbMLineSegmentLike) {
    this._segments.push(this.createSegment(segment))
    this.updateHasVertexFlag()
  }

  clearSegments() {
    this._segments = []
    this.updateHasVertexFlag()
  }

  get geometricExtents() {
    const points = this.collectGeometryPoints()
    const box = new AcGeBox3d()
    return box.setFromPoints(points)
  }

  transformBy(matrix: AcGeMatrix3d) {
    this._startPosition.applyMatrix4(matrix)
    this._segments.forEach(segment => {
      segment.position.applyMatrix4(matrix)
      this.transformVector(segment.direction, matrix)
      this.transformVector(segment.miterDirection, matrix)
    })
    this.transformVector(this._normal, matrix)
    return this
  }

  get properties(): AcDbEntityProperties {
    return {
      type: this.type,
      groups: [
        this.getGeneralProperties(),
        {
          groupName: 'mline',
          properties: [
            {
              name: 'styleName',
              type: 'string',
              editable: true,
              accessor: {
                get: () => this.styleName,
                set: (value: string) => {
                  this.styleName = value
                }
              }
            },
            {
              name: 'scale',
              type: 'float',
              editable: true,
              accessor: {
                get: () => this.scale,
                set: (value: number) => {
                  this.scale = value
                }
              }
            },
            {
              name: 'justification',
              type: 'int',
              editable: true,
              accessor: {
                get: () => this.justification,
                set: (value: number) => {
                  this.justification = value as AcDbMLineJustification
                }
              }
            },
            {
              name: 'closed',
              type: 'boolean',
              editable: true,
              accessor: {
                get: () => this.closed,
                set: (value: boolean) => {
                  this.closed = value
                }
              }
            },
            {
              name: 'vertexCount',
              type: 'int',
              editable: false,
              accessor: {
                get: () => this.vertexCount
              }
            }
          ]
        }
      ]
    }
  }

  subWorldDraw(renderer: AcGiRenderer): AcGiEntity | undefined {
    if (this._segments.length === 0) return undefined

    const entities: AcGiEntity[] = []
    const mlineStyle = this.getMLineStyle()
    const elementCount = this.getRenderableElementCount(mlineStyle)
    const traits = renderer.subEntityTraits
    const originalColor = traits.color
    const originalRgbColor = traits.rgbColor
    if (elementCount <= 0) {
      const reference = this.getReferencePath()
      if (reference.length >= 2) entities.push(renderer.lines(reference))
    } else {
      for (let elementIndex = 0; elementIndex < elementCount; elementIndex++) {
        traits.color = originalColor
        traits.rgbColor = originalRgbColor
        this.applyStyleElementTraits(mlineStyle, elementIndex, traits)
        const points = this.getElementPath(elementIndex, mlineStyle)
        if (points.length >= 2) {
          entities.push(renderer.lines(points))
        }
      }
    }
    traits.color = originalColor
    traits.rgbColor = originalRgbColor

    if (entities.length === 0) return undefined
    return entities.length === 1 ? entities[0] : renderer.group(entities)
  }

  override dxfOutFields(filer: AcDbDxfFiler) {
    super.dxfOutFields(filer)
    filer.writeSubclassMarker('AcDbMline')
    filer.writeString(2, this._styleName)
    filer.writeHandle(340, this._styleObjectHandle)
    filer.writeDouble(40, this._scale)
    filer.writeInt16(70, this._justification)
    filer.writeInt16(71, this._flags)
    filer.writeInt16(72, this.vertexCount)
    filer.writeInt16(73, this._styleCount)
    filer.writePoint3d(10, this._startPosition)
    filer.writeVector3d(210, this._normal)

    this._segments.forEach(segment => {
      filer.writePoint3d(11, segment.position)
      filer.writeVector3d(12, segment.direction)
      filer.writeVector3d(13, segment.miterDirection)
      segment.elements.forEach(element => {
        filer.writeInt16(74, element.parameterCount)
        element.parameters.forEach(parameter =>
          filer.writeDouble(41, parameter)
        )
        filer.writeInt16(75, element.fillCount)
        element.fillParameters.forEach(parameter =>
          filer.writeDouble(42, parameter)
        )
      })
    })
    return this
  }

  private setFlag(flag: AcDbMLineFlags, enabled: boolean) {
    if (enabled) {
      this._flags |= flag
    } else {
      this._flags &= ~flag
    }
  }

  private updateHasVertexFlag() {
    this.setFlag(AcDbMLineFlags.HasVertex, this._segments.length > 0)
  }

  private createSegment(segment: AcDbMLineSegmentLike): AcDbMLineSegment {
    return {
      position: new AcGePoint3d().copy(segment.position),
      direction: new AcGeVector3d().copy(segment.direction),
      miterDirection: new AcGeVector3d().copy(segment.miterDirection),
      elements:
        segment.elements?.map(element => this.createElement(element)) ?? []
    }
  }

  private createElement(element: AcDbMLineElementLike): AcDbMLineElement {
    const parameters = element.parameters ? [...element.parameters] : []
    const fillParameters = element.fillParameters
      ? [...element.fillParameters]
      : []
    return {
      parameterCount: element.parameterCount ?? parameters.length,
      parameters,
      fillCount: element.fillCount ?? fillParameters.length,
      fillParameters
    }
  }

  private cloneSegment(segment: AcDbMLineSegment): AcDbMLineSegment {
    return {
      position: segment.position.clone(),
      direction: segment.direction.clone(),
      miterDirection: segment.miterDirection.clone(),
      elements: segment.elements.map(element => ({
        parameterCount: element.parameterCount,
        parameters: [...element.parameters],
        fillCount: element.fillCount,
        fillParameters: [...element.fillParameters]
      }))
    }
  }

  private collectGeometryPoints() {
    const points: AcGePoint3d[] = [this._startPosition]
    if (this._segments.length === 0) return points

    const mlineStyle = this.getMLineStyle()
    const elementCount = this.getRenderableElementCount(mlineStyle)
    if (elementCount <= 0) {
      this._segments.forEach(segment => points.push(segment.position))
      return points
    }

    for (let i = 0; i < elementCount; i++) {
      points.push(...this.getElementPath(i, mlineStyle))
    }
    return points
  }

  private getRenderableElementCount(mlineStyle?: AcDbMlineStyle) {
    const styleElementCount = mlineStyle?.elementCount ?? 0
    return Math.max(
      this._styleCount,
      styleElementCount,
      ...this._segments.map(segment => segment.elements.length),
      0
    )
  }

  private getReferencePath() {
    return [
      this._startPosition.clone(),
      ...this._segments.map(segment => segment.position.clone())
    ]
  }

  private getElementPath(elementIndex: number, mlineStyle?: AcDbMlineStyle) {
    const points: AcGePoint3d[] = []
    const first = this._segments[0]
    const startOffset = this.getElementMiterOffset(
      first,
      elementIndex,
      mlineStyle
    )
    points.push(
      this.offsetPoint(this._startPosition, first.miterDirection, startOffset)
    )
    this._segments.forEach(segment => {
      const offset = this.getElementMiterOffset(
        segment,
        elementIndex,
        mlineStyle
      )
      points.push(
        this.offsetPoint(segment.position, segment.miterDirection, offset)
      )
    })
    return points
  }

  private getElementMiterOffset(
    segment: AcDbMLineSegment,
    elementIndex: number,
    mlineStyle?: AcDbMlineStyle
  ) {
    const element = segment.elements[elementIndex]
    if (element?.parameters?.length) return element.parameters[0]
    const styleElement = mlineStyle?.elements[elementIndex]
    return styleElement?.offset ?? 0
  }

  private offsetPoint(
    point: AcGePoint3d,
    miterDirection: AcGeVector3d,
    distance: number
  ) {
    if (distance === 0 || miterDirection.lengthSq() === 0) {
      return point.clone()
    }
    const direction = miterDirection
      .clone()
      .normalize()
      .multiplyScalar(distance)
    return point.clone().add(direction)
  }

  private transformVector(vector: AcGeVector3d, matrix: AcGeMatrix3d) {
    const origin = new AcGePoint3d()
    const endpoint = new AcGePoint3d(vector.x, vector.y, vector.z)
    origin.applyMatrix4(matrix)
    endpoint.applyMatrix4(matrix)
    vector.set(
      endpoint.x - origin.x,
      endpoint.y - origin.y,
      endpoint.z - origin.z
    )
  }

  private getMLineStyle() {
    const dictionary = this.database.objects.mlineStyle
    const byHandle = this.styleObjectHandle
      ? dictionary.getIdAt(this.styleObjectHandle)
      : undefined
    if (byHandle) return byHandle

    const directByName = this.styleName
      ? dictionary.getAt(this.styleName)
      : undefined
    if (directByName) return directByName

    const normalizedStyleName = this.styleName?.toUpperCase()
    if (normalizedStyleName) {
      for (const [name, style] of dictionary.entries()) {
        if (name.toUpperCase() === normalizedStyleName) {
          return style
        }
      }
    }
    return undefined
  }

  private applyStyleElementTraits(
    mlineStyle: AcDbMlineStyle | undefined,
    elementIndex: number,
    traits: AcGiRenderer['subEntityTraits']
  ) {
    const styleElement = mlineStyle?.elements[elementIndex]
    if (!styleElement) return
    const colorIndex = styleElement.color
    if (colorIndex === 0 || colorIndex === 256) return

    const color = new AcCmColor()
    color.colorIndex = colorIndex
    traits.color = color
    if (color.RGB != null) {
      traits.rgbColor = color.RGB
    }
  }
}
