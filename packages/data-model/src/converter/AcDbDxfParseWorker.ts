import DxfParser from '@mlightcad/dxf-json'

/**
 * Parses DXF data string into a structured object.
 *
 * This function uses the DxfParser to convert DXF data from a string
 * format into a parsed object that can be used by the AcDbDxfConverter.
 *
 * @param data - The DXF data as a string
 * @returns Parsed DXF object containing all the parsed data
 *
 * @example
 * ```typescript
 * const dxfString = '0\nSECTION\n2\nHEADER\n...';
 * const parsedDxf = parseDxf(dxfString);
 * console.log('Parsed DXF:', parsedDxf);
 * ```
 */
export function parseDxf(data: string) {
  const parser = new DxfParser()
  return parser.parseSync(data)
}
