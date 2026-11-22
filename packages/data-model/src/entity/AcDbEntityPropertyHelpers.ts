import {
  AcGePoint3d,
  AcGePoint3dLike,
  AcGeVector3d,
  AcGeVector3dLike
} from '@mlightcad/geometry-engine'

import {
  AcDbEntityPropertyType,
  AcDbEntityRuntimeProperty
} from './AcDbEntityProperties.js'

/**
 * Enum option shown by the property palette.
 */
export interface AcDbEntityPropertyOption {
  label: string
  value: unknown
}

/**
 * Creates a runtime property. The property is editable exactly when `set` is
 * given, so metadata and accessor can never disagree.
 *
 * @param name - Property name (also the i18n key used by the palette).
 * @param type - Value type, which selects the palette editor.
 * @param get - Reads the live value.
 * @param set - Writes a new value; omit for read-only properties.
 * @param options - Choices for `enum` properties.
 */
export function acdbCreateProperty<T>(
  name: string,
  type: AcDbEntityPropertyType,
  get: () => T,
  set?: (value: T) => void,
  options?: AcDbEntityPropertyOption[]
): AcDbEntityRuntimeProperty<T> {
  const property: AcDbEntityRuntimeProperty<T> = {
    name,
    type,
    editable: set != null,
    accessor: set ? { get, set } : { get }
  }
  if (options) property.options = options
  return property
}

/**
 * Builds enum options from a numeric TypeScript enum, labelled by the enum
 * member names (the palette translates them through `entity.enum`).
 *
 * @param enumObject - Numeric enum object.
 * @param values - Values to include, in display order. Defaults to all
 *   numeric members.
 */
export function acdbEnumOptions(
  enumObject: Record<string | number, string | number>,
  values?: number[]
): AcDbEntityPropertyOption[] {
  const list =
    values ??
    Object.values(enumObject).filter(
      (value): value is number => typeof value === 'number'
    )
  return list.map(value => ({
    label: String(enumObject[value] ?? value),
    value
  }))
}

type AcDbAxis = 'x' | 'y' | 'z'
const AXES: readonly AcDbAxis[] = ['x', 'y', 'z']
const AXIS_SUFFIX: Record<AcDbAxis, string> = { x: 'X', y: 'Y', z: 'Z' }

/**
 * Creates `<prefix>X`, `<prefix>Y` and `<prefix>Z` float properties for a
 * point.
 *
 * Editing one coordinate builds a new point and passes it to `set`, so the
 * entity's own setter runs (it may refresh cached extents or other derived
 * data). Never mutate the object returned by `get` in place.
 *
 * @param prefix - Property name prefix, e.g. `center`.
 * @param get - Reads the live point.
 * @param set - Writes the whole point; omit for read-only coordinates.
 */
export function acdbPoint3dProperties(
  prefix: string,
  get: () => AcGePoint3dLike,
  set?: (value: AcGePoint3d) => void
): AcDbEntityRuntimeProperty<number>[] {
  return AXES.map(axis =>
    acdbCreateProperty<number>(
      `${prefix}${AXIS_SUFFIX[axis]}`,
      'float',
      () => get()[axis],
      set
        ? (value: number) => {
            const point = new AcGePoint3d(get())
            point[axis] = value
            set(point)
          }
        : undefined
    )
  )
}

/**
 * Creates `<prefix>X`, `<prefix>Y` and `<prefix>Z` float properties for a
 * vector. See {@link acdbPoint3dProperties} for the editing contract.
 *
 * Most vectors (normals, directions) are shown read-only: editing one
 * component of a unit vector and then normalizing changes the other
 * components as well, which is not what the user typed.
 *
 * @param prefix - Property name prefix, e.g. `normal`.
 * @param get - Reads the live vector.
 * @param set - Writes the whole vector; omit for read-only components.
 */
export function acdbVector3dProperties(
  prefix: string,
  get: () => AcGeVector3dLike,
  set?: (value: AcGeVector3d) => void
): AcDbEntityRuntimeProperty<number>[] {
  return AXES.map(axis =>
    acdbCreateProperty<number>(
      `${prefix}${AXIS_SUFFIX[axis]}`,
      'float',
      () => get()[axis],
      set
        ? (value: number) => {
            const vector = new AcGeVector3d(get())
            vector[axis] = value
            set(vector)
          }
        : undefined
    )
  )
}

/**
 * Creates an `array` property for a list of points.
 *
 * The palette edits one element at a time: it copies the array returned by
 * `get`, replaces the edited coordinate of one item and passes the whole
 * array to `set`. `get` returns plain `{ x, y[, z] }` copies, so the palette
 * can never mutate the entity's internal storage by accident.
 *
 * @param name - Property name, e.g. `vertices`.
 * @param dimension - 2 for `{x, y}` items, 3 for `{x, y, z}` items.
 * @param get - Reads the live points.
 * @param set - Writes all points (same count as `get`); omit for read-only.
 */
export function acdbPointArrayProperty(
  name: string,
  dimension: 2 | 3,
  get: () => ArrayLike<AcGePoint3dLike | { x: number; y: number }>,
  set?: (points: AcGePoint3dLike[]) => void
): AcDbEntityRuntimeProperty<AcGePoint3dLike[]> {
  const axes = dimension === 2 ? AXES.slice(0, 2) : AXES
  return {
    name,
    type: 'array',
    editable: set != null,
    itemSchema: {
      properties: axes.map(axis => ({
        name: axis,
        type: 'float' as const,
        editable: set != null
      }))
    },
    accessor: {
      get: () =>
        Array.from(get(), point => {
          const z = (point as AcGePoint3dLike).z
          return dimension === 2
            ? { x: point.x, y: point.y, z: 0 }
            : { x: point.x, y: point.y, z: z ?? 0 }
        }),
      ...(set ? { set } : {})
    }
  }
}
