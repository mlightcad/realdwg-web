import type { DwgDatabase } from '@mlightcad/libredwg-web'

import {
  type AcDbDanglingEntityLibreDwg,
  acdbDropDanglingModelSpaceEntities
} from '../src/dropDanglingModelSpaceEntities'

interface FakeObject {
  handle: number
  supertype: number
  entmode?: number
  owner?: number
}

/** Builds a fake LibreDWG instance where object pointer = index + 1. */
function fakeLibreDwg(objects: FakeObject[]): AcDbDanglingEntityLibreDwg {
  const at = (ptr: number) => objects[ptr - 1]
  return {
    dwg_get_num_objects: () => objects.length,
    dwg_get_object: (_data, index) => index + 1,
    dwg_object_get_supertype: obj => at(obj).supertype,
    dwg_obj_get_handle_value: obj => BigInt(at(obj).handle),
    // Entity TIO pointer mirrors the object pointer.
    dwg_object_to_entity_tio: obj => obj,
    dwg_dynapi_common_value: (tio, field) => {
      const object = at(tio)
      if (field === 'entmode') return { success: true, data: object.entmode }
      if (field === 'ownerhandle') {
        return object.owner == null
          ? { success: true, data: 0 }
          : { success: true, data: tio }
      }
      return { success: false }
    },
    // Ref pointer mirrors the object pointer.
    dwg_ref_get_absref: ref => {
      const owner = at(ref).owner
      return owner == null ? null : Number(owner)
    }
  }
}

function database(handles: string[]): DwgDatabase {
  const entities = handles.map(handle => ({ type: 'LINE', handle }))
  return {
    tables: {
      BLOCK_RECORD: {
        entries: [
          { name: '*Model_Space', handle: '1F', entities: [...entities] }
        ]
      }
    },
    entities: [...entities]
  } as unknown as DwgDatabase
}

const ENTITY = 0
const OBJECT = 1

describe('acdbDropDanglingModelSpaceEntities', () => {
  it('drops block-owned entities whose owner block no longer exists', () => {
    const libredwg = fakeLibreDwg([
      { handle: 0x1f, supertype: OBJECT },
      { handle: 0x100, supertype: ENTITY, entmode: 2, owner: 0x1f },
      // Leftover of an erased anonymous *D block (owner 0x171BC is gone).
      { handle: 0x171c0, supertype: ENTITY, entmode: 0, owner: 0x171bc }
    ])
    const db = database(['100', '171C0'])

    expect(acdbDropDanglingModelSpaceEntities(libredwg, 1, db)).toBe(1)
    expect(
      db.tables.BLOCK_RECORD.entries[0].entities.map(e => e.handle)
    ).toEqual(['100'])
    expect(db.entities.map(e => e.handle)).toEqual(['100'])
  })

  it('keeps block-owned entities whose owner exists later in the map', () => {
    const libredwg = fakeLibreDwg([
      { handle: 0x200, supertype: ENTITY, entmode: 0, owner: 0x300 },
      { handle: 0x300, supertype: OBJECT }
    ])
    const db = database(['200'])

    expect(acdbDropDanglingModelSpaceEntities(libredwg, 1, db)).toBe(0)
    expect(db.tables.BLOCK_RECORD.entries[0].entities).toHaveLength(1)
  })

  it('keeps entities without an owner handle or with a space entmode', () => {
    const libredwg = fakeLibreDwg([
      { handle: 0x10, supertype: ENTITY, entmode: 0 },
      { handle: 0x11, supertype: ENTITY, entmode: 2, owner: 0xdead }
    ])
    const db = database(['10', '11'])

    expect(acdbDropDanglingModelSpaceEntities(libredwg, 1, db)).toBe(0)
    expect(db.tables.BLOCK_RECORD.entries[0].entities).toHaveLength(2)
  })

  it('ignores entities that are not in model space', () => {
    const libredwg = fakeLibreDwg([
      { handle: 0x50, supertype: ENTITY, entmode: 0, owner: 0x999 }
    ])
    const db = database(['51'])

    expect(acdbDropDanglingModelSpaceEntities(libredwg, 1, db)).toBe(0)
  })
})
