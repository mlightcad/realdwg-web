import { AcGePoint3d } from '@mlightcad/geometry-engine'

import type { AcDbDxfFiler } from '../../base/AcDbDxfFiler.js'
import type { AcDbObjectId } from '../../base/AcDbObject.js'
import type { AcDbTypedValue } from '../../base/AcDbTypedValue.js'
import { AcDbSymbolTableRecord } from '../../database/AcDbSymbolTableRecord.js'
import { AcDbEntity } from '../../entity/AcDbEntity.js'

/**
 * Sequential reader over the group codes of one DXF subclass.
 *
 * Associative-framework records (ACDBASSOC*) are positional: the same group
 * code (90, 330, 360, 40, …) repeats with different meanings, so they cannot be
 * read with the usual order-independent `switch`. The cursor collects every
 * pair up to the next subclass marker (100), end of object, or XData, and
 * hands them out in order.
 *
 * Reads tolerate a short record: a missing value yields the default.
 */
export class AcDbAssocDxfCursor {
  private _index = 0
  private _misses = 0

  private constructor(private readonly _items: AcDbTypedValue[]) {}

  /** Every pair of the subclass, consumed or not. */
  get items(): readonly AcDbTypedValue[] {
    return this._items
  }

  /**
   * True when every pair was consumed and no expected value was missing, i.e.
   * the record matched the layout the reader assumed.
   */
  get isClean(): boolean {
    return this.atEnd && this._misses === 0
  }

  /**
   * Consumes the pairs of the current subclass from `filer`. When `subclass`
   * is given, the `100` marker is consumed first if present.
   */
  static read(filer: AcDbDxfFiler, subclass?: string): AcDbAssocDxfCursor {
    if (subclass) filer.atSubclassData(subclass)
    const items: AcDbTypedValue[] = []
    while (!filer.atEndOfObject && !filer.atEof && !filer.atExtendedData) {
      const item = filer.readItem()
      if (!item) break
      if (Number(item.code) === 100) {
        filer.pushBackItem(item)
        break
      }
      items.push(item)
    }
    return new AcDbAssocDxfCursor(items)
  }

  /** Builds a cursor over already-collected pairs. */
  static fromItems(items: AcDbTypedValue[]): AcDbAssocDxfCursor {
    return new AcDbAssocDxfCursor(items)
  }

  get atEnd(): boolean {
    return this._index >= this._items.length
  }

  /** Group code of the next pair, or `undefined` at the end. */
  peekCode(): number | undefined {
    const item = this._items[this._index]
    return item ? Number(item.code) : undefined
  }

  /** Returns the next pair and advances. */
  next(): AcDbTypedValue | undefined {
    return this._items[this._index++]
  }

  /** Remaining pairs (not consumed). */
  rest(): AcDbTypedValue[] {
    const rest = this._items.slice(this._index)
    this._index = this._items.length
    return rest
  }

  private take(codes: readonly number[]): AcDbTypedValue | undefined {
    const code = this.peekCode()
    if (code === undefined || !codes.includes(code)) {
      this._misses += 1
      return undefined
    }
    return this.next()
  }

  int(code = 90, fallback = 0): number {
    const item = this.take([code])
    const n = Number(item?.value)
    return item && Number.isFinite(n) ? n : fallback
  }

  double(code = 40, fallback = 0): number {
    return this.int(code, fallback)
  }

  bool(code = 290, fallback = false): boolean {
    const item = this.take([code])
    if (!item) return fallback
    const v = item.value
    return typeof v === 'boolean' ? v : Number(v) !== 0
  }

  string(code = 1, fallback = ''): string {
    const item = this.take([code])
    return item ? String(item.value ?? '') : fallback
  }

  /** Reads a handle; `0` and empty become `''`. */
  id(codes: readonly number[] = [330, 360, 340, 350]): AcDbObjectId {
    const item = this.take(codes)
    return acdbAssocNormalizeId(item?.value)
  }

  /** Reads a handle and reports its group code (330 soft vs 360 hard). */
  idWithCode(
    codes: readonly number[] = [330, 360]
  ): { id: AcDbObjectId; code: number } | undefined {
    const item = this.take(codes)
    if (!item) return undefined
    return { id: acdbAssocNormalizeId(item.value), code: Number(item.code) }
  }

  /** Reads a point stored as `code`, `code + 10`, `code + 20`. */
  point(code = 10): AcGePoint3d {
    const x = this.double(code)
    const y = this.double(code + 10)
    const z = this.double(code + 20)
    return new AcGePoint3d(x, y, z)
  }

  /** Reads `count` consecutive values of `code`. */
  doubles(count: number, code = 40): number[] {
    const values: number[] = []
    for (let i = 0; i < count; i++) values.push(this.double(code))
    return values
  }
}

/** Normalizes a DXF handle value: `0`/empty → `''`. */
export function acdbAssocNormalizeId(value: unknown): AcDbObjectId {
  const id = String(value ?? '').trim()
  return id === '' || /^0+$/.test(id) ? '' : id
}

/**
 * Writes a handle the way AutoCAD does for associative records: a null id is
 * written explicitly as `0` (AutoCAD emits `330 0`, `360 0`).
 */
export function acdbAssocWriteId(
  filer: AcDbDxfFiler,
  code: number,
  id: AcDbObjectId | undefined
): void {
  filer.writeObjectId(code, acdbAssocIsIdWritten(filer, id) ? id : '0')
}

/**
 * True when `id` resolves in the written file: an OBJECTS record of the
 * current export, or a resident entity / symbol-table record (written in
 * TABLES, BLOCKS or ENTITIES).
 */
export function acdbAssocIsIdWritten(
  filer: AcDbDxfFiler,
  id: AcDbObjectId | undefined
): id is AcDbObjectId {
  if (!id) return false
  if (!filer.writtenObjectIds) return true
  if (filer.isObjectIdWritten(id)) return true
  const object = filer.database?.getObjectById(id)
  return object instanceof AcDbEntity || object instanceof AcDbSymbolTableRecord
}

/** Writes a 4×4 matrix as 16 row-major group-40 doubles (AutoCAD order). */
export function acdbAssocWriteMatrix(
  filer: AcDbDxfFiler,
  elements: readonly number[],
  code = 40
): void {
  // `elements` is column-major (three.js style).
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 4; col++) {
      filer.writeDouble(code, elements[col * 4 + row])
    }
  }
}
