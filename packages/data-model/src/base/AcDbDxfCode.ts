/**
 * Represents DXF group codes used to describe the type of a value
 * stored in an {@link AcDbResultBuffer}.
 *
 * This enum is intentionally extensible and does not attempt to
 * cover all DXF codes defined by AutoCAD.
 *
 * @remarks
 * DXF group codes define both the semantic meaning and storage
 * type of a value. The same value type may appear under different
 * codes depending on context.
 */
export enum AcDbDxfCode {
  /** Invalid or uninitialized DXF code */
  Invalid = 0,

  /** String value */
  Text = 1,

  /** Symbol or name value */
  Name = 2,

  /** 16-bit integer */
  Int16 = 70,

  /** 32-bit integer */
  Int32 = 90,

  /** 64-bit integer */
  Int64 = 160,

  /** Double-precision floating point value */
  Real = 40,

  /** 3D point value (x, y, z) */
  Point3d = 10,

  /** ObjectId reference */
  ObjectId = 330,

  /** Binary data chunk */
  BinaryChunk = 310
}
