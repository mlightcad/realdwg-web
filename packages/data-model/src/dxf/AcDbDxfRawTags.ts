import type { AcDbDxfFiler } from '../base/AcDbDxfFiler.js'
import type { AcDbDxfPair } from '../base/AcDbDxfPair.js'
import type { AcDbTypedValue } from '../base/AcDbTypedValue.js'
import { acdbDrainDxfObjectPairs } from './AcDbDxfPairArrayReader.js'

/**
 * Tags of one DXF record kept verbatim for round-trip (ezdxf `DXFTagStorage`,
 * ODA unknown-class objects).
 *
 * `header` holds the pairs before the first subclass marker except the handle
 * (5/105) and owner (330), which are re-emitted from the live object so a
 * reminted handle or a new owner stays consistent. `body` starts at the first
 * subclass marker. XData is not stored here: it is read through the regular
 * {@link AcDbObject.dxfIn} path so `getXData` keeps working.
 */
export interface AcDbDxfRawTags {
  header: AcDbTypedValue[]
  body: AcDbTypedValue[]
}

/**
 * Drains the current record's tags (up to XData or the next group 0).
 *
 * @returns The captured tags plus the handle/owner found in the header.
 */
export function acdbCaptureDxfRawTags(
  filer: AcDbDxfFiler
): AcDbDxfRawTagsCapture {
  return acdbSplitDxfRawTags(acdbDrainDxfObjectPairs(filer))
}

export interface AcDbDxfRawTagsCapture {
  tags: AcDbDxfRawTags
  handle?: string
  ownerId?: string
  extensionDictionary?: string
}

/**
 * Splits one record's pairs into {@link AcDbDxfRawTags}. Pairs from the first
 * XData group (1001) on are ignored.
 *
 * The `{ACAD_XDICTIONARY` group is not kept: its id is returned and written
 * back like any native object's (only when the dictionary is exported).
 * Everything after the owner handle goes to `body`, so tags keep their
 * original order around the re-emitted 330.
 */
export function acdbSplitDxfRawTags(
  pairs: readonly AcDbDxfPair[]
): AcDbDxfRawTagsCapture {
  const tags: AcDbDxfRawTags = { header: [], body: [] }
  let handle: string | undefined
  let ownerId: string | undefined
  let extensionDictionary: string | undefined
  let inBody = false
  let xDictionaryDepth = 0
  let controlDepth = 0
  for (const pair of pairs) {
    if (pair.code === 1001) break
    if (inBody) {
      tags.body.push(toTypedValue(pair))
      continue
    }
    if (pair.code === 102) {
      const value = String(pair.value)
      if (value.startsWith('{')) {
        controlDepth += 1
        if (value === '{ACAD_XDICTIONARY' && xDictionaryDepth === 0) {
          xDictionaryDepth = controlDepth
          continue
        }
      } else if (value === '}') {
        const closesXDictionary = controlDepth === xDictionaryDepth
        controlDepth -= 1
        if (closesXDictionary) {
          xDictionaryDepth = 0
          continue
        }
      }
    } else if (xDictionaryDepth > 0) {
      if (pair.code === 360 && !extensionDictionary) {
        extensionDictionary = String(pair.value)
      }
      continue
    } else if (controlDepth === 0) {
      if ((pair.code === 5 || pair.code === 105) && !handle) {
        handle = String(pair.value)
        continue
      }
      if (pair.code === 330 && !ownerId) {
        ownerId = String(pair.value)
        inBody = true
        continue
      }
      if (pair.code === 100) {
        inBody = true
        tags.body.push(toTypedValue(pair))
        continue
      }
    }
    tags.header.push(toTypedValue(pair))
  }
  return { tags, handle, ownerId, extensionDictionary }
}

/**
 * Writes the handle, the preserved header tags (e.g. reactors), the
 * extension dictionary, the owner and the body. The caller writes the
 * `(0, TYPE)` record start and any XData afterwards.
 */
export function acdbWriteDxfRawTags(
  filer: AcDbDxfFiler,
  tags: AcDbDxfRawTags,
  object: {
    objectId?: string
    ownerId?: string
    extensionDictionary?: string
  },
  handleCode = 5
) {
  filer.writeHandle(handleCode, object.objectId)
  filer.writeRawPairs(tags.header)
  filer.writeExtensionDictionary(object.extensionDictionary)
  filer.writeObjectId(330, object.ownerId)
  filer.writeRawPairs(tags.body)
}

function toTypedValue(pair: AcDbDxfPair): AcDbTypedValue {
  return { code: pair.code, value: pair.value } as AcDbTypedValue
}
