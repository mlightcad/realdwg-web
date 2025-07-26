/**
 * Utility functions extracted from lodash-es to reduce bundle size
 * These are simplified implementations of commonly used lodash functions
 */

/**
 * Creates a shallow clone of an object
 * @param obj The object to clone
 * @returns A shallow clone of the object
 */
export function clone<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') {
    return obj
  }

  if (Array.isArray(obj)) {
    return [...obj] as T
  }

  return { ...obj }
}

/**
 * Assigns own enumerable properties of source objects to the destination object for all destination properties that resolve to undefined.
 * @param obj The destination object
 * @param sources The source objects
 * @returns The destination object
 */
export function defaults(
  obj: Record<string, unknown>,
  ...sources: Record<string, unknown>[]
): Record<string, unknown> {
  for (const source of sources) {
    if (source) {
      for (const key in source) {
        if (
          Object.prototype.hasOwnProperty.call(source, key) &&
          obj[key] === undefined
        ) {
          obj[key] = source[key]
        }
      }
    }
  }
  return obj
}

/**
 * Checks if path is a direct property of object
 * @param obj The object to query
 * @param path The path to check
 * @returns Returns true if path exists, else false
 */
export function has(obj: Record<string, unknown>, path: string): boolean {
  return obj != null && Object.prototype.hasOwnProperty.call(obj, path)
}

/**
 * Checks if value is an empty object, collection, map, or set
 * @param value The value to check
 * @returns Returns true if value is empty, else false
 */
export function isEmpty(value: unknown): boolean {
  if (value == null) {
    return true
  }

  if (Array.isArray(value) || typeof value === 'string') {
    return value.length === 0
  }

  if (value instanceof Map || value instanceof Set) {
    return value.size === 0
  }

  if (typeof value === 'object') {
    return Object.keys(value as Record<string, unknown>).length === 0
  }

  return false
}

/**
 * Performs a deep comparison between two values to determine if they are equivalent
 * @param value The value to compare
 * @param other The other value to compare
 * @returns Returns true if the values are equivalent, else false
 */
export function isEqual(value: unknown, other: unknown): boolean {
  if (value === other) {
    return true
  }

  if (value == null || other == null) {
    return value === other
  }

  if (typeof value !== typeof other) {
    return false
  }

  if (typeof value !== 'object') {
    return value === other
  }

  if (Array.isArray(value) !== Array.isArray(other)) {
    return false
  }

  if (Array.isArray(value)) {
    if (value.length !== (other as unknown[]).length) {
      return false
    }
    for (let i = 0; i < value.length; i++) {
      if (!isEqual(value[i], (other as unknown[])[i])) {
        return false
      }
    }
    return true
  }

  const valueKeys = Object.keys(value as Record<string, unknown>)
  const otherKeys = Object.keys(other as Record<string, unknown>)

  if (valueKeys.length !== otherKeys.length) {
    return false
  }

  for (const key of valueKeys) {
    if (
      !Object.prototype.hasOwnProperty.call(
        other as Record<string, unknown>,
        key
      ) ||
      !isEqual(
        (value as Record<string, unknown>)[key],
        (other as Record<string, unknown>)[key]
      )
    ) {
      return false
    }
  }

  return true
}
