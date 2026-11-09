import type { DwgDatabase, DwgEntity } from '@mlightcad/libredwg-web'

/** LibreDWG `entmode` value meaning "owned by a regular block". */
const ENTMODE_BLOCK = 0
/** `Dwg_Object_Supertype.DWG_SUPERTYPE_ENTITY`. */
const SUPERTYPE_ENTITY = 0

/**
 * Subset of the LibreDWG WASM API used by
 * {@link acdbDropDanglingModelSpaceEntities}. Kept structural so tests can
 * pass a fake instance.
 */
export interface AcDbDanglingEntityLibreDwg {
  dwg_get_num_objects(data: number): number
  dwg_get_object(data: number, index: number): number
  dwg_object_get_supertype(obj: number): number
  dwg_obj_get_handle_value(obj: number): bigint | null
  dwg_object_to_entity_tio(obj: number): number
  dwg_dynapi_common_value(
    tio: number,
    field: string
  ): { success: boolean; data?: unknown }
  dwg_ref_get_absref(ref: number): number | null
}

/**
 * Removes entities that `@mlightcad/libredwg-web` adopted into
 * `*Model_Space` although AutoCAD never draws them.
 *
 * libredwg-web collects entities missing from a block's ownership chain and,
 * for `*Model_Space`, also appends every entity whose owner cannot be
 * resolved. That also catches leftovers of erased anonymous blocks (typically
 * stale `*D` dimension pictures): their `entmode` says "owned by a block" and
 * their owner handle points at a BLOCK_HEADER that no longer exists. AutoCAD
 * ignores such objects, so showing them makes hidden geometry appear.
 *
 * Entities without an owner handle, or with `entmode` model/paper space, are
 * kept because some DWG writers omit the owner for genuine model-space
 * entities.
 *
 * @param libredwg - LibreDWG instance that produced `database`.
 * @param data - `Dwg_Data` pointer, still alive (call before `dwg_free`).
 * @param database - Converted database; model-space entity lists are
 *   filtered in place.
 * @returns Number of removed entities.
 */
export function acdbDropDanglingModelSpaceEntities(
  libredwg: AcDbDanglingEntityLibreDwg,
  data: number,
  database: DwgDatabase
): number {
  const modelSpace = (database.tables.BLOCK_RECORD?.entries ?? []).find(
    btr => btr.name?.toUpperCase() === '*MODEL_SPACE'
  )
  if (!modelSpace?.entities?.length) return 0

  const modelSpaceHandles = new Set(
    modelSpace.entities.map(entity => normHandle(entity.handle))
  )
  const existingHandles = new Set<bigint>()
  const candidates: { handle: string; owner: bigint }[] = []

  const count = libredwg.dwg_get_num_objects(data)
  for (let i = 0; i < count; i++) {
    const obj = libredwg.dwg_get_object(data, i)
    if (!obj) continue
    const handle = libredwg.dwg_obj_get_handle_value(obj)
    if (handle == null) continue
    existingHandles.add(BigInt(handle))

    if (libredwg.dwg_object_get_supertype(obj) !== SUPERTYPE_ENTITY) continue
    const hex = handle.toString(16).toUpperCase()
    if (!modelSpaceHandles.has(hex)) continue

    const owner = blockOwnerHandle(libredwg, obj)
    if (owner != null) candidates.push({ handle: hex, owner })
  }

  // Resolve after the scan: owners may appear later in the object map.
  const dangling = new Set(
    candidates
      .filter(candidate => !existingHandles.has(candidate.owner))
      .map(candidate => candidate.handle)
  )
  if (dangling.size === 0) return 0

  const keep = (entity: DwgEntity) => !dangling.has(normHandle(entity.handle))
  modelSpace.entities = modelSpace.entities.filter(keep)
  if (Array.isArray(database.entities)) {
    database.entities = database.entities.filter(keep)
  }
  return dangling.size
}

/**
 * Returns the owner handle of a block-owned entity (`entmode` 0), or
 * `undefined` when the entity is not block-owned or names no owner.
 */
function blockOwnerHandle(
  libredwg: AcDbDanglingEntityLibreDwg,
  obj: number
): bigint | undefined {
  try {
    const tio = libredwg.dwg_object_to_entity_tio(obj)
    if (!tio) return undefined
    const entmode = libredwg.dwg_dynapi_common_value(tio, 'entmode')
    if (!entmode?.success || Number(entmode.data) !== ENTMODE_BLOCK) {
      return undefined
    }
    const ref = libredwg.dwg_dynapi_common_value(tio, 'ownerhandle')
    if (!ref?.success || !ref.data) return undefined
    const absref = libredwg.dwg_ref_get_absref(ref.data as number)
    return absref ? BigInt(absref) : undefined
  } catch {
    return undefined
  }
}

function normHandle(value: unknown): string {
  if (value == null || value === '') return ''
  return String(value).trim().toUpperCase()
}
