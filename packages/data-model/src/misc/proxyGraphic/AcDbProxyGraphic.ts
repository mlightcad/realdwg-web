import { AcCmColor, AcCmColorMethod, AcCmColorUtil } from '@mlightcad/common'
import {
  AcGeArea2d,
  AcGeCircArc3d,
  AcGeEllipseArc3d,
  AcGeMatrix3d,
  AcGePoint3d,
  AcGePoint3dLike,
  AcGePolyline2d,
  AcGeVector3d,
  AcGeVector3dLike,
  getOcsAngle,
  getOcsReferenceVector,
  TAU,
  transformOcsPointToWcs,
  transformWcsPointToOcs
} from '@mlightcad/geometry-engine'
import {
  AcGiEntity,
  AcGiLineWeight,
  AcGiMTextAttachmentPoint,
  AcGiMTextData,
  AcGiMTextFlowDirection,
  AcGiRenderer,
  AcGiStyleType,
  AcGiTextStyle
} from '@mlightcad/graphic-interface'

import type { AcDbDatabase } from '../../database/AcDbDatabase'
import { ByBlock, ByLayer, DEFAULT_TEXT_STYLE } from '../AcDbConstants'
import {
  RAW_COLOR_TYPE_ACI,
  RAW_COLOR_TYPE_BY_BLOCK,
  RAW_COLOR_TYPE_BY_LAYER,
  RAW_COLOR_TYPE_RGB
} from '../AcDbMLeaderStyleColorCodec'
import {
  AcDbProxyGraphicBitStream,
  AcDbProxyGraphicByteStream
} from './AcDbProxyGraphicBinaryStream'

/** DXF hex chunk size for proxy graphic export. */
export const ACDB_PROXY_GRAPHIC_CHUNK_SIZE = 127

/** Proxy graphic command type codes (ODA / ezdxf). */
export enum AcDbProxyGraphicType {
  Extents = 1,
  Circle = 2,
  Circle3P = 3,
  CircularArc = 4,
  CircularArc3P = 5,
  Polyline = 6,
  Polygon = 7,
  Mesh = 8,
  Shell = 9,
  Text = 10,
  Text2 = 11,
  Xline = 12,
  Ray = 13,
  AttributeColor = 14,
  AttributeLayer = 16,
  AttributeLinetype = 18,
  AttributeMarker = 19,
  AttributeFill = 20,
  AttributeTrueColor = 22,
  AttributeLineweight = 23,
  AttributeLtscale = 24,
  AttributeThickness = 25,
  PushMatrix = 29,
  PopMatrix = 31,
  PolylineWithNormals = 32,
  LwPolyline = 33,
  UnicodeText = 36,
  UnicodeText2 = 38,
  EllipticArc = 44
}

const Z_AXIS = AcGeVector3d.Z_AXIS

const MAX_VALID_LINEWEIGHT = 0x211

interface AcDbProxyGraphicOptions {
  database?: AcDbDatabase
  dxfversion?: string
  encoding?: string
  defaultLayer?: string
}

function decodeProxyGraphicRawColor(raw: number): {
  colorIndex?: number
  rgb?: number
} {
  const type = (raw >> 24) & 0xff
  if (type === RAW_COLOR_TYPE_RGB) {
    return { rgb: raw & 0xffffff }
  }
  if (type === RAW_COLOR_TYPE_BY_LAYER) {
    return { colorIndex: 256 }
  }
  if (type === RAW_COLOR_TYPE_BY_BLOCK) {
    return { colorIndex: 0 }
  }
  if (type === RAW_COLOR_TYPE_ACI) {
    return { colorIndex: raw & 0xff }
  }
  return { colorIndex: raw & 0xff }
}

function vectorFromLike(v: AcGeVector3dLike) {
  return new AcGeVector3d(v.x, v.y, v.z ?? 0)
}

function pointFromLike(p: AcGePoint3dLike) {
  return new AcGePoint3d(p.x, p.y, p.z ?? 0)
}

function vertexTuple(v: [number, number, number]): AcGePoint3dLike {
  return { x: v[0], y: v[1], z: v[2] }
}

/**
 * Decodes AutoCAD proxy-entity graphics binary data and renders primitives
 * through {@link AcGiRenderer}, following the ODA proxy graphic format used
 * by ezdxf's ProxyGraphic.
 */
export class AcDbProxyGraphic {
  private readonly _buffer: Uint8Array
  private _index = 8
  private readonly _database?: AcDbDatabase
  private readonly _dxfversion: string
  private _encoding: string

  private _colorIndex = 256
  private _rgbColor?: number
  private _layer = '0'
  private _linetype = ByLayer
  private _lineweight: AcGiLineWeight = AcGiLineWeight.ByLineWeightDefault
  private _ltscale = 1
  private _thickness = 0
  private _fill = false
  private readonly _layers: string[] = []
  private readonly _linetypes: string[] = []
  private readonly _matrices: AcGeMatrix3d[] = []
  private _extents?: AcGePoint3d[]

  constructor(data: Uint8Array, options: AcDbProxyGraphicOptions = {}) {
    this._buffer = data
    this._database = options.database
    this._dxfversion = options.dxfversion ?? 'AC1015'
    this._encoding =
      options.encoding ??
      (this._dxfversion < 'AC1024' ? 'windows-1252' : 'utf-8')
    this._layer = options.defaultLayer ?? '0'

    if (this._database) {
      this._database.tables.layerTable
        .newIterator()
        .toArray()
        .forEach(layer => this._layers.push(layer.name))
      this._database.tables.linetypeTable
        .newIterator()
        .toArray()
        .forEach(linetype => this._linetypes.push(linetype.name))
    }
  }

  get extents() {
    return this._extents
  }

  /**
   * Scans the buffer for an EXTENTS chunk without rendering geometry.
   */
  scanExtents(): [AcGePoint3d, AcGePoint3d] | undefined {
    const buffer = this._buffer
    let index = this._index
    while (index < buffer.length) {
      const headerView = new DataView(
        buffer.buffer,
        buffer.byteOffset + index,
        8
      )
      const size = headerView.getUint32(0, true)
      const type = headerView.getUint32(4, true)
      if (size < 8) {
        break
      }
      if (type === AcDbProxyGraphicType.Extents) {
        const chunk = buffer.subarray(index + 8, index + size)
        this.readExtents(chunk)
        if (this._extents?.length === 2) {
          return [this._extents[0], this._extents[1]]
        }
        return undefined
      }
      index += size
    }
    return undefined
  }

  /**
   * Parses proxy graphics and renders drawable primitives.
   */
  worldDraw(renderer: AcGiRenderer): AcGiEntity | undefined {
    const entities: AcGiEntity[] = []
    const traits = renderer.subEntityTraits
    const previousTraits = {
      color: traits.color.clone(),
      rgbColor: traits.rgbColor,
      lineType: traits.lineType,
      lineTypeScale: traits.lineTypeScale,
      lineWeight: traits.lineWeight,
      layer: traits.layer,
      thickness: traits.thickness
    }

    const buffer = this._buffer
    let index = this._index

    while (index < buffer.length) {
      const headerView = new DataView(
        buffer.buffer,
        buffer.byteOffset + index,
        8
      )
      const size = headerView.getUint32(0, true)
      const type = headerView.getUint32(4, true)
      if (size < 8) {
        break
      }
      const chunk = buffer.subarray(index + 8, index + size)
      this.dispatchChunk(renderer, entities, type, chunk)
      if (type !== AcDbProxyGraphicType.AttributeFill) {
        this._fill = false
      }
      index += size
    }

    traits.color = previousTraits.color
    traits.rgbColor = previousTraits.rgbColor
    traits.lineType = previousTraits.lineType
    traits.lineTypeScale = previousTraits.lineTypeScale
    traits.lineWeight = previousTraits.lineWeight
    traits.layer = previousTraits.layer
    traits.thickness = previousTraits.thickness

    if (entities.length === 0) {
      return undefined
    }
    return renderer.group(entities)
  }

  private dispatchChunk(
    renderer: AcGiRenderer,
    entities: AcGiEntity[],
    type: number,
    data: Uint8Array
  ) {
    switch (type) {
      case AcDbProxyGraphicType.Extents:
        this.readExtents(data)
        break
      case AcDbProxyGraphicType.Circle:
        this.drawCircle(renderer, entities, data)
        break
      case AcDbProxyGraphicType.Circle3P:
        this.drawCircle3P(renderer, entities, data)
        break
      case AcDbProxyGraphicType.CircularArc:
        this.drawCircularArc(renderer, entities, data)
        break
      case AcDbProxyGraphicType.CircularArc3P:
        this.drawCircularArc3P(renderer, entities, data)
        break
      case AcDbProxyGraphicType.EllipticArc:
        this.drawEllipticArc(renderer, entities, data)
        break
      case AcDbProxyGraphicType.Polyline:
        this.drawPolyline(renderer, entities, data, false)
        break
      case AcDbProxyGraphicType.PolylineWithNormals:
        this.drawPolyline(renderer, entities, data, true)
        break
      case AcDbProxyGraphicType.Polygon:
        this.drawPolygon(renderer, entities, data)
        break
      case AcDbProxyGraphicType.LwPolyline:
        this.drawLwPolyline(renderer, entities, data)
        break
      case AcDbProxyGraphicType.Shell:
        this.drawShell(renderer, entities, data)
        break
      case AcDbProxyGraphicType.Text:
        this.drawText(renderer, entities, data, false)
        break
      case AcDbProxyGraphicType.UnicodeText:
        this.drawText(renderer, entities, data, true)
        break
      case AcDbProxyGraphicType.Text2:
        this.drawText2(renderer, entities, data, false)
        break
      case AcDbProxyGraphicType.UnicodeText2:
        this.drawText2(renderer, entities, data, true)
        break
      case AcDbProxyGraphicType.Xline:
        this.drawXline(renderer, entities, data, false)
        break
      case AcDbProxyGraphicType.Ray:
        this.drawXline(renderer, entities, data, true)
        break
      case AcDbProxyGraphicType.AttributeColor:
        this.readAttributeColor(data)
        break
      case AcDbProxyGraphicType.AttributeLayer:
        this.readAttributeLayer(data)
        break
      case AcDbProxyGraphicType.AttributeLinetype:
        this.readAttributeLinetype(data)
        break
      case AcDbProxyGraphicType.AttributeFill:
        this.readAttributeFill(data)
        break
      case AcDbProxyGraphicType.AttributeTrueColor:
        this.readAttributeTrueColor(data)
        break
      case AcDbProxyGraphicType.AttributeLineweight:
        this.readAttributeLineweight(data)
        break
      case AcDbProxyGraphicType.AttributeLtscale:
        this.readAttributeLtscale(data)
        break
      case AcDbProxyGraphicType.AttributeThickness:
        this.readAttributeThickness(data)
        break
      case AcDbProxyGraphicType.PushMatrix:
        this.pushMatrix(data)
        break
      case AcDbProxyGraphicType.PopMatrix:
        this.popMatrix()
        break
      default:
        break
    }
  }

  private applyTraits(renderer: AcGiRenderer) {
    const traits = renderer.subEntityTraits
    traits.layer = this._layer
    traits.lineTypeScale = this._ltscale
    traits.thickness = this._thickness
    traits.lineWeight = this._lineweight

    if (this._rgbColor != null) {
      traits.rgbColor = this._rgbColor
      traits.color = new AcCmColor(AcCmColorMethod.ByColor, this._rgbColor)
    } else if (this._colorIndex === 256) {
      traits.color = new AcCmColor(AcCmColorMethod.ByLayer)
      traits.rgbColor =
        AcCmColorUtil.getColorByIndex(7) ??
        traits.rgbColor
    } else if (this._colorIndex === 0) {
      traits.color = new AcCmColor(AcCmColorMethod.ByBlock)
    } else {
      const rgb = AcCmColorUtil.getColorByIndex(this._colorIndex)
      traits.color = new AcCmColor(AcCmColorMethod.ByACI, this._colorIndex)
      if (rgb != null) {
        traits.rgbColor = rgb
      }
    }

    traits.lineType = {
      name: this._linetype,
      type: this.resolveLineStyleType(),
      standardFlag: 0,
      description: '',
      totalPatternLength: 0
    }
  }

  private resolveLineStyleType(): AcGiStyleType {
    if (this._linetype === ByLayer) return 'ByLayer'
    if (this._linetype === ByBlock) return 'ByBlock'
    return 'UserSpecified'
  }

  private transformPoint(point: AcGePoint3dLike | [number, number, number]) {
    const like = Array.isArray(point) ? vertexTuple(point) : point
    const transformed = pointFromLike(like)
    if (this._matrices.length > 0) {
      transformed.applyMatrix4(this._matrices[this._matrices.length - 1])
    }
    return transformed
  }

  private transformVector(vector: AcGeVector3dLike | [number, number, number]) {
    const like = Array.isArray(vector) ? vertexTuple(vector) : vector
    const transformed = vectorFromLike(like)
    if (this._matrices.length > 0) {
      transformed.transformDirection(this._matrices[this._matrices.length - 1])
    }
    return transformed.normalize()
  }

  private pushEntity(entities: AcGiEntity[], entity?: AcGiEntity) {
    if (entity) {
      entities.push(entity)
    }
  }

  private readExtents(data: Uint8Array) {
    const bs = new AcDbProxyGraphicByteStream(data)
    const min = bs.readVertex()
    const max = bs.readVertex()
    this._extents = [
      new AcGePoint3d(min[0], min[1], min[2]),
      new AcGePoint3d(max[0], max[1], max[2])
    ]
  }

  private readAttributeColor(data: Uint8Array) {
    const value = new DataView(data.buffer, data.byteOffset, 4).getUint32(
      0,
      true
    )
    this._rgbColor = undefined
    this._colorIndex = value > 256 || value < 0 ? 256 : value
  }

  private readAttributeLayer(data: Uint8Array) {
    const index = new DataView(data.buffer, data.byteOffset, 4).getUint32(
      0,
      true
    )
    if (index < this._layers.length) {
      this._layer = this._layers[index]
    }
  }

  private readAttributeLinetype(data: Uint8Array) {
    const index = new DataView(data.buffer, data.byteOffset, 4).getUint32(
      0,
      true
    )
    if (index + 2 < this._linetypes.length) {
      this._linetype = this._linetypes[index + 2]
    } else if (index === 32766) {
      this._linetype = ByBlock
    } else {
      this._linetype = ByLayer
    }
  }

  private readAttributeFill(data: Uint8Array) {
    this._fill = new DataView(data.buffer, data.byteOffset, 4).getUint32(
      0,
      true
    ) !== 0
  }

  private readAttributeTrueColor(data: Uint8Array) {
    const raw = new DataView(data.buffer, data.byteOffset, 4).getUint32(
      0,
      true
    )
    const decoded = decodeProxyGraphicRawColor(raw)
    this._rgbColor = decoded.rgb
    if (decoded.colorIndex != null) {
      this._colorIndex = decoded.colorIndex
    }
  }

  private readAttributeLineweight(data: Uint8Array) {
    const lw = new DataView(data.buffer, data.byteOffset, 4).getUint32(
      0,
      true
    )
    if (lw > MAX_VALID_LINEWEIGHT) {
      this._lineweight = (lw - 0x100000000) as AcGiLineWeight
    } else {
      this._lineweight = lw as AcGiLineWeight
    }
  }

  private readAttributeLtscale(data: Uint8Array) {
    this._ltscale = new DataView(data.buffer, data.byteOffset, 8).getFloat64(
      0,
      true
    )
  }

  private readAttributeThickness(data: Uint8Array) {
    this._thickness = new DataView(data.buffer, data.byteOffset, 8).getFloat64(
      0,
      true
    )
  }

  private pushMatrix(data: Uint8Array) {
    const values = new Float64Array(data.buffer, data.byteOffset, 16)
    const matrix = new AcGeMatrix3d().fromArray(Array.from(values))
    matrix.transpose()
    this._matrices.push(matrix)
  }

  private popMatrix() {
    if (this._matrices.length > 0) {
      this._matrices.pop()
    }
  }

  private loadVertices(data: Uint8Array, loadNormal: boolean) {
    const bs = new AcDbProxyGraphicByteStream(data)
    let count = bs.readLong()
    if (loadNormal) {
      count += 1
    }
    const vertices: AcGePoint3d[] = []
    while (count > 0) {
      const [x, y, z] = bs.readVertex()
      vertices.push(this.transformPoint({ x, y, z }))
      count -= 1
    }
    let normal = Z_AXIS
    if (loadNormal && vertices.length > 0) {
      normal = vectorFromLike(vertices.pop()!)
    }
    return { vertices, normal }
  }

  private drawCircle(renderer: AcGiRenderer, entities: AcGiEntity[], data: Uint8Array) {
    const bs = new AcDbProxyGraphicByteStream(data)
    const center = bs.readVertex()
    const radius = bs.readFloat()
    const normalVec = this.transformVector(bs.readVertex())
    let centerPoint = pointFromLike({ x: center[0], y: center[1], z: center[2] })
    if (!normalVec.equals(Z_AXIS)) {
      centerPoint = transformWcsPointToOcs(centerPoint, normalVec)
    }
    centerPoint = this.transformPoint(centerPoint)
    const refVec = getOcsReferenceVector(normalVec)
    const arc = new AcGeCircArc3d(
      transformOcsPointToWcs(centerPoint, normalVec),
      radius,
      0,
      TAU,
      normalVec,
      refVec
    )
    this.applyTraits(renderer)
    this.pushEntity(entities, renderer.circularArc(arc))
  }

  private drawCircle3P(
    renderer: AcGiRenderer,
    entities: AcGiEntity[],
    data: Uint8Array
  ) {
    const bs = new AcDbProxyGraphicByteStream(data)
    const p1 = this.transformPoint(bs.readVertex())
    const p2 = this.transformPoint(bs.readVertex())
    const p3 = this.transformPoint(bs.readVertex())
    const center = AcGeCircArc3d.computeCenterPoint(p1, p2, p3)
    if (!center) return
    const radius = center.distanceTo(p1)
    const arc = new AcGeCircArc3d(center, radius, 0, TAU, Z_AXIS)
    this.applyTraits(renderer)
    this.pushEntity(entities, renderer.circularArc(arc))
  }

  private drawCircularArc(
    renderer: AcGiRenderer,
    entities: AcGiEntity[],
    data: Uint8Array
  ) {
    const bs = new AcDbProxyGraphicByteStream(data)
    const center = bs.readVertex()
    const radius = bs.readFloat()
    const normal = bs.readVertex()
    const startVec = bs.readVertex()
    const sweepAngle = bs.readFloat()
    const normalVec = this.transformVector(normal)
    const centerWcs = pointFromLike({
      x: center[0],
      y: center[1],
      z: center[2]
    })
    const refVec = this.transformVector(startVec).normalize()
    const startAngle = 0
    const endAngle = sweepAngle
    const arc = new AcGeCircArc3d(
      this.transformPoint(centerWcs),
      radius,
      startAngle,
      endAngle,
      normalVec,
      refVec
    )
    this.applyTraits(renderer)
    this.pushEntity(entities, renderer.circularArc(arc))
  }

  private drawCircularArc3P(
    renderer: AcGiRenderer,
    entities: AcGiEntity[],
    data: Uint8Array
  ) {
    const bs = new AcDbProxyGraphicByteStream(data)
    const p1 = this.transformPoint(bs.readVertex())
    const p2 = this.transformPoint(bs.readVertex())
    const p3 = this.transformPoint(bs.readVertex())
    const center = AcGeCircArc3d.computeCenterPoint(p1, p3, p2)
    if (!center) return
    const radius = center.distanceTo(p1)
    const startAngle = getOcsAngle(center, p1, Z_AXIS)
    const endAngle = getOcsAngle(center, p3, Z_AXIS)
    const arc = new AcGeCircArc3d(center, radius, startAngle, endAngle, Z_AXIS)
    this.applyTraits(renderer)
    this.pushEntity(entities, renderer.circularArc(arc))
  }

  private drawEllipticArc(
    renderer: AcGiRenderer,
    entities: AcGiEntity[],
    data: Uint8Array
  ) {
    const bs = new AcDbProxyGraphicByteStream(data)
    const center = this.transformPoint(bs.readVertex())
    const extrusion = this.transformVector(bs.readVertex())
    const majorAxisLength = bs.readFloat()
    const minorAxisLength = bs.readFloat()
    const startParam = bs.readFloat()
    const endParam = bs.readFloat()
    const majorAxisAngle = bs.readFloat()
    const majorAxis = transformOcsPointToWcs(
      {
        x: Math.cos(majorAxisAngle) * majorAxisLength,
        y: Math.sin(majorAxisAngle) * majorAxisLength,
        z: 0
      },
      extrusion
    )
    const ellipse = new AcGeEllipseArc3d(
      center,
      extrusion,
      majorAxis,
      majorAxisLength,
      minorAxisLength,
      startParam,
      endParam
    )
    this.applyTraits(renderer)
    this.pushEntity(entities, renderer.ellipticalArc(ellipse))
  }

  private drawPolyline(
    renderer: AcGiRenderer,
    entities: AcGiEntity[],
    data: Uint8Array,
    _loadNormal: boolean
  ) {
    const { vertices } = this.loadVertices(data, _loadNormal)
    if (vertices.length === 0) return
    if (vertices.length === 1) {
      this.applyTraits(renderer)
      const pdmode = this._database?.pdmode ?? 0
      const pdsize = this._database?.pdsize ?? 0
      this.pushEntity(
        entities,
        renderer.point(vertices[0], { displayMode: pdmode, displaySize: pdsize })
      )
      return
    }
    this.applyTraits(renderer)
    this.pushEntity(entities, renderer.lines(vertices))
  }

  private drawPolygon(renderer: AcGiRenderer, entities: AcGiEntity[], data: Uint8Array) {
    const { vertices } = this.loadVertices(data, false)
    if (vertices.length < 2) return
    if (this._fill) {
      const polyline = new AcGePolyline2d(
        vertices.map(vertex => ({ x: vertex.x, y: vertex.y })),
        true
      )
      const area = new AcGeArea2d()
      area.add(polyline)
      const traits = renderer.subEntityTraits
      traits.fillType = {
        solidFill: true,
        patternAngle: 0,
        definitionLines: []
      }
      traits.drawOrder = -1
      this.applyTraits(renderer)
      this.pushEntity(entities, renderer.area(area))
      return
    }
    const closed = [...vertices, vertices[0]]
    this.applyTraits(renderer)
    this.pushEntity(entities, renderer.lines(closed))
  }

  private drawLwPolyline(
    renderer: AcGiRenderer,
    entities: AcGiEntity[],
    data: Uint8Array
  ) {
    const bs = new AcDbProxyGraphicBitStream(
      data,
      this._dxfversion,
      this._encoding
    )
    let elevation = 0
    let isClosed = false
    bs.readUnsignedLong()
    const flag = bs.readBitShort() as number
    if (flag & 8) {
      elevation = bs.readBitDouble() as number
    }
    if (flag & 512) {
      isClosed = true
    }
    const numPoints = bs.readBitLong() as number
    if (numPoints <= 0) return

    const numBulges = flag & 16 ? (bs.readBitLong() as number) : 0
    if (this._dxfversion >= 'AC1024') {
      if (flag & 1024) {
        bs.readBitLong()
      }
      if (flag & 32) {
        bs.readBitLong()
      }
    }

    const rawVertices = bs.readRawDouble(2) as [number, number]
    const vertices: AcGePoint3d[] = [
      this.transformPoint({ x: rawVertices[0], y: rawVertices[1], z: elevation })
    ]
    let prev = rawVertices
    for (let i = 1; i < numPoints; i++) {
      const x = bs.readBitDoubleDefault(1, prev[0]) as number
      const y = bs.readBitDoubleDefault(1, prev[1]) as number
      prev = [x, y]
      vertices.push(this.transformPoint({ x, y, z: elevation }))
    }
    for (let i = 0; i < numBulges; i++) {
      bs.readBitDouble()
    }

    if (isClosed && vertices.length > 1) {
      vertices.push(vertices[0].clone())
    }
    this.applyTraits(renderer)
    this.pushEntity(entities, renderer.lines(vertices))
  }

  private drawShell(renderer: AcGiRenderer, entities: AcGiEntity[], data: Uint8Array) {
    const bs = new AcDbProxyGraphicByteStream(data)
    const totalVertexCount = bs.readLong()
    const vertices: AcGePoint3d[] = []
    for (let i = 0; i < totalVertexCount; i++) {
      const [x, y, z] = bs.readVertex()
      vertices.push(this.transformPoint({ x, y, z }))
    }
    const faceEntryCount = bs.readLong()
    const lines: AcGePoint3d[] = []
    let readCount = 0
    while (readCount < faceEntryCount) {
      const edgeCount = Math.abs(bs.readSignedLong())
      readCount += 1 + edgeCount
      const faceIndices: number[] = []
      for (let i = 0; i < edgeCount; i++) {
        faceIndices.push(bs.readLong())
      }
      const faceVertices = faceIndices
        .map(index => vertices[index])
        .filter(Boolean)
      if (faceVertices.length >= 3) {
        for (let i = 0; i < faceVertices.length; i++) {
          lines.push(faceVertices[i])
          lines.push(faceVertices[(i + 1) % faceVertices.length])
        }
      }
    }
    if (lines.length === 0) return
    this.applyTraits(renderer)
    this.pushEntity(entities, renderer.lines(lines))
  }

  private drawText(
    renderer: AcGiRenderer,
    entities: AcGiEntity[],
    data: Uint8Array,
    unicode: boolean
  ) {
    const bs = new AcDbProxyGraphicByteStream(data)
    const insert = this.transformPoint(bs.readVertex())
    const normal = this.transformVector(bs.readVertex())
    const textDirection = this.transformVector(bs.readVertex())
    const [height, widthFactor, obliqueAngle] = bs.readStruct<[number, number, number]>([
      8,
      8,
      8
    ])
    const text = unicode
      ? bs.readPaddedUnicodeString()
      : bs.readPaddedString(this._encoding)
    this.drawTextPrimitive(renderer, entities, {
      insert,
      normal,
      textDirection,
      text,
      height,
      widthFactor,
      obliqueAngle
    })
  }

  private drawText2(
    renderer: AcGiRenderer,
    entities: AcGiEntity[],
    data: Uint8Array,
    unicode: boolean
  ) {
    const bs = new AcDbProxyGraphicByteStream(data)
    const insert = this.transformPoint(bs.readVertex())
    const normal = this.transformVector(bs.readVertex())
    const textDirection = this.transformVector(bs.readVertex())
    const text = unicode
      ? bs.readPaddedUnicodeString()
      : bs.readPaddedString(this._encoding)
    bs.readSignedLong()
    bs.readSignedLong()
    const [height, widthFactor, obliqueAngle] = bs.readStruct<[number, number, number]>([
      8,
      8,
      8
    ])
    bs.readFloat()
    this.drawTextPrimitive(renderer, entities, {
      insert,
      normal,
      textDirection,
      text,
      height,
      widthFactor,
      obliqueAngle
    })
  }

  private drawTextPrimitive(
    renderer: AcGiRenderer,
    entities: AcGiEntity[],
    options: {
      insert: AcGePoint3d
      normal: AcGeVector3d
      textDirection: AcGeVector3d
      text: string
      height: number
      widthFactor: number
      obliqueAngle: number
    }
  ) {
    const rotation = Math.atan2(options.textDirection.y, options.textDirection.x)
    const mtextData: AcGiMTextData = {
      text: options.text,
      height: options.height,
      width: Infinity,
      widthFactor: options.widthFactor,
      position: options.insert,
      rotation: (rotation * 180) / Math.PI,
      drawingDirection: AcGiMTextFlowDirection.BOTTOM_TO_TOP,
      attachmentPoint: AcGiMTextAttachmentPoint.BaselineLeft
    }
    const style: AcGiTextStyle = {
      name: DEFAULT_TEXT_STYLE,
      standardFlag: 0,
      fixedTextHeight: 0,
      widthFactor: options.widthFactor,
      obliqueAngle: (options.obliqueAngle * 180) / Math.PI,
      textGenerationFlag: 0,
      lastHeight: options.height,
      font: 'txt',
      bigFont: ''
    }
    this.applyTraits(renderer)
    this.pushEntity(entities, renderer.mtext(mtextData, style))
  }

  private drawXline(
    renderer: AcGiRenderer,
    entities: AcGiEntity[],
    data: Uint8Array,
    isRay: boolean
  ) {
    const bs = new AcDbProxyGraphicByteStream(data)
    const start = this.transformPoint(bs.readVertex())
    const other = this.transformPoint(bs.readVertex())
    const direction = new AcGeVector3d().subVectors(other, start)
  if (direction.lengthSq() === 0) return
    const far = 1e6
    const end = isRay
      ? start.clone().add(direction.normalize().multiplyScalar(far))
      : start.clone().sub(direction.normalize().multiplyScalar(far))
    const farEnd = other.clone().add(direction.normalize().multiplyScalar(far))
    this.applyTraits(renderer)
    this.pushEntity(entities, renderer.lines([end, farEnd]))
  }
}

/**
 * Loads proxy graphic bytes from DXF group 160/310 chunks.
 */
export function loadAcDbProxyGraphicFromDxf(
  length?: number,
  hexChunks?: string[]
): Uint8Array | undefined {
  if (!hexChunks?.length) {
    return undefined
  }
  const bytes = new Uint8Array(
    hexChunks.reduce((sum, chunk) => sum + Math.floor(chunk.length / 2), 0)
  )
  let offset = 0
  for (const chunk of hexChunks) {
    for (let i = 0; i < chunk.length; i += 2) {
      bytes[offset++] = parseInt(chunk.slice(i, i + 2), 16)
    }
  }
  if (length != null && length > 0 && bytes.length >= length) {
    return bytes.subarray(0, length)
  }
  return bytes
}
