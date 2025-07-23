import { AcGeBox2d, AcGeBox3d } from '@mlightcad/geometry-engine'

import { AcDbObject } from '../../base'

/**
 * This class represents object stored characteristics of each paperspace layout. Layout objects are
 * stored in an AcDbDictionary object with an ACAD_LAYOUT key, allowing easy iteration and indexing.
 */
export class AcDbLayout extends AcDbObject {
  private _layoutName: string
  private _tabOrder: number
  private _tabSelected: boolean
  private _blockTableRecordId: string
  private _limits: AcGeBox2d
  private _extents: AcGeBox3d

  constructor() {
    super()
    this._tabOrder = -1
    this._tabSelected = false
    this._blockTableRecordId = ''
    this._layoutName = ''
    this._limits = new AcGeBox2d()
    this._extents = new AcGeBox3d()
  }

  /**
   * The user-friendly layout name that is displayed in the tab control. Currently there is no restriction
   * on the name except that the length of the name is limited to 256 characters.
   */
  get layoutName() {
    return this._layoutName
  }
  set layoutName(value: string) {
    this._layoutName = value.length > 256 ? value.slice(0, 256) : value
  }

  /**
   * The tab order field, which controls the order in which the layouts are displayed in the tab control
   * that is docked to the bottom of the viewport. The tab order should be unique and sequential for each
   * layout in the database.
   */
  get tabOrder() {
    return this._tabOrder
  }
  set tabOrder(value: number) {
    this._tabOrder = value
  }

  /**
   * A flag to indicate whether the layout tab is included in the selection set for operations that affect
   * multiple tabs. The user can perform multiple selection via the user interface using shift-click.
   */
  get tabSelected() {
    return this._tabSelected
  }
  set tabSelected(value: boolean) {
    this._tabSelected = value
  }

  /**
   * The associated block table record id of this layout.
   */
  get blockTableRecordId() {
    return this._blockTableRecordId
  }
  set blockTableRecordId(value: string) {
    this._blockTableRecordId = value
  }

  /**
   * Limits for this layout (defined by LIMMAX while this layout is current)
   */
  get limits() {
    return this._limits
  }
  set limits(value: AcGeBox2d) {
    this._limits.copy(value)
  }

  /**
   * The current extents setting of the layout. This value may not be the actual extents of
   * the geometry in the layout, it is just the value last saved in the layout.
   */
  get extents() {
    return this._extents
  }
  set extents(value: AcGeBox3d) {
    this._extents.copy(value)
  }
}
