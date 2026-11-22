import { AcDbDxfFiler } from '../base/AcDbDxfFiler.js'
import type { AcDbDxfPair } from '../base/AcDbDxfPair.js'
import { AcDbBlockReference } from '../entity/AcDbBlockReference.js'
import { AcDbMInsertBlock } from '../entity/AcDbMInsertBlock.js'
import {
  acdbDrainDxfObjectPairs,
  AcDbDxfPairArrayReader,
  acdbTypedValueToDxfPair
} from './AcDbDxfPairArrayReader.js'

/**
 * Drain one INSERT object's pairs (including XData) and create either an
 * {@link AcDbBlockReference} or an {@link AcDbMInsertBlock}.
 *
 * DXF stores both INSERT and MINSERT with the entity type name `INSERT`.
 * A MINSERT is recognized by its `AcDbMInsertBlock` subclass marker (ODA /
 * ezdxf output) or, for writers that keep the `AcDbBlockReference` marker
 * (AutoCAD), by a column count (70) or row count (71) greater than one.
 *
 * Expects the filer just after `(0, INSERT)`.
 */
export function acdbDxfInInsert(filer: AcDbDxfFiler): AcDbBlockReference {
  const pairs = drainInsertPairs(filer)
  const entity = isMInsert(pairs)
    ? new AcDbMInsertBlock('')
    : new AcDbBlockReference('')

  const replay = AcDbDxfFiler.forReading(new AcDbDxfPairArrayReader(pairs), {
    database: filer.database
  })
  entity.dxfIn(replay)
  return entity
}

function drainInsertPairs(filer: AcDbDxfFiler): AcDbDxfPair[] {
  const pairs = acdbDrainDxfObjectPairs(filer)
  // Include trailing XData so {@link AcDbObject.dxfIn} can consume it on replay.
  while (!filer.atEndOfObject && !filer.atEof) {
    const item = filer.readItem()
    if (!item) break
    if (Number(item.code) === 0) {
      filer.pushBackItem(item)
      break
    }
    pairs.push(acdbTypedValueToDxfPair(item))
  }
  return pairs
}

function isMInsert(pairs: readonly AcDbDxfPair[]): boolean {
  let inXData = false
  for (const pair of pairs) {
    if (pair.code >= 1000) {
      inXData = true
    }
    if (inXData) continue
    if (pair.code === 100 && pair.value === 'AcDbMInsertBlock') {
      return true
    }
    if (
      (pair.code === 70 || pair.code === 71) &&
      typeof pair.value === 'number' &&
      pair.value > 1
    ) {
      return true
    }
  }
  return false
}
