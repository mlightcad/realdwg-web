/**
 * Indexes one item in an associative array
 * (ObjectARX `AcDbItemLocator` / .NET `ItemLocator`).
 *
 * - Rectangular: item = column, row, level
 * - Polar: item = angular index, row, level
 * - Path: item = path index, row, level
 */
export class AcDbAssocArrayItemLocator {
  constructor(
    public itemIndex = 0,
    public rowIndex = 0,
    public levelIndex = 0
  ) {}

  equals(other: AcDbAssocArrayItemLocator): boolean {
    return (
      this.itemIndex === other.itemIndex &&
      this.rowIndex === other.rowIndex &&
      this.levelIndex === other.levelIndex
    )
  }

  clone(): AcDbAssocArrayItemLocator {
    return new AcDbAssocArrayItemLocator(
      this.itemIndex,
      this.rowIndex,
      this.levelIndex
    )
  }

  toKey(): string {
    return `${this.itemIndex},${this.rowIndex},${this.levelIndex}`
  }

  static fromKey(key: string): AcDbAssocArrayItemLocator {
    const [a, b, c] = key.split(',').map(n => Number(n) || 0)
    return new AcDbAssocArrayItemLocator(a, b, c)
  }
}
