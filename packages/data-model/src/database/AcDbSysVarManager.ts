import {
  AcCmColor,
  AcCmColorMethod,
  AcCmEventManager,
  AcCmTransparency
} from '@mlightcad/common'
import { AcGePointLike } from '@mlightcad/geometry-engine'
import { AcGiLineWeight } from '@mlightcad/graphic-interface'

import { AcDbAngleUnits } from '../misc/AcDbAngleUnits'
import {
  ByLayer,
  DEFAULT_HATCH_PATTERN_METRIC,
  DEFAULT_MLEADER_STYLE,
  DEFAULT_MLINE_STYLE,
  DEFAULT_TEXT_STYLE
} from '../misc/AcDbConstants'
import { AcDbLinearUnits } from '../misc/AcDbLinearUnits'
import { AcDbUnitsValue } from '../misc/AcDbUnitsValue'
import type { AcDbDatabase } from './AcDbDatabase'
import { AcDbSystemVariables } from './AcDbSystemVariables'

/**
 * Supported AutoCAD system variable data type name.
 */
export type AcDbSysVarTypeName =
  | 'string'
  | 'color'
  | 'number'
  | 'boolean'
  | 'point'
  | 'transparency'
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
  | AcCmTransparency

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
  /** The database that triggered the event */
  database: AcDbDatabase
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

  /** Registers all known system variables in alphabetical order by name. */
  private constructor() {
    /**
     * Base angle for zero direction (**ANGBASE**), in radians.
     */
    this.registerVar({
      name: AcDbSystemVariables.ANGBASE,
      type: 'number',
      isDbVar: true,
      defaultValue: 0
    })
    /**
     * Direction of positive angles (**ANGDIR**).
     * - `0`: Counterclockwise
     * - `1`: Clockwise
     */
    this.registerVar({
      name: AcDbSystemVariables.ANGDIR,
      type: 'number',
      isDbVar: true,
      defaultValue: 0
    })
    /**
     * Sets the angular unit display format for angles (not the geometric angle itself).
     * Integer codes match AutoCAD and {@link AcDbAngleUnits}:
     * - `0`: Decimal degrees
     * - `1`: Degrees/minutes/seconds
     * - `2`: Gradians
     * - `3`: Radians
     * - `4`: Surveyor's units
     *
     * @see https://help.autodesk.com/view/ACD/2027/ENU/?caas=caas/documentation/ACD/2014/ENU/files/GUID-C7C0F6A5-7982-43DB-97F9-5B9B0044E9FA-htm.html
     */
    this.registerVar({
      name: AcDbSystemVariables.AUNITS,
      type: 'number',
      isDbVar: true,
      defaultValue: AcDbAngleUnits.DecimalDegrees
    })
    /**
     * Sets the display precision for angles (number of decimal places or equivalent), used together
     * with {@link AcDbDatabase.aunits | AUNITS}. Typical range in AutoCAD is **0–8**; initial value **0**.
     *
     * @see https://help.autodesk.com/view/ACD/2025/ENU/?guid=GUID-EE1ED20C-1096-4299-820F-83F1BC9B96F3
     */
    this.registerVar({
      name: AcDbSystemVariables.AUPREC,
      type: 'number',
      isDbVar: true,
      defaultValue: 0
    })
    this.registerVar({
      name: AcDbSystemVariables.CECOLOR,
      type: 'color',
      isDbVar: true,
      defaultValue: new AcCmColor(AcCmColorMethod.ByLayer)
    })
    this.registerVar({
      name: AcDbSystemVariables.CELTSCALE,
      type: 'number',
      isDbVar: true,
      defaultValue: -1
    })
    this.registerVar({
      name: AcDbSystemVariables.CELTYPE,
      type: 'string',
      isDbVar: true,
      defaultValue: ByLayer
    })
    this.registerVar({
      name: AcDbSystemVariables.CELWEIGHT,
      type: 'number',
      isDbVar: true,
      defaultValue: AcGiLineWeight.ByLayer
    })
    this.registerVar({
      name: AcDbSystemVariables.CETRANSPARENCY,
      type: 'transparency',
      isDbVar: true,
      defaultValue: new AcCmTransparency()
    })
    this.registerVar({
      name: AcDbSystemVariables.CLAYER,
      type: 'string',
      isDbVar: true,
      defaultValue: '0'
    })
    /**
     * Sets the name of the current multileader style.
     */
    this.registerVar({
      name: AcDbSystemVariables.CMLEADERSTYLE,
      type: 'string',
      isDbVar: true,
      defaultValue: DEFAULT_MLEADER_STYLE
    })
    /**
     * Controls the overall width of a multiline.
     */
    this.registerVar({
      name: AcDbSystemVariables.CMLSCALE,
      type: 'number',
      isDbVar: true,
      defaultValue: 1
    })
    /**
     * Sets the multiline style that governs the appearance of the multiline.
     */
    this.registerVar({
      name: AcDbSystemVariables.CMLSTYLE,
      type: 'string',
      isDbVar: true,
      defaultValue: DEFAULT_MLINE_STYLE
    })
    /**
     * Color theme of UI elements
     * - 0:	Dark theme
     * - 1:	Light theme
     */
    this.registerVar({
      name: AcDbSystemVariables.COLORTHEME,
      type: 'number',
      isDbVar: false,
      defaultValue: 0
    })
    /**
     * - 0: All Dynamic Input features, including dynamic prompts, off
     * - 1: Pointer input on
     * - 2: Dimensional input on
     * - 3: Both pointer input and dimensional input on
     */
    this.registerVar({
      name: AcDbSystemVariables.DYNMODE,
      type: 'number',
      isDbVar: false,
      defaultValue: 3
    })
    this.registerVar({
      name: AcDbSystemVariables.DYNPROMPT,
      type: 'boolean',
      isDbVar: false,
      defaultValue: true
    })
    /**
     * Suppresses the display of grips when the initial selection set includes
     * more than the specified number of objects. Valid range is **0–32767**;
     * `0` always displays grips. Saved in the registry (not in the drawing).
     *
     * @see https://help.autodesk.com/view/ACD/2022/ENU/?guid=GUID-705F3A42-4A2F-4B5C-A2A6-0CF8949B8ED5
     */
    this.registerVar({
      name: AcDbSystemVariables.GRIPOBJLIMIT,
      type: 'number',
      isDbVar: false,
      defaultValue: 100
    })
    /**
     * Sets the default angle, in radians, for new hatch patterns in this session.
     */
    this.registerVar({
      name: AcDbSystemVariables.HPANG,
      type: 'number',
      isDbVar: false,
      defaultValue: 0
    })
    /**
     * Controls whether newly created hatches and fills are associative.
     * - 0: Not associative
     * - 1: Associative
     */
    this.registerVar({
      name: AcDbSystemVariables.HPASSOC,
      type: 'number',
      isDbVar: false,
      defaultValue: 1
    })
    /**
     * Sets the default background color for new hatch patterns in the current drawing.
     * Use 'None' or '.' for no background color.
     */
    this.registerVar({
      name: AcDbSystemVariables.HPBACKGROUNDCOLOR,
      type: 'color',
      isDbVar: true,
      defaultValue: new AcCmColor(AcCmColorMethod.None)
    })
    /**
     * Sets the default color for new hatches in the current drawing.
     * Use '.' to use the current entity color.
     */
    this.registerVar({
      name: AcDbSystemVariables.HPCOLOR,
      type: 'color',
      isDbVar: true,
      defaultValue: new AcCmColor(AcCmColorMethod.ByLayer)
    })
    /**
     * Controls whether hatch patterns are doubled for user-defined patterns.
     * - 0: Off
     * - 1: On
     */
    this.registerVar({
      name: AcDbSystemVariables.HPDOUBLE,
      type: 'number',
      isDbVar: false,
      defaultValue: 0
    })
    /**
     * Controls how islands within new hatch boundaries are treated.
     * - 0: Normal
     * - 1: Outer
     * - 2: Ignore
     */
    this.registerVar({
      name: AcDbSystemVariables.HPISLANDDETECTION,
      type: 'number',
      isDbVar: false,
      defaultValue: 1
    })
    /**
     * Specifies a default layer for new hatches and fills in the current drawing.
     * Use '.' to use the current layer.
     */
    this.registerVar({
      name: AcDbSystemVariables.HPLAYER,
      type: 'string',
      isDbVar: true,
      defaultValue: '.'
    })
    /**
     * Sets the default hatch pattern name in this session. AutoCAD uses ANSI31
     * for imperial drawings and ANGLE for metric drawings; this database defaults
     * to metric units.
     */
    this.registerVar({
      name: AcDbSystemVariables.HPNAME,
      type: 'string',
      isDbVar: false,
      defaultValue: DEFAULT_HATCH_PATTERN_METRIC
    })
    /**
     * Sets the default scale factor for new hatch patterns in this session.
     */
    this.registerVar({
      name: AcDbSystemVariables.HPSCALE,
      type: 'number',
      isDbVar: false,
      defaultValue: 1
    })
    /**
     * Controls whether one hatch object or separate hatch objects are created
     * when operating on several closed boundaries.
     * - 0: Single hatch object
     * - 1: Separate hatch objects
     */
    this.registerVar({
      name: AcDbSystemVariables.HPSEPARATE,
      type: 'number',
      isDbVar: false,
      defaultValue: 0
    })
    /**
     * Sets the default transparency for new hatches and fills in the current drawing.
     * Use '.' to use the current transparency.
     */
    this.registerVar({
      name: AcDbSystemVariables.HPTRANSPARENCY,
      type: 'transparency',
      isDbVar: true,
      defaultValue: new AcCmTransparency()
    })
    /**
     * Specifies a drawing-units value for automatic scaling of blocks, images, or xrefs
     * inserted or attached into this drawing. Integer codes match AutoCAD (0 = unitless,
     * 1 = inches, 4 = millimeters, etc.); see {@link AcDbUnitsValue}.
     *
     * @see https://help.autodesk.com/view/ACD/2025/ENU/?guid=GUID-A58A87BB-482B-4042-A00A-EEF55A2B4FD8
     */
    this.registerVar({
      name: AcDbSystemVariables.INSUNITS,
      type: 'number',
      isDbVar: true,
      defaultValue: AcDbUnitsValue.Millimeters
    })
    /**
     * Sets the linear unit display format for coordinates and distances (not insertion scaling).
     * Integer codes match AutoCAD and {@link AcDbLinearUnits}:
     * - `1`: Scientific
     * - `2`: Decimal
     * - `3`: Engineering
     * - `4`: Architectural
     * - `5`: Fractional
     * - `6`: Windows desktop (processing units)
     *
     * @see https://help.autodesk.com/view/ACD/2025/ENU/?guid=GUID-D7C80D1F-B1C0-44A9-898E-B3100FF391CB
     */
    this.registerVar({
      name: AcDbSystemVariables.LUNITS,
      type: 'number',
      isDbVar: true,
      defaultValue: AcDbLinearUnits.Decimal
    })
    /**
     * Sets the display precision for linear distances (decimal places or equivalent), used together
     * with {@link AcDbDatabase.lunits | LUNITS}. Typical range in AutoCAD is **0–8**; common initial value **4**.
     *
     * @see https://help.autodesk.com/view/ACD/2027/ENU/?guid=GUID-5FFF39D6-EFC7-49F5-B56A-6023EB5C0DE7
     */
    this.registerVar({
      name: AcDbSystemVariables.LUPREC,
      type: 'number',
      isDbVar: true,
      defaultValue: 4
    })
    this.registerVar({
      name: AcDbSystemVariables.LWDISPLAY,
      type: 'boolean',
      isDbVar: true,
      defaultValue: false
    })
    /**
     * Legacy metric vs imperial flag (`0` English, `1` metric).
     */
    this.registerVar({
      name: AcDbSystemVariables.MEASUREMENT,
      type: 'number',
      isDbVar: true,
      defaultValue: 1
    })
    /**
     * Color used for measurement tool overlays (distance, area, arc).
     * Default: RGB(96, 165, 250)
     */
    this.registerVar({
      name: AcDbSystemVariables.MEASUREMENTCOLOR,
      type: 'color',
      isDbVar: false,
      defaultValue: (() => {
        const c = new AcCmColor(AcCmColorMethod.ByColor)
        c.setRGB(96, 165, 250)
        return c
      })()
    })
    /**
     * Background color of the model-space drawing area.
     * Default: RGB(0, 0, 0)
     */
    this.registerVar({
      name: AcDbSystemVariables.MODELBKCOLOR,
      type: 'color',
      isDbVar: false,
      defaultValue: (() => {
        const c = new AcCmColor(AcCmColorMethod.ByColor)
        c.setRGB(0, 0, 0)
        return c
      })()
    })
    /**
     * Running Object Snap (OSNAP) modes stored as a bitcode value.
     * Each snap type corresponds to a bit, and the values are added together.
     */
    this.registerVar({
      name: AcDbSystemVariables.OSMODE,
      type: 'number',
      isDbVar: true,
      defaultValue: 0
    })
    /**
     * Constrains cursor movement to the perpendicular (orthogonal locking).
     * - `0`: Turns off Ortho mode
     * - `1`: Turns on Ortho mode
     *
     * @see https://help.autodesk.com/view/ACD/2027/ENU/?caas=caas/documentation/ACD/2014/ENU/files/GUID-CF142B68-675B-452F-B3A8-7831DDB71BD0-htm.html
     */
    this.registerVar({
      name: AcDbSystemVariables.ORTHOMODE,
      type: 'number',
      isDbVar: true,
      defaultValue: 0
    })
    /**
     * Background color of the paper-space (layout) drawing area.
     * Default: RGB(255, 255, 255)
     */
    this.registerVar({
      name: AcDbSystemVariables.PAPERBKCOLOR,
      type: 'color',
      isDbVar: false,
      defaultValue: (() => {
        const c = new AcCmColor(AcCmColorMethod.ByColor)
        c.setRGB(255, 255, 255)
        return c
      })()
    })
    /**
     * Represents the half-size of the pickbox in pixels
     */
    this.registerVar({
      name: AcDbSystemVariables.PICKBOX,
      type: 'number',
      isDbVar: false,
      defaultValue: 10
    })
    /**
     * Stores additional angles for polar tracking and polar snap.
     * Up to 10 angles separated by semicolons (;). Unlike POLARANG, values are
     * absolute angles rather than increments. Only effective when POLARMODE bit 4 is on.
     *
     * @see https://help.autodesk.com/view/ACD/2027/ENU/?guid=GUID-73162BAB-C98D-4159-A653-E4C7D4CB38C3
     */
    this.registerVar({
      name: AcDbSystemVariables.POLARADDANG,
      type: 'string',
      isDbVar: false,
      defaultValue: ''
    })
    /**
     * Controls settings for polar and object snap tracking (bitcode sum):
     * - Bit 0: `0` = measure polar angles from current UCS; `1` = from selected objects
     * - Bit 2: `0` = track orthogonally only; `2` = use polar tracking in object snap tracking
     * - Bit 4: `0` = do not use additional polar angles; `4` = use POLARADDANG angles
     * - Bit 8: `0` = acquire tracking points automatically; `8` = press SHIFT to acquire
     *
     * @see https://help.autodesk.com/view/ACD/2027/ENU/?guid=GUID-D91628CC-9975-4DBF-8D02-10B23A6F3ED5
     */
    this.registerVar({
      name: AcDbSystemVariables.POLARMODE,
      type: 'number',
      isDbVar: false,
      defaultValue: 0
    })
    /**
     * Sets the polar angle increment for polar tracking alignment paths, in degrees.
     * Common values: 90, 45, 30, 22.5, 18, 15, 10, and 5.
     *
     * @see https://help.autodesk.com/view/ACD/2027/ENU/?guid=GUID-0CF67F9E-F953-43D6-9227-0D56E0E693ED
     */
    this.registerVar({
      name: AcDbSystemVariables.POLARANG,
      type: 'number',
      isDbVar: false,
      defaultValue: 90
    })
    /**
     * Controls whether Default, Edit, and Command mode shortcut menus are available in the drawing area.
     * - 0: Disables all Default, Edit, and Command mode shortcut menus.
     * - 1: Enables Default mode shortcut menus.
     * - 2: Enables Edit mode shortcut menus.
     * - 4: Enables Command mode shortcut menus whenever a command is active.
     * - 8: Enables Command mode shortcut menus only when command options are currently available at the Command prompt.
     * - 16: Enables the display of a shortcut menu when the right button on the pointing device is held down long enough
     */
    this.registerVar({
      name: AcDbSystemVariables.SHORTCUTMENU,
      type: 'number',
      isDbVar: false,
      defaultValue: 0
    })
    this.registerVar({
      name: AcDbSystemVariables.TEXTSTYLE,
      type: 'string',
      isDbVar: true,
      defaultValue: DEFAULT_TEXT_STYLE
    })
    /**
     * Feet-inch / fractional delimiter style used with **LUNITS** (`0` report, `1` input).
     */
    this.registerVar({
      name: AcDbSystemVariables.UNITMODE,
      type: 'number',
      isDbVar: true,
      defaultValue: 0
    })
  }

  /**
   * Register one system variable metadata entry.
   */
  public registerVar(desc: AcDbSysVarDescriptor) {
    const name = this.normalizeName(desc.name)
    this.registry.set(name, {
      ...desc,
      name
    })
    if (!desc.isDbVar) {
      this.cache.set(name, desc.defaultValue)
    }
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
    name = this.normalizeName(name)
    const descriptor = this.getDescriptor(name)
    if (!descriptor) {
      throw new Error(`System variable ${name} not found!`)
    }

    if (descriptor.isDbVar) {
      return db[name.toLowerCase() as keyof AcDbDatabase] as AcDbSysVarType
    } else if (this.cache.has(name)) {
      return this.cache.get(name) as AcDbSysVarType
    }

    return undefined
  }

  /**
   * Get system variable default value.
   */
  public getDefaultValue(name: string): AcDbSysVarType | undefined {
    name = this.normalizeName(name)
    const descriptor = this.getDescriptor(name)
    if (!descriptor) {
      throw new Error(`System variable ${name} not found!`)
    }

    return descriptor.defaultValue
  }

  /**
   * Set system variable value.
   */
  public setVar(name: string, value: AcDbSysVarType, db: AcDbDatabase) {
    name = this.normalizeName(name)
    const descriptor = this.getDescriptor(name)
    if (descriptor) {
      const oldVal = this.getVar(name, db)
      if (descriptor.type === 'transparency') {
        const tmp = this.parseTransparency(value)
        if (tmp == null || tmp.isInvalid) {
          throw new Error('Invalid transparency value!')
        }
        value = tmp
      } else if (
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
          const tmp = this.parseColorSysVar(name, value as string, db)
          if (tmp == null) {
            throw new Error('Invalid color value!')
          }
          value = tmp
        }
      }
      if (name === AcDbSystemVariables.GRIPOBJLIMIT.toLowerCase()) {
        const intVal = Math.trunc(value as number)
        if (!Number.isFinite(intVal) || intVal < 0 || intVal > 32767) {
          throw new Error('Invalid GRIPOBJLIMIT value! Valid range is 0 to 32767.')
        }
        value = intVal
      }
      if (descriptor.isDbVar) {
        ;(db as unknown as Record<string, unknown>)[name.toLowerCase()] = value
      } else {
        this.cache.set(name, value)
        if (this.hasValueChanged(oldVal, value)) {
          this.events.sysVarChanged.dispatch({
            database: db,
            name,
            newVal: value,
            oldVal
          })
        }
      }
    } else {
      throw new Error(`System variable ${name} not found!`)
    }
  }

  /**
   * Get system variable metadata descriptor (if registered).
   */
  public getDescriptor(name: string): AcDbSysVarDescriptor | undefined {
    return this.registry.get(this.normalizeName(name))
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

  private parseColorSysVar(name: string, value: string, db: AcDbDatabase) {
    const normalized = value.trim().toLowerCase()
    if (
      name === AcDbSystemVariables.HPCOLOR.toLowerCase() &&
      (normalized === '.' || normalized === 'use current')
    ) {
      return db.cecolor.clone()
    }

    if (
      name === AcDbSystemVariables.HPBACKGROUNDCOLOR.toLowerCase() &&
      (normalized === '' || normalized === '.' || normalized === 'none')
    ) {
      return new AcCmColor(AcCmColorMethod.None)
    }

    return AcCmColor.fromString(value)
  }

  private parseTransparency(value: AcDbSysVarType) {
    if (value instanceof AcCmTransparency) {
      return value
    }
    if (typeof value === 'number') {
      return AcCmTransparency.deserialize(value)
    }
    if (typeof value !== 'string' && !(value instanceof String)) {
      return undefined
    }
    return AcCmTransparency.fromString(String(value))
  }

  /**
   * Check if sysvar value changed.
   */
  private hasValueChanged(
    oldValue: AcDbSysVarType | undefined,
    newValue: AcDbSysVarType | undefined
  ) {
    if (oldValue instanceof AcCmColor && newValue instanceof AcCmColor) {
      return !oldValue.equals(newValue)
    }

    if (
      oldValue instanceof AcCmTransparency &&
      newValue instanceof AcCmTransparency
    ) {
      return !oldValue.equals(newValue)
    }

    return !Object.is(oldValue, newValue)
  }

  /**
   * Normalize system variable name for internal storage and lookup.
   */
  private normalizeName(name: string): string {
    return name.toLowerCase()
  }
}
