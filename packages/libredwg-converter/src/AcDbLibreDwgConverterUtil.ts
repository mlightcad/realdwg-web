import { Dwg_File_Type,DwgDatabase, LibreDwg } from '@mlightcad/libredwg-web'
export async function parseDwg(data: string): Promise<DwgDatabase> {
  const libredwg = await LibreDwg.create()
  if (libredwg == null) {
    throw new Error('libredwg is not loaded!')
  }

  const dwgDataPtr = libredwg.dwg_read_data(data, Dwg_File_Type.DWG)
  if (dwgDataPtr == null) {
    throw new Error('Failed to read dwg data!')
  }
  const model = libredwg.convert(dwgDataPtr)
  libredwg.dwg_free(dwgDataPtr)

  return model
}
