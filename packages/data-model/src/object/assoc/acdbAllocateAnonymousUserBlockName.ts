import {
  AcDbBlockTableRecord,
  AcDbBlockTableRecordFlag
} from '../../database/AcDbBlockTableRecord.js'
import type { AcDbDatabase } from '../../database/AcDbDatabase.js'

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
