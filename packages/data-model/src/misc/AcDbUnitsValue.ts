/**
 * Linear unit
 */
export enum AcDbUnitsValue {
  Undefined = 0,
  Inches = 1,
  Feet = 2,
  Miles = 3,
  Millimeters = 4,
  Centimeters = 5,
  Meters = 6,
  Kilometers = 7,
  Microinches = 8,
  Mils = 9,
  Yards = 10,
  Angstroms = 11,
  Nanometers = 12,
  Microns = 13,
  Decimeters = 14,
  Dekameters = 15,
  Hectometers = 16,
  Gigameters = 17,
  Astronomical = 18,
  LightYears = 19,
  Parsecs = 20,
  /**
   * Note: US Survey Feet is a historical survey unit that's about 2 parts per million larger than
   * the International Feet unit. This difference is significant only at scales used for mapping in
   * the U.S. The US Survey Feet setting is supported only for inserting or attaching drawings
   * starting with AutoCAD 2017-based products. Drawings opened in prior versions will treat the US
   * Survey Feet setting as Unitless.
   */
  USSurveyFeet = 21,
  USSurveyInch = 22,
  USSurveyYard = 23,
  USSurveyMile = 24,
  Max = USSurveyMile
}

/**
 * Return true if the specified units value is metric units.
 * @param units Input units to check
 * @returns Return true if the specified units value is metric units.
 */
export function isMetricUnits(units: AcDbUnitsValue) {
  return (
    units == AcDbUnitsValue.Millimeters ||
    units == AcDbUnitsValue.Centimeters ||
    units == AcDbUnitsValue.Meters ||
    units == AcDbUnitsValue.Kilometers ||
    units == AcDbUnitsValue.Nanometers ||
    units == AcDbUnitsValue.Microns ||
    units == AcDbUnitsValue.Decimeters ||
    units == AcDbUnitsValue.Dekameters ||
    units == AcDbUnitsValue.Hectometers ||
    units == AcDbUnitsValue.Gigameters
  )
}

/**
 * Return true if the specified units value is imperial units.
 * @param units Input units to check
 * @returns Return true if the specified units value is imperial units.
 */
export function isImperialUnits(units: AcDbUnitsValue) {
  return (
    units == AcDbUnitsValue.Inches ||
    units == AcDbUnitsValue.Feet ||
    units == AcDbUnitsValue.Miles ||
    units == AcDbUnitsValue.Microinches ||
    units == AcDbUnitsValue.Mils ||
    units == AcDbUnitsValue.Yards ||
    units == AcDbUnitsValue.USSurveyFeet
  )
}
