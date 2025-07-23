import { AcDbDatabase } from './AcDbDatabase'
import { AcDbSymbolTable } from './AcDbSymbolTable'
import { AcDbTextStyleTableRecord } from './AcDbTextStyleTableRecord'

/**
 * This class is the symbol table for text style table records which represent text styles.
 */
export class AcDbTextStyleTable extends AcDbSymbolTable<AcDbTextStyleTableRecord> {
  constructor(db: AcDbDatabase) {
    super(db)
  }

  /**
   * Get all of fonts used in text style
   */
  get fonts() {
    const fonts = new Set<string>()
    const setFontName = (fontFileName: string) => {
      if (fontFileName) {
        const lastDotIndex = fontFileName.lastIndexOf('.')
        if (lastDotIndex >= 0) {
          const fontName = fontFileName.substring(0, lastDotIndex).toLowerCase()
          fonts.add(fontName)
        } else {
          fonts.add(fontFileName.toLowerCase())
        }
      }
    }

    const iterator = this.newIterator()
    for (const item of iterator) {
      setFontName(item.fileName)
      setFontName(item.bigFontFileName)
    }
    return Array.from(fonts)
  }
}
