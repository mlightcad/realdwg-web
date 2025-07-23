import { AcCmColor } from '@mlightcad/common'
import { defaults } from 'lodash-es'

import {
  AcDbSymbolTableRecord,
  AcDbSymbolTableRecordAttrs
} from './AcDbSymbolTableRecord'

export interface AcDbLayerTableRecordAttrs extends AcDbSymbolTableRecordAttrs {
  color: AcCmColor
  description?: string
  standardFlags: number
  isHidden?: boolean
  isInUse?: boolean
  isOff: boolean
  isPlottable: boolean
  transparency: number
  linetype: string
  lineWeight: number
  materialId?: string
}

/**
 * This class represents records in the layer table. Each of these records contains the information
 * (color, on or off, frozen or thawed, etc.) about a layer in the drawing database.
 */
export class AcDbLayerTableRecord extends AcDbSymbolTableRecord<AcDbLayerTableRecordAttrs> {
  /**
   * Default constructor.
   */
  constructor(
    attrs?: Partial<AcDbLayerTableRecordAttrs>,
    defaultAttrs?: Partial<AcDbLayerTableRecordAttrs>
  ) {
    attrs = attrs || {}
    defaults(attrs, {
      color: new AcCmColor(),
      description: '',
      standardFlags: 0,
      isHidden: false,
      isInUse: true,
      isOff: false,
      isPlottable: true,
      transparency: 0,
      linetype: '',
      lineWeight: 1,
      materialId: -1
    })
    super(attrs, defaultAttrs)
    this.attrs.events.attrChanged.addEventListener(args => {
      this.database.events.layerModified.dispatch({
        database: this.database,
        layer: this,
        changes: args.object.changedAttributes()
      })
    })
  }

  /**
   * The color value of this layer.
   */
  get color() {
    return this.getAttr('color')
  }
  set color(value: AcCmColor) {
    this.setAttr('color', value.clone())
  }

  /**
   * The description of this layer.
   */
  get description() {
    return this.getAttr('description')
  }
  set description(value: string) {
    this.setAttr('description', value)
  }

  /**
   * Standard flags (bit-coded values):
   * - 1 = Layer is frozen; otherwise layer is thawed
   * - 2 = Layer is frozen by default in new viewports
   * - 4 = Layer is locked
   * - 16 = If set, table entry is externally dependent on an xref
   * - 32 = If both this bit and bit 16 are set, the externally dependent xref has been successfully resolved
   * - 64 = If set, the table entry was referenced by at least one entity in the drawing the last time the drawing was edited. (This flag is for the benefit of AutoCAD commands. It can be ignored by most programs that read DXF files and need not be set by programs that write DXF files)
   */
  get standardFlags() {
    return this.getAttr('standardFlags')
  }
  set standardFlags(value: number) {
    this.setAttr('standardFlags', value)
  }

  /**
   * Frozen state of this layer. If it is true, the layer is frozen.
   */
  get isFrozen() {
    return (this.standardFlags & 0x01) == 1
  }
  set isFrozen(value: boolean) {
    const flag = value ? 1 : 0
    this.standardFlags = this.standardFlags | flag
  }

  /**
   * Flag to hide or show this layer. If it is true, the layer isn't shown in the user interface of
   * host application.
   */
  get isHidden() {
    return this.getAttr('isHidden')
  }
  set isHidden(value: boolean) {
    this.setAttr('isHidden', value)
  }

  /**
   * In-use state of this layer. If it is true, the layer is in use.
   */
  get isInUse() {
    return this.getAttr('isInUse')
  }
  set isInUse(value: boolean) {
    this.setAttr('isInUse', value)
  }

  /**
   * Locked state of this layer. If it is true, the layer is locked.
   */
  get isLocked() {
    return (this.standardFlags & 0x04) == 1
  }
  set isLocked(value: boolean) {
    const flag = value ? 4 : 0
    this.standardFlags = this.standardFlags | flag
  }

  /**
   * Off state of this layer. If it is true, the layer is off.
   */
  get isOff() {
    return this.getAttr('isOff')
  }
  set isOff(value: boolean) {
    this.setAttr('isOff', value)
  }

  /**
   * Plottable state of this layer. If it is true, the layer is plottable.
   */
  get isPlottable() {
    return this.getAttr('isPlottable')
  }
  set isPlottable(value: boolean) {
    this.setAttr('isPlottable', value)
  }

  /**
   * The transparency value of this layer.
   */
  get transparency() {
    return this.getAttr('transparency')
  }
  set transparency(value: number) {
    this.setAttr('transparency', value)
  }

  /**
   * Line type name referenced by this layer.
   */
  get linetype() {
    return this.getAttr('linetype')
  }
  set linetype(value: string) {
    this.setAttr('linetype', value)
  }

  /**
   * Line weight of this layer.
   */
  get lineWeight() {
    return this.getAttr('lineWeight')
  }
  set lineWeight(value: number) {
    this.setAttr('lineWeight', value)
  }

  /**
   * Id of material assigned to this layer.
   */
  get materialId() {
    return this.getAttr('materialId')
  }
  set materialId(value: string) {
    this.setAttr('materialId', value)
  }
}
