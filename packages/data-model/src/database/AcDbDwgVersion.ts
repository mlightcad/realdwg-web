export interface AcDbDwgVersionEntry {
  name: string
  value: number
}

const dwgVersions: AcDbDwgVersionEntry[] = [
  { name: 'AC1.2', value: 1 },
  { name: 'AC1.40', value: 2 },
  { name: 'AC1.50', value: 3 },
  { name: 'AC2.20', value: 4 },
  { name: 'AC2.10', value: 5 },
  { name: 'AC2.21', value: 6 },
  { name: 'AC2.22', value: 7 },
  { name: 'AC1001', value: 8 },
  { name: 'AC1002', value: 9 },
  { name: 'AC1003', value: 10 },
  { name: 'AC1004', value: 11 },
  { name: 'AC1005', value: 12 },
  { name: 'AC1006', value: 13 },
  { name: 'AC1007', value: 14 },
  { name: 'AC1008', value: 15 },
  { name: 'AC1009', value: 16 },
  { name: 'AC1010', value: 17 },
  { name: 'AC1011', value: 18 },
  { name: 'AC1012', value: 19 },
  { name: 'AC1013', value: 20 },
  { name: 'AC1014', value: 21 },
  { name: 'AC1500', value: 22 },
  { name: 'AC1015', value: 23 },
  { name: 'AC1800a', value: 24 },
  { name: 'AC1800', value: 25 },
  { name: 'AC2100a', value: 26 },
  { name: 'AC1021', value: 27 },
  { name: 'AC2400a', value: 28 },
  { name: 'AC1024', value: 29 },
  { name: 'AC1027', value: 31 },
  { name: 'AC3200a', value: 32 },
  { name: 'AC1032', value: 33 }
]

/**
 * Represents a DWG file format version.
 *
 * Instances can be constructed from either a known DWG version name
 * (e.g. 'AC1032') or its numeric value counterpart.
 */
export class AcDbDwgVersion {
  /**
   * DWG version name as defined in `AcDbDwgVersionEntry.name`.
   */
  name: string
  /**
   * Numeric DWG version value as defined in `AcDbDwgVersionEntry.value`.
   */
  value: number

  /**
   * Create a DWG version from a version name or numeric value.
   *
   * If a string is provided, it is treated as the version name and must
   * match one of the known entries. If a number is provided, it is treated
   * as the numeric version value.
   *
   * @param nameOrValue The DWG version name (e.g. 'AC1032') or the DWG version numeric value.
   * @throws Error if the provided name or value is not recognized.
   */
  constructor(nameOrValue: string | number) {
    if (typeof nameOrValue === 'string') {
      const entry = dwgVersions.find(v => v.name === nameOrValue)
      if (!entry) {
        throw new Error(`Unknown DWG version name: ${nameOrValue}`)
      }
      this.name = entry.name
      this.value = entry.value
      return
    }

    if (typeof nameOrValue === 'number') {
      const entry = dwgVersions.find(v => v.value === nameOrValue)
      if (!entry) {
        throw new Error(`Unknown DWG version value: ${nameOrValue}`)
      }
      this.name = entry.name
      this.value = entry.value
      return
    }

    throw new Error('Invalid constructor argument for AcDbDwgVersion')
  }
}
