import { AcCmColor } from '@mlightcad/common'

import { AcDbDxfFiler } from '../base/AcDbDxfFiler.js'
import { AcDbObject, type AcDbObjectId } from '../base/AcDbObject.js'
import { AcDbEntity } from '../entity/AcDbEntity.js'
import { AcDbObjectIterator } from '../misc/AcDbObjectIterator.js'

/**
 * Nongraphical GROUP object (DXF GROUP / ObjectARX `AcDbGroup`).
 *
 * A group is an ordered, named persistent selection set of database entities.
 * It does not own its members. The group **name** is the key in the
 * `ACAD_GROUP` dictionary; DXF group code 300 stores the **description**.
 *
 * @remarks
 * ObjectARX requires the group to be added to the group dictionary (so it has
 * an object id) before members are appended.
 */
export class AcDbGroup extends AcDbObject {
  /** Dictionary key name of this group (`ACAD_GROUP` entry). */
  private _name = ''
  /** Group description (DXF group 300). */
  private _description = ''
  /** True when this is an anonymous (`*A…`) group. */
  private _anonymous = false
  /** Whether the group can be selected as a unit. */
  private _selectable = true
  /** Soft-pointer member entity ids, in group order. */
  private _entityIds: AcDbObjectId[] = []

  /**
   * Creates a new group.
   *
   * @param description - Optional description (ObjectARX ctor first arg).
   * @param selectable - Whether the group is selectable as a unit (default `true`).
   */
  constructor(description = '', selectable = true) {
    super()
    this._description = description
    this._selectable = selectable
  }

  /**
   * Gets the dictionary key name of this group (`ACAD_GROUP` entry).
   *
   * @returns The group name.
   */
  get name() {
    return this._name
  }

  /**
   * Sets the dictionary key name of this group.
   *
   * Prefer {@link setName} when the group is already stored in
   * `database.objects.group`, so the dictionary key stays in sync.
   *
   * @param value - The new group name.
   */
  set name(value: string) {
    this._name = value
  }

  /**
   * Gets the group description (DXF group 300).
   *
   * @returns The description string.
   */
  get description() {
    return this._description
  }

  /**
   * Sets the group description (DXF group 300).
   *
   * @param value - The new description.
   */
  set description(value: string) {
    this._description = value
  }

  /**
   * Gets whether this is an anonymous (`*A…`) group.
   *
   * @returns `true` when the group is anonymous.
   *
   * @deprecated Prefer {@link isAnonymous} / {@link setAnonymous}.
   */
  get unnamed() {
    return this._anonymous
  }

  /**
   * Sets whether this is an anonymous group.
   *
   * @param value - `true` to mark the group anonymous.
   *
   * @deprecated Prefer {@link isAnonymous} / {@link setAnonymous}.
   */
  set unnamed(value: boolean) {
    this._anonymous = value
  }

  /**
   * Gets whether this is an anonymous group.
   *
   * @returns `true` when the group is anonymous.
   */
  get anonymous() {
    return this._anonymous
  }

  /**
   * Sets whether this is an anonymous group.
   *
   * @param value - `true` to mark the group anonymous.
   */
  set anonymous(value: boolean) {
    this._anonymous = value
  }

  /**
   * Gets whether the group can be selected as a unit.
   *
   * @returns `true` when the group is selectable.
   */
  get selectable() {
    return this._selectable
  }

  /**
   * Sets whether the group can be selected as a unit.
   *
   * @param value - `true` to allow selecting the group as a unit.
   */
  set selectable(value: boolean) {
    this._selectable = value
  }

  /**
   * Gets soft-pointer member entity ids, in group order.
   *
   * @returns A readonly view of member object ids.
   */
  get entityIds(): readonly AcDbObjectId[] {
    return this._entityIds
  }

  /**
   * Replaces the entire member id list.
   *
   * @param value - New ordered list of member object ids.
   */
  set entityIds(value: readonly AcDbObjectId[]) {
    this._entityIds = [...value]
  }

  /**
   * Appends one member id to the group.
   *
   * @param id - Object id of the entity to append.
   *
   * @deprecated Prefer {@link append}.
   */
  addEntityId(id: AcDbObjectId) {
    this.append(id)
  }

  /**
   * Returns whether this group is anonymous.
   *
   * Mirrors ObjectARX `AcDbGroup::isAnonymous`.
   *
   * @returns `true` when the group is anonymous.
   */
  isAnonymous(): boolean {
    return this._anonymous
  }

  /**
   * Marks this group as anonymous.
   *
   * Mirrors ObjectARX `AcDbGroup::setAnonymous`.
   */
  setAnonymous(): void {
    this._anonymous = true
  }

  /**
   * Returns whether the group can be selected as a unit.
   *
   * Mirrors ObjectARX `AcDbGroup::isSelectable`.
   *
   * @returns `true` when the group is selectable.
   */
  isSelectable(): boolean {
    return this._selectable
  }

  /**
   * Sets whether the group can be selected as a unit.
   *
   * Mirrors ObjectARX `AcDbGroup::setSelectable`.
   *
   * @param value - `true` to allow selecting the group as a unit.
   */
  setSelectable(value: boolean): void {
    this._selectable = value
  }

  /**
   * Returns whether the group is not accessible.
   *
   * Mirrors ObjectARX `AcDbGroup::isNotAccessible`. This port always returns
   * `false` (inaccessible/proxy groups are not modeled).
   *
   * @returns Always `false`.
   */
  isNotAccessible(): boolean {
    return false
  }

  /**
   * Sets the group name and, when database-bound, renames its `ACAD_GROUP`
   * dictionary entry to match.
   *
   * Mirrors ObjectARX `AcDbGroup::setName`.
   *
   * @param name - The new group name.
   */
  setName(name: string): void {
    const next = String(name ?? '')
    const dict = this.database?.objects.group
    if (!dict) {
      this._name = next
      return
    }

    // Prefer the in-memory name when it still matches the dict entry; otherwise
    // scan for this object (e.g. setAt before name was assigned).
    let currentKey: string | undefined
    if (this._name && dict.getAt(this._name) === this) {
      currentKey = this._name
    } else {
      for (const [key, existing] of dict.entries()) {
        if (existing === this) {
          currentKey = key
          break
        }
      }
    }

    if (currentKey === next) {
      this._name = next
      return
    }

    // Do not overwrite another group; leave `_name` unchanged on collision.
    const conflict = next ? dict.getAt(next) : undefined
    if (conflict && conflict !== this) return

    if (currentKey != null && currentKey !== next) {
      dict.remove(currentKey)
      if (next) dict.setAt(next, this)
    }

    this._name = next
  }

  /**
   * Sets the group description (DXF group 300).
   *
   * Mirrors ObjectARX `AcDbGroup::setDescription`.
   *
   * @param description - The new description.
   */
  setDescription(description: string): void {
    this._description = String(description ?? '')
  }

  /**
   * Returns the number of member entities in the group.
   *
   * Mirrors ObjectARX `AcDbGroup::numEntities`.
   *
   * @returns Member count.
   */
  numEntities(): number {
    return this._entityIds.length
  }

  /**
   * Copies all member object ids into `out` (when provided) and returns the
   * member count.
   *
   * Mirrors ObjectARX `AcDbGroup::allEntityIds`.
   *
   * @param out - Optional array cleared and filled with member ids.
   * @returns The number of member ids.
   */
  allEntityIds(out?: AcDbObjectId[]): number {
    if (out) {
      out.length = 0
      out.push(...this._entityIds)
    }
    return this._entityIds.length
  }

  /**
   * Returns whether the group contains the given entity or object id.
   *
   * Mirrors ObjectARX `AcDbGroup::has`.
   *
   * @param entityOrId - An {@link AcDbEntity} or an object id string.
   * @returns `true` when the id is a member of this group.
   */
  has(entityOrId: AcDbEntity | AcDbObjectId): boolean {
    const id =
      typeof entityOrId === 'string' ? entityOrId : (entityOrId.objectId ?? '')
    if (!id) return false
    return this._entityIds.includes(id)
  }

  /**
   * Returns the zero-based index of a member id, or `-1` when not found.
   *
   * Mirrors ObjectARX `AcDbGroup::getIndex`.
   *
   * @param id - Member object id to look up.
   * @returns Index in the group, or `-1`.
   */
  getIndex(id: AcDbObjectId): number {
    return this._entityIds.indexOf(id)
  }

  /**
   * Creates an iterator over member object ids (in group order).
   *
   * Uses the shared {@link AcDbObjectIterator} pattern of this codebase
   * (rather than ObjectARX `AcDbGroupIterator`).
   *
   * @returns An iterator yielding member {@link AcDbObjectId} values.
   *
   * @example
   * ```typescript
   * for (const id of group.newIterator()) {
   *   const entity = db.getObjectById(id)
   * }
   * ```
   */
  newIterator(): AcDbObjectIterator<AcDbObjectId> {
    return new AcDbObjectIterator(this._entityIds)
  }

  /**
   * Appends one or more member ids to the end of the group.
   *
   * Duplicate ids already in the group are ignored. Mirrors ObjectARX
   * `AcDbGroup::append`.
   *
   * @param idOrIds - A single object id or an array of object ids.
   */
  append(idOrIds: AcDbObjectId | readonly AcDbObjectId[]): void {
    const ids = Array.isArray(idOrIds) ? idOrIds : [idOrIds]
    for (const id of ids) {
      if (!id || this._entityIds.includes(id)) continue
      this._entityIds.push(id)
    }
  }

  /**
   * Prepends one or more member ids to the start of the group.
   *
   * Duplicate ids already in the group are ignored. Mirrors ObjectARX
   * `AcDbGroup::prepend`.
   *
   * @param idOrIds - A single object id or an array of object ids.
   */
  prepend(idOrIds: AcDbObjectId | readonly AcDbObjectId[]): void {
    const ids = Array.isArray(idOrIds) ? idOrIds : [idOrIds]
    for (let i = ids.length - 1; i >= 0; i--) {
      const id = ids[i]
      if (!id || this._entityIds.includes(id)) continue
      this._entityIds.unshift(id)
    }
  }

  /**
   * Inserts one or more member ids at the given index.
   *
   * Duplicate ids already in the group are ignored. Mirrors ObjectARX
   * `AcDbGroup::insertAt`.
   *
   * @param index - Zero-based insertion index (clamped to `[0, length]`).
   * @param idOrIds - A single object id or an array of object ids.
   */
  insertAt(
    index: number,
    idOrIds: AcDbObjectId | readonly AcDbObjectId[]
  ): void {
    const ids = (Array.isArray(idOrIds) ? idOrIds : [idOrIds]).filter(
      id => !!id && !this._entityIds.includes(id)
    )
    if (ids.length === 0) return
    const at = Math.max(0, Math.min(this._entityIds.length, Math.trunc(index)))
    this._entityIds.splice(at, 0, ...ids)
  }

  /**
   * Removes one or more members by object id.
   *
   * Mirrors ObjectARX `AcDbGroup::remove`.
   *
   * @param idOrIds - A single object id or an array of object ids to remove.
   */
  remove(idOrIds: AcDbObjectId | readonly AcDbObjectId[]): void {
    const toRemove = new Set(
      (Array.isArray(idOrIds) ? idOrIds : [idOrIds]).filter(Boolean)
    )
    if (toRemove.size === 0) return
    this._entityIds = this._entityIds.filter(id => !toRemove.has(id))
  }

  /**
   * Removes a member at `index`, or removes the given ids starting from that
   * index when `ids` is provided.
   *
   * Mirrors ObjectARX `AcDbGroup::removeAt`.
   *
   * @param index - Zero-based index of the first member to consider.
   * @param ids - Optional subset of ids to remove from `index` onward.
   */
  removeAt(index: number, ids?: readonly AcDbObjectId[]): void {
    const at = Math.trunc(index)
    if (at < 0 || at >= this._entityIds.length) return
    if (ids && ids.length > 0) {
      const toRemove = new Set(ids.filter(Boolean))
      this._entityIds = this._entityIds.filter((id, i) => {
        if (i < at) return true
        return !toRemove.has(id)
      })
      return
    }
    this._entityIds.splice(at, 1)
  }

  /**
   * Replaces one member id with another.
   *
   * If `newId` is already in the group, `oldId` is simply removed. Mirrors
   * ObjectARX `AcDbGroup::replace`.
   *
   * @param oldId - Existing member object id.
   * @param newId - Replacement object id.
   */
  replace(oldId: AcDbObjectId, newId: AcDbObjectId): void {
    if (!oldId || !newId || oldId === newId) return
    const index = this._entityIds.indexOf(oldId)
    if (index < 0) return
    if (this._entityIds.includes(newId)) {
      this._entityIds.splice(index, 1)
      return
    }
    this._entityIds[index] = newId
  }

  /**
   * Moves `num` members starting at `fromIndex` so they begin at `toIndex`.
   *
   * Mirrors ObjectARX `AcDbGroup::transfer`.
   *
   * @param fromIndex - Start index of the block to move.
   * @param toIndex - Destination index for the block.
   * @param num - Number of members to move.
   */
  transfer(fromIndex: number, toIndex: number, num: number): void {
    const from = Math.trunc(fromIndex)
    const to = Math.trunc(toIndex)
    const count = Math.trunc(num)
    if (count <= 0 || from < 0 || from >= this._entityIds.length) return
    const slice = this._entityIds.splice(from, count)
    let insertAt = to
    if (to > from) insertAt = Math.max(0, to - slice.length)
    insertAt = Math.max(0, Math.min(this._entityIds.length, insertAt))
    this._entityIds.splice(insertAt, 0, ...slice)
  }

  /**
   * Reverses the order of members in the group.
   *
   * Mirrors ObjectARX `AcDbGroup::reverse`.
   */
  reverse(): void {
    this._entityIds.reverse()
  }

  /**
   * Removes all members from the group.
   *
   * Mirrors ObjectARX `AcDbGroup::clear`.
   */
  clear(): void {
    this._entityIds = []
  }

  /**
   * Sets the color of every resolvable member entity.
   *
   * Mirrors ObjectARX `AcDbGroup::setColor`.
   *
   * @param color - Color to apply (cloned onto each entity).
   */
  setColor(color: AcCmColor): void {
    for (const entity of this.memberEntities()) {
      entity.color = color.clone()
    }
  }

  /**
   * Sets the ACI color of every resolvable member entity.
   *
   * Mirrors ObjectARX `AcDbGroup::setColorIndex`.
   *
   * @param index - AutoCAD Color Index (`0`–`256`).
   */
  setColorIndex(index: number): void {
    const color = new AcCmColor()
    color.colorIndex = index
    this.setColor(color)
  }

  /**
   * Sets the layer of every resolvable member entity.
   *
   * Mirrors ObjectARX `AcDbGroup::setLayer`. When `layerOrId` is an object id
   * of a layer table record, the record's name is used.
   *
   * @param layerOrId - Layer name or layer-table-record object id.
   */
  setLayer(layerOrId: string | AcDbObjectId): void {
    const layerName = this.resolveLayerName(layerOrId)
    if (!layerName) return
    for (const entity of this.memberEntities()) {
      entity.layer = layerName
    }
  }

  /**
   * Sets the linetype of every resolvable member entity.
   *
   * Mirrors ObjectARX `AcDbGroup::setLinetype`. When `linetypeOrId` is an
   * object id of a linetype table record, the record's name is used.
   *
   * @param linetypeOrId - Linetype name or linetype-table-record object id.
   */
  setLinetype(linetypeOrId: string | AcDbObjectId): void {
    const name = this.resolveLinetypeName(linetypeOrId)
    if (!name) return
    for (const entity of this.memberEntities()) {
      entity.lineType = name
    }
  }

  /**
   * Sets the linetype scale of every resolvable member entity.
   *
   * Mirrors ObjectARX `AcDbGroup::setLinetypeScale`.
   *
   * @param scale - Linetype scale factor.
   */
  setLinetypeScale(scale: number): void {
    for (const entity of this.memberEntities()) {
      entity.linetypeScale = scale
    }
  }

  /**
   * Sets the material of every resolvable member entity.
   *
   * Mirrors ObjectARX `AcDbGroup::setMaterial`. Currently a no-op because
   * entities keep material as a raw DXF extra without a typed setter.
   *
   * @param _materialOrId - Material name or material object id.
   */
  setMaterial(_materialOrId: string | AcDbObjectId): void {
    // Entities keep material as a raw DXF extra today; no typed setter yet.
  }

  /**
   * Sets the visibility of every resolvable member entity.
   *
   * Mirrors ObjectARX `AcDbGroup::setVisibility`.
   *
   * @param visible - `true` to show members; `false` to hide them.
   */
  setVisibility(visible: boolean): void {
    for (const entity of this.memberEntities()) {
      entity.visibility = visible
    }
  }

  /**
   * Sets the highlight state of every resolvable member entity.
   *
   * Mirrors ObjectARX `AcDbGroup::setHighlight`. Currently a no-op because
   * this model has no per-entity highlight persistence.
   *
   * @param _highlight - Desired highlight state.
   */
  setHighlight(_highlight: boolean): void {
    // No per-entity highlight persistence in this model.
  }

  /**
   * Writes DXF subclass fields for this group.
   *
   * @param filer - DXF output writer.
   * @returns This instance for chaining.
   */
  override dxfOutFields(filer: AcDbDxfFiler) {
    super.dxfOutFields(filer)
    filer.writeSubclassMarker('AcDbGroup')
    if (this._description) {
      filer.writeString(300, this._description)
    }
    filer.writeInt16(70, this._anonymous ? 1 : 0)
    filer.writeInt16(71, this._selectable ? 1 : 0)
    for (const id of this._entityIds) {
      filer.writeObjectId(340, id)
    }
    return this
  }

  /**
   * Reads DXF subclass fields for this group.
   *
   * @param filer - DXF input reader positioned at this object.
   * @returns This instance for chaining.
   */
  override dxfInFields(filer: AcDbDxfFiler): this {
    super.dxfInFields(filer)
    filer.atSubclassData('AcDbGroup')
    this._entityIds = []

    while (!filer.atEndOfObject && !filer.atEof && !filer.atExtendedData) {
      const item = filer.readItem()
      if (!item) break
      const code = Number(item.code)
      if (code === 100) {
        filer.pushBackItem(item)
        break
      }
      switch (code) {
        case 300:
          this._description = String(item.value)
          break
        case 70:
          this._anonymous = Number(item.value) !== 0
          break
        case 71:
          this._selectable = Number(item.value) !== 0
          break
        case 340:
          this._entityIds.push(String(item.value))
          break
        default:
          break
      }
    }
    return this
  }

  /**
   * Resolves member ids to {@link AcDbEntity} instances via the owning
   * database. Non-entity or missing ids are skipped.
   *
   * @returns Entities currently resolvable from {@link entityIds}.
   */
  private memberEntities(): AcDbEntity[] {
    const db = this.database
    if (!db) return []
    const result: AcDbEntity[] = []
    for (const id of this._entityIds) {
      const obj = db.getObjectById(id)
      if (obj instanceof AcDbEntity) result.push(obj)
    }
    return result
  }

  /**
   * Resolves a layer name from a name string or layer-table-record object id.
   *
   * @param layerOrId - Layer name or object id.
   * @returns Layer name to apply to member entities.
   */
  private resolveLayerName(layerOrId: string): string {
    const db = this.database
    if (!db) return String(layerOrId ?? '')
    const asId = db.getObjectById(layerOrId)
    if (
      asId &&
      'name' in asId &&
      typeof (asId as { name?: unknown }).name === 'string'
    ) {
      return (asId as { name: string }).name
    }
    return String(layerOrId ?? '')
  }

  /**
   * Resolves a linetype name from a name string or linetype-table-record
   * object id.
   *
   * @param linetypeOrId - Linetype name or object id.
   * @returns Linetype name to apply to member entities.
   */
  private resolveLinetypeName(linetypeOrId: string): string {
    const db = this.database
    if (!db) return String(linetypeOrId ?? '')
    const asId = db.getObjectById(linetypeOrId)
    if (
      asId &&
      'name' in asId &&
      typeof (asId as { name?: unknown }).name === 'string'
    ) {
      return (asId as { name: string }).name
    }
    return String(linetypeOrId ?? '')
  }
}
