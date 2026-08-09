import { AcDbDatabase } from '@mlightcad/data-model'

import { AcDbLibreDwgConverter } from '../src/AcDbLibreDwgConverter'

class TestLibreDwgConverter extends AcDbLibreDwgConverter {
  processHeaderPublic(model: any, db: AcDbDatabase) {
    return this.processHeader(model, db)
  }
}

describe('AcDbLibreDwgConverter', () => {
  it('sets thumbnailImage from model thumbnailImage bytes', () => {
    const db = new AcDbDatabase()
    const converter = new TestLibreDwgConverter({ useWorker: false })
    const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47])

    converter.processHeaderPublic(
      {
        header: {},
        thumbnailImage: bytes
      },
      db
    )

    expect(db.thumbnailImage).toEqual(bytes)
  })
})
