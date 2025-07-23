import DxfParser from '@mlightcad/dxf-json'

export function parseDxf(data: string) {
  const parser = new DxfParser()
  return parser.parseSync(data)
}
