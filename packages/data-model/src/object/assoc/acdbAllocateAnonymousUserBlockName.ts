import type { AcDbObject } from '../../base/AcDbObject.js'
import {
  AcDbBlockTableRecord,
  AcDbBlockTableRecordFlag
} from '../../database/AcDbBlockTableRecord.js'
import type { AcDbDatabase } from '../../database/AcDbDatabase.js'
import type { AcDbDictionary } from '../AcDbDictionary.js'

/**
 * Allocates the next free anonymous user block name (`*U{n}`).
 *
 * @param db - Database whose block table is scanned.
 * @returns A `*U{n}` name one greater than the largest existing one.
 */
export function acdbAllocateAnonymousUserBlockName(db: AcDbDatabase): string {
  let maxNum = 0
  for (const block of db.tables.blockTable.newIterator()) {
    const name = block.name
    if (!name.toUpperCase().startsWith('*U')) continue
    const suffix = name.slice(2)
    const num = Number(suffix)
    if (Number.isInteger(num) && num > maxNum) maxNum = num
  }
  return `*U${maxNum + 1}`
}

/**
 * Allocates the next free anonymous dictionary key with the given prefix
 * (e.g. `*AB`, `*AA`, `*AD`).
 *
 * Scans existing keys for the largest numeric suffix so removed entries do not
 * cause collisions when a later `setAt` would otherwise reuse `numEntries + 1`.
 */
export function acdbAllocateAssocDictionaryKey(
  dictionary: AcDbDictionary<AcDbObject>,
  prefix: string
): string {
  const upper = prefix.toUpperCase()
  let maxNum = 0
  for (const [key] of dictionary.entries()) {
    if (!key.toUpperCase().startsWith(upper)) continue
    const suffix = key.slice(prefix.length)
    const num = Number(suffix)
    if (Number.isInteger(num) && num > maxNum) maxNum = num
  }
  return `${prefix}${maxNum + 1}`
}

/**
 * Creates a new anonymous `*U` {@link AcDbBlockTableRecord} and adds it to
 * the block table.
 */
export function acdbCreateAnonymousUserBlock(
  db: AcDbDatabase,
  name?: string
): AcDbBlockTableRecord {
  const blockName = name ?? acdbAllocateAnonymousUserBlockName(db)
  const btr = new AcDbBlockTableRecord()
  btr.name = blockName
  btr.flags = AcDbBlockTableRecordFlag.Anonymous
  db.tables.blockTable.add(btr)
  return btr
}
