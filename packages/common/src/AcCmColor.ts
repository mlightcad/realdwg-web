/**
 * @fileoverview This module provides color handling functionality for AutoCAD files,
 * including color representation, color name mapping, and color index conversion.
 * 
 * The module supports various color formats including RGB values, named colors,
 * AutoCAD color indices, and special values like "ByLayer" and "ByBlock".
 * 
 * @module AcCmColor
 * @version 1.0.0
 */

/**
 * Mapping of CSS color names to their corresponding RGB values.
 * These are standard web color names that can be used for color representation.
 * 
 * @internal
 */
const _colorKeywords: Record<string, number> = {
  aliceblue: 0xf0f8ff,
  antiquewhite: 0xfaebd7,
  aqua: 0x00ffff,
  aquamarine: 0x7fffd4,
  azure: 0xf0ffff,
  beige: 0xf5f5dc,
  bisque: 0xffe4c4,
  black: 0x000000,
  blanchedalmond: 0xffebcd,
  blue: 0x0000ff,
  blueviolet: 0x8a2be2,
  brown: 0xa52a2a,
  burlywood: 0xdeb887,
  cadetblue: 0x5f9ea0,
  chartreuse: 0x7fff00,
  chocolate: 0xd2691e,
  coral: 0xff7f50,
  cornflowerblue: 0x6495ed,
  cornsilk: 0xfff8dc,
  crimson: 0xdc143c,
  cyan: 0x00ffff,
  darkblue: 0x00008b,
  darkcyan: 0x008b8b,
  darkgoldenrod: 0xb8860b,
  darkgray: 0xa9a9a9,
  darkgreen: 0x006400,
  darkkhaki: 0xbdb76b,
  darkmagenta: 0x8b008b,
  darkolivegreen: 0x556b2f,
  darkorange: 0xff8c00,
  darkorchid: 0x9932cc,
  darkred: 0x8b0000,
  darksalmon: 0xe9967a,
  darkseagreen: 0x8fbc8f,
  darkslateblue: 0x483d8b,
  darkslategray: 0x2f4f4f,
  darkturquoise: 0x00ced1,
  darkviolet: 0x9400d3,
  deeppink: 0xff1493,
  deepskyblue: 0x00bfff,
  dimgrey: 0x696969,
  dodgerblue: 0x1e90ff,
  firebrick: 0xb22222,
  floralwhite: 0xfffaf0,
  forestgreen: 0x228b22,
  fuchsia: 0xff00ff,
  gainsboro: 0xdcdcdc,
  ghostwhite: 0xf8f8ff,
  gold: 0xffd700,
  goldenrod: 0xdaa520,
  gray: 0x808080,
  green: 0x008000,
  greenyellow: 0xadff2f,
  grey: 0x808080,
  honeydew: 0xf0fff0,
  hotpink: 0xff69b4,
  indianred: 0xcd5c5c,
  indigo: 0x4b0082,
  ivory: 0xfffff0,
  khaki: 0xf0e68c,
  lavender: 0xe6e6fa,
  lavenderblush: 0xfff0f5,
  lawngreen: 0x7cfc00,
  lemonchiffon: 0xfffacd,
  lightblue: 0xadd8e6,
  lightcoral: 0xf08080,
  lightcyan: 0xe0ffff,
  lightgoldenrodyellow: 0xfafad2,
  lightgray: 0xd3d3d3,
  lightgreen: 0x90ee90,
  lightgrey: 0xd3d3d3,
  lightpink: 0xffb6c1,
  lightsalmon: 0xffa07a,
  lightseagreen: 0x20b2aa,
  lightskyblue: 0x87cefa,
  lightslategray: 0x778899,
  lightslategrey: 0x778899,
  lightsteelblue: 0xb0c4de,
  lightyellow: 0xffffe0,
  lime: 0x00ff00,
  limegreen: 0x32cd32,
  linen: 0xfaf0e6,
  magenta: 0xff00ff,
  maroon: 0x800000,
  mediumaquamarine: 0x66cdaa,
  mediumblue: 0x0000cd,
  mediumorchid: 0xba55d3,
  mediumpurple: 0x9370db,
  mediumseagreen: 0x3cb371,
  mediumslateblue: 0x7b68ee,
  mediumspringgreen: 0x00fa9a,
  mediumturquoise: 0x48d1cc,
  mediumvioletred: 0xc71585,
  midnightblue: 0x191970,
  mintcream: 0xf5fffa,
  mistyrose: 0xffe4e1,
  moccasin: 0xffe4b5,
  navajowhite: 0xffdead,
  navy: 0x000080,
  oldlace: 0xfdf5e6,
  olive: 0x808000,
  olivedrab: 0x6b8e23,
  orange: 0xffa500,
  orangered: 0xff4500,
  orchid: 0xda70d6,
  palegoldenrod: 0xeee8aa,
  palegreen: 0x98fb98,
  paleturquoise: 0xafeeee,
  palevioletred: 0xdb7093,
  papayawhip: 0xffefd5,
  peachpuff: 0xffdab9,
  peru: 0xcd853f,
  pink: 0xffc0cb,
  plum: 0xdda0dd,
  powderblue: 0xb0e0e6,
  purple: 0x800080,
  rebeccapurple: 0x663399,
  red: 0xff0000,
  rosybrown: 0xbc8f8f,
  royalblue: 0x4169e1,
  saddlebrown: 0x8b4513,
  salmon: 0xfa8072,
  sandybrown: 0xf4a460,
  seagreen: 0x2e8b57,
  seashell: 0xfff5ee,
  sienna: 0xa0522d,
  silver: 0xc0c0c0,
  skyblue: 0x87ceeb,
  slateblue: 0x6a5acd,
  slategrey: 0x708090,
  snow: 0xfffafa,
  springgreen: 0x00ff7f,
  steelblue: 0x4682b4,
  tan: 0xd2b48c,
  teal: 0x008080,
  thistle: 0xd8bfd8,
  tomato: 0xff6347,
  turquoise: 0x40e0d0,
  violet: 0xee82ee,
  wheat: 0xf5deb3,
  white: 0xffffff,
  whitesmoke: 0xf5f5f5,
  yellow: 0xffff00,
  yellowgreen: 0x9acd32
}

/**
 * AutoCAD color index array mapping index values (1-255) to RGB color values.
 * Each value corresponds to a color. Index 1 is red, that is 16711680 or 0xFF0000.
 * Index 0 and 256, while included in this array, are actually reserved for inheritance
 * values in AutoCAD so they should not be used for index color lookups:
 * - Index 0: "ByBlock" - entity uses color of the block reference
 * - Index 256: "ByLayer" - entity uses color specified in the layer
 * 
 * @internal
 */
const AUTO_CAD_COLOR_INDEX = [
  0, 16711680, 16776960, 65280, 65535, 255, 16711935, 16777215, 8421504,
  12632256, 16711680, 16744319, 13369344, 13395558, 10027008, 10046540, 8323072,
  8339263, 4980736, 4990502, 16727808, 16752511, 13382400, 13401958, 10036736,
  10051404, 8331008, 8343359, 4985600, 4992806, 16744192, 16760703, 13395456,
  13408614, 10046464, 10056268, 8339200, 8347455, 4990464, 4995366, 16760576,
  16768895, 13408512, 13415014, 10056192, 10061132, 8347392, 8351551, 4995328,
  4997670, 16776960, 16777087, 13421568, 13421670, 10000384, 10000460, 8355584,
  8355647, 5000192, 5000230, 12582656, 14679935, 10079232, 11717734, 7510016,
  8755276, 6258432, 7307071, 3755008, 4344870, 8388352, 12582783, 6736896,
  10079334, 5019648, 7510092, 4161280, 6258495, 2509824, 3755046, 4194048,
  10485631, 3394560, 8375398, 2529280, 6264908, 2064128, 5209919, 1264640,
  3099686, 65280, 8388479, 52224, 6736998, 38912, 5019724, 32512, 4161343,
  19456, 2509862, 65343, 8388511, 52275, 6737023, 38950, 5019743, 32543,
  4161359, 19475, 2509871, 65407, 8388543, 52326, 6737049, 38988, 5019762,
  32575, 4161375, 19494, 2509881, 65471, 8388575, 52377, 6737074, 39026,
  5019781, 32607, 4161391, 19513, 2509890, 65535, 8388607, 52428, 6737100,
  39064, 5019800, 32639, 4161407, 19532, 2509900, 49151, 8380415, 39372,
  6730444, 29336, 5014936, 24447, 4157311, 14668, 2507340, 32767, 8372223,
  26316, 6724044, 19608, 5010072, 16255, 4153215, 9804, 2505036, 16383, 8364031,
  13260, 6717388, 9880, 5005208, 8063, 4149119, 4940, 2502476, 255, 8355839,
  204, 6710988, 152, 5000344, 127, 4145023, 76, 2500172, 4129023, 10452991,
  3342540, 8349388, 2490520, 6245528, 2031743, 5193599, 1245260, 3089996,
  8323327, 12550143, 6684876, 10053324, 4980888, 7490712, 4128895, 6242175,
  2490444, 3745356, 12517631, 14647295, 10027212, 11691724, 7471256, 8735896,
  6226047, 7290751, 3735628, 4335180, 16711935, 16744447, 13369548, 13395660,
  9961624, 9981080, 8323199, 8339327, 4980812, 4990540, 16711871, 16744415,
  13369497, 13395634, 9961586, 9981061, 8323167, 8339311, 4980793, 4990530,
  16711807, 16744383, 13369446, 13395609, 9961548, 9981042, 8323135, 8339295,
  4980774, 4990521, 16711743, 16744351, 13369395, 13395583, 9961510, 9981023,
  8323103, 8339279, 4980755, 4990511, 3355443, 5987163, 8684676, 11382189,
  14079702, 16777215, 0
]

/**
 * Clamps a value between a minimum and maximum value.
 * 
 * @param {number} value - The value to clamp.
 * @param {number} min - The minimum value.
 * @param {number} max - The maximum value.
 * @returns {number} The clamped value.
 * @internal
 */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

/**
 * Represents a color in AutoCAD, supporting various color formats.
 * 
 * @class AcCmColor
 * @version 1.0.0
 */
export class AcCmColor {
  private _colorIndex: number | null
  private _color: number | null
  private _colorName: string | null
  static NAMES = _colorKeywords

  /**
   * Constructs a new AcCmColor instance.
   * Initializes the color to "ByLayer" (index 256) and null RGB values.
   */
  constructor() {
    this._colorIndex = 256
    this._color = null
    this._colorName = null
  }

  /**
   * Gets the current color value.
   * 
   * @returns {number | null} The color value (RGB or index).
   */
  get color() {
    return this._color
  }

  /**
   * Sets the color value.
   * 
   * @param {number | null} value - The color value to set (RGB or index).
   */
  set color(value: number | null) {
    if (value == null) {
      this._color = null
    } else {
      this._color = Math.round(clamp(value, 0, 256 * 256 * 256 - 1))
      this._colorIndex = this.getColorIndexByValue(this._color)
      this._colorName = this.getColorNameByValue(this._color)
    }
  }

  /**
   * Gets the hexadecimal representation of the current color.
   * 
   * @returns {string} The hexadecimal color string (e.g., "0xFFFFFF").
   */
  get hexColor() {
    // Ensure the number is a valid RGB value
    if (this._color && this._color > 0 && this._color <= 0xffffff) {
      let hexString = this._color.toString(16).toUpperCase()
      // Pad the string with leading zeros if necessary
      while (hexString.length < 6) {
        hexString = '0' + hexString
      }
      return `0x${hexString}`
    }
    return ''
  }

  /**
   * Gets the CSS RGB color string representation.
   * 
   * @returns {string} The CSS RGB color string (e.g., "rgb(255,255,255)").
   */
  get cssColor() {
    return `rgb(${this.red},${this.green},${this.blue})`
  }

  /**
   * Gets the red component of the current color.
   * 
   * @returns {number | null} The red component (0-255).
   */
  get red() {
    return this.color ? (this.color >> 16) & 255 : null
  }

  /**
   * Gets the green component of the current color.
   * 
   * @returns {number | null} The green component (0-255).
   */
  get green() {
    return this.color ? (this.color >> 8) & 255 : null
  }

  /**
   * Gets the blue component of the current color.
   * 
   * @returns {number | null} The blue component (0-255).
   */
  get blue() {
    return this.color ? this.color & 255 : null
  }

  /**
   * Gets the AutoCAD color index value. The index value will be in the range 0 to 256.
   * 0 and 256 are special values.
   * 
   * @returns {number | null} The color index.
   */
  get colorIndex() {
    return this._colorIndex
  }
  /**
   * Sets the AutoCAD color index value. If value less than 0 is set, 0 will be used. If value greater than
   * 256 is set, 256 will be used.
   * - 0 indicates that the entity uses the color of the BlockReference that's displaying it. If the entity
   * is not displayed through a block reference (for example, it is directly owned by the model space
   * block table record) and its color is 0, then it will display as though its color were 7.
   * - 256 indicates that the entity uses the color specified in the layer table record it references.
   * 
   * @param {number | null} value - The color index to set (0-256).
   */
  set colorIndex(value: number | null) {
    if (value == null) {
      this._colorIndex = null
    } else {
      this._colorIndex = clamp(value, 0, 256)
      this._color = AUTO_CAD_COLOR_INDEX[value]
      this._colorName = this.getColorNameByValue(this._color)
    }
  }

  /**
   * Gets the name of the current color.
   * 
   * @returns {string | null} The color name.
   */
  get colorName() {
    return this._colorName
  }
  /**
   * Sets the color by name.
   * 
   * @param {string | null} value - The color name to set.
   */
  set colorName(value: string | null) {
    if (value) {
      const color = _colorKeywords[value.toLowerCase()]
      if (color !== undefined) {
        // red
        this._colorName = value
        this._color = color
        this._colorIndex = this.getColorIndexByValue(this._color)
      } else {
        // unknown color
        console.warn('Unknown color: ' + value)
      }
    } else {
      this._colorName = null
    }
  }

  /**
   * Checks if the color has a name.
   * 
   * @returns {boolean} True if the color has no name, false otherwise.
   */
  get hasColorName() {
    return this._colorName == null
  }

  /**
   * Checks if the color has an index.
   * 
   * @returns {boolean} True if the color has no index, false otherwise.
   */
  get hasColorIndex() {
    return this._colorIndex == null
  }

  /**
   * Checks if the color is set to "ByLayer".
   * 
   * @returns {boolean} True if the color is "ByLayer", false otherwise.
   */
  get isByLayer() {
    return this.colorIndex == 256
  }
  /**
   * Sets the color to "ByLayer".
   * 
   * @returns {AcCmColor} The current instance.
   */
  setByLayer() {
    this.colorIndex = 256
    return this
  }

  /**
   * Checks if the color is set to "ByBlock".
   * 
   * @returns {boolean} True if the color is "ByBlock", false otherwise.
   */
  get isByBlock() {
    return this.colorIndex == 0
  }
  /**
   * Sets the color to "ByBlock".
   * 
   * @returns {AcCmColor} The current instance.
   */
  setByBlock() {
    this.colorIndex = 0
    return this
  }

  /**
   * Sets the color using a scalar value (RGB).
   * 
   * @param {number} scalar - The scalar value (0-255).
   * @returns {AcCmColor} The current instance.
   */
  setScalar(scalar: number) {
    this.setRGB(scalar, scalar, scalar)
    return this
  }

  /**
   * Sets the color using RGB values.
   * 
   * @param {number} r - The red component (0-255).
   * @param {number} g - The green component (0-255).
   * @param {number} b - The blue component (0-255).
   * @returns {AcCmColor} The current instance.
   */
  setRGB(r: number, g: number, b: number) {
    const red = Math.round(clamp(r, 0, 255))
    const green = Math.round(clamp(g, 0, 255))
    const blue = Math.round(clamp(b, 0, 255))
    this.color = (red << 16) + (green << 8) + blue
    return this
  }

  /**
   * Sets the color by name.
   * 
   * @param {string} style - The color name to set.
   * @returns {AcCmColor} The current instance.
   */
  setColorName(style: string) {
    const color = _colorKeywords[style.toLowerCase()]
    if (color !== undefined) {
      // red
      this.color = color
    } else {
      // unknown color
      console.warn('Unknown color ' + style)
    }
    return this
  }

  /**
   * Clones the current AcCmColor instance.
   * 
   * @returns {AcCmColor} A new AcCmColor instance with the same color and index.
   */
  clone() {
    const clonedColor = new AcCmColor()
    clonedColor.colorIndex = this.colorIndex
    clonedColor.color = this.color
    clonedColor._colorName = this._colorName
    return this
  }

  /**
   * Copies the color from another AcCmColor instance.
   * 
   * @param {AcCmColor} color - The color to copy from.
   * @returns {AcCmColor} The current instance.
   */
  copy(color: AcCmColor) {
    this.colorIndex = color.colorIndex
    this.color = color.color
    this._colorName = color._colorName
    return this
  }

  /**
   * Checks if two AcCmColor instances are equal.
   * 
   * @param {AcCmColor} c - The color to compare with.
   * @returns {boolean} True if the colors and their indices are the same.
   */
  equals(c: AcCmColor) {
    return (
      c.color == this.color &&
      c.colorIndex == this.colorIndex &&
      c._colorName == this._colorName
    )
  }

  /**
   * Returns a string representation of the color.
   * 
   * @returns {string} The color name or hexadecimal string.
   */
  toString() {
    if (this.isByLayer) {
      return 'ByLayer'
    } else if (this.isByBlock) {
      return 'ByBlock'
    } else if (this.colorName) {
      return this.colorName
    } else {
      return this.hexColor
    }
  }

  /**
   * Finds the color name associated with a given RGB value.
   * 
   * @private
   * @param {number} target - The RGB value to find a name for.
   * @returns {string | null} The color name if found, null otherwise.
   */
  private getColorNameByValue(target: number) {
    for (const [key, value] of Object.entries(_colorKeywords)) {
      if (value === target) {
        return key
      }
    }
    return null
  }

  /**
   * Finds the AutoCAD color index associated with a given RGB value.
   * 
   * @private
   * @param {number} target - The RGB value to find an index for.
   * @returns {number | null} The color index if found, null otherwise.
   */
  private getColorIndexByValue(target: number) {
    const length = AUTO_CAD_COLOR_INDEX.length - 1
    for (let index = 1; index < length; ++index) {
      if (AUTO_CAD_COLOR_INDEX[index] === target) {
        return index
      }
    }
    return null
  }
}
