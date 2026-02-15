import { AcCmColor, AcCmColorMethod, AcCmEventManager } from '@mlightcad/common'
import { AcGePointLike } from '@mlightcad/geometry-engine'
import { AcGiLineWeight } from '@mlightcad/graphic-interface'
import { AcDbDatabase } from 'database'

/**
 * Supported AutoCAD system variable data type name.
 */
export type AcDbSysVarTypeName =
  | 'string'
  | 'color'
  | 'number'
  | 'boolean'
  | 'point'
  | 'unknown'

/**
 * Supported AutoCAD system variable data type name.
 */
export type AcDbSysVarType =
  | string
  | number
  | boolean
  | AcGePointLike
  | AcCmColor

/**
 * Definition for a system variable in our registry.
 */
export interface AcDbSysVarDescriptor {
  /** System variable name, e.g., "CLAYER" */
  name: string

  /** Expected variable type */
  type: AcDbSysVarTypeName

  /** The flag to indicate whether it is one database-resident variable. */
  isDbVar: boolean

  /** Optional description (documentation) */
  description?: string

  /** Optional default value */
  defaultValue?: AcDbSysVarType
}

/**
 * Event arguments for system variable related events.
 */
export interface AcDbSysVarEventArgs {
  /** The system variable name */
  name: string
  /** The new value of system variable */
  newVal: AcDbSysVarType
  /** The old value of system variable */
  oldVal?: AcDbSysVarType
}

/**
 * Main manager responsible for:
 * - registry of known system variables
 * - caching values
 * - invoking backend getVar/setVar
 * - dispatching sysvar change events
 */
export class AcDbSysVarManager {
  private static _instance: AcDbSysVarManager | null = null

  /** Singleton accessor */
  public static instance(): AcDbSysVarManager {
    if (!this._instance) this._instance = new AcDbSysVarManager()
    return this._instance
  }

  /** Registered system variable metadata */
  private registry = new Map<string, AcDbSysVarDescriptor>()

  /** Cached current values for non-database-resident variables. */
  private cache = new Map<string, unknown>()

  /** System variable related events */
  public readonly events = {
    /**
     * Fired after a system variable is changed directly through the SETVAR command or
     * by entering the variable name at the command line.
     */
    sysVarChanged: new AcCmEventManager<AcDbSysVarEventArgs>()
  }

  private constructor() {
    this.registerVar({
      /**
       * The flag whether the background color is white
       * - false: black
       * - true: white
       */
      name: 'WHITEBKCOLOR',
      type: 'boolean',
      isDbVar: false,
      defaultValue: false
    })
    this.registerVar({
      name: 'CECOLOR',
      type: 'color',
      isDbVar: true,
      defaultValue: new AcCmColor(AcCmColorMethod.ByLayer)
    })
    this.registerVar({
      name: 'CELTSCALE',
      type: 'number',
      isDbVar: true,
      defaultValue: -1
    })
    this.registerVar({
      name: 'CELWEIGHT',
      type: 'number',
      isDbVar: true,
      defaultValue: AcGiLineWeight.ByLayer
    })
    this.registerVar({
      name: 'CLAYER',
      type: 'string',
      isDbVar: true,
      defaultValue: '0'
    })
    this.registerVar({
      name: 'PICKBOX',
      type: 'number',
      isDbVar: false,
      defaultValue: 0
    })
  }

  /**
   * Register one system variable metadata entry.
   */
  public registerVar(desc: AcDbSysVarDescriptor) {
    this.registry.set(desc.name.toUpperCase(), desc)
  }

  /**
   * Register many system variables.
   */
  public registerMany(vars: AcDbSysVarDescriptor[]) {
    vars.forEach(v => this.registerVar(v))
  }

  /**
   * Get system variable value.
   */
  public getVar(name: string, db: AcDbDatabase): AcDbSysVarType | undefined {
    name = name.toUpperCase()
    const descriptor = this.getDescriptor(name)
    if (descriptor) {
      if (descriptor.isDbVar) {
        return db[name.toLowerCase() as keyof AcDbDatabase] as AcDbSysVarType
      } else if (this.cache.has(name)) {
        return this.cache.get(name) as AcDbSysVarType
      }
    }

    return undefined
  }

  /**
   * Set system variable value.
   */
  public setVar(name: string, value: AcDbSysVarType, db: AcDbDatabase) {
    name = name.toUpperCase()
    const descriptor = this.getDescriptor(name)
    if (descriptor) {
      const oldVal = this.getVar(name, db)
      if (
        descriptor.type !== 'string' &&
        (typeof value === 'string' || value instanceof String)
      ) {
        if (descriptor.type === 'number') {
          const num = Number(value)
          if (Number.isNaN(num)) {
            throw new Error('Invalid number input!')
          }
          value = num
        } else if (descriptor.type === 'boolean') {
          value = this.parseBoolean(value as string)
        } else if (descriptor.type === 'color') {
          const tmp = AcCmColor.fromString(value as string)
          if (tmp == null) {
            throw new Error('Invalid color value!')
          }
          value = tmp
        }
      }
      if (descriptor.isDbVar) {
        ;(db as unknown as Record<string, unknown>)[name.toLowerCase()] = value
      } else {
        this.cache.set(name, value)
      }
      this.events.sysVarChanged.dispatch({ name, newVal: value, oldVal })
    } else {
      throw new Error(`System variable ${name} not found!`)
    }
  }

  /**
   * Get system variable metadata descriptor (if registered).
   */
  public getDescriptor(name: string): AcDbSysVarDescriptor | undefined {
    return this.registry.get(name.toUpperCase())
  }

  /**
   * Get all registered system variable descriptors.
   */
  public getAllDescriptors(): AcDbSysVarDescriptor[] {
    return [...this.registry.values()]
  }

  /**
   * Parse one string as one boolean value with case-insensitive by ignoring extra spaces
   * - "true" / "false"
   * - "t" / "f"
   * - "1" / "0"
   * - "yes" / "no"
   * - "y" / "n"
   * @param value - One string
   * @returns - The parsed boolean value
   */
  private parseBoolean(value: string | null | undefined) {
    if (value == null) return false

    const v = String(value).trim().toLowerCase()

    const trueValues = new Set(['true', 't', '1', 'yes', 'y'])
    const falseValues = new Set(['false', 'f', '0', 'no', 'n'])

    if (trueValues.has(v)) return true
    if (falseValues.has(v)) return false

    return false
  }
}
