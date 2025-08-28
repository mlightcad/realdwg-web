/**
 * Default line type used when no specific line type is specified.
 *
 * This constant represents the "Continuous" line type, which is the
 * standard solid line type used in AutoCAD drawings.
 */
export const DEFAULT_LINE_TYPE = 'Continuous'

/**
 * Special line type value that indicates the entity should use
 * the line type of its layer.
 *
 * When an entity has this line type, it will inherit the line type
 * from the layer it belongs to.
 */
export const ByLayer = 'ByLayer'

/**
 * Special line type value that indicates the entity should use
 * the line type of its block.
 *
 * When an entity has this line type, it will inherit the line type
 * from the block it belongs to.
 */
export const ByBlock = 'ByBlock'
