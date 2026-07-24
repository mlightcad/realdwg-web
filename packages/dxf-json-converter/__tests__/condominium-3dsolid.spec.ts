import { existsSync, readFileSync } from 'node:fs'

import {
  AcDb3dSolid,
  AcDbDatabase,
  AcDbDatabaseConverterManager,
  AcDbFileType,
  acdbHostApplicationServices
} from '@mlightcad/data-model'

import { AcDbDxfConverter } from '../src/AcDbDxfConverter'

jest.mock('@mlightcad/data-model', () => {
  const actual = jest.requireActual('@mlightcad/data-model')
  const { AcDbDxfParser: Parser } = jest.requireActual('../src/AcDbDxfParser')
  return {
    ...actual,
    acdbCreateWorkerApi: () => ({
      execute: async (data: ArrayBuffer) => ({
        success: true,
        data: new Parser().parse(data)
      }),
      destroy: () => {}
    })
  }
})

const CONDOMINIUM_DXF =
  process.env.CONDOMINIUM_DXF ??
  'C:/Users/MI/Downloads/visualization_-_condominium_with_skylight.dxf'

const hasCondominiumFixture = existsSync(CONDOMINIUM_DXF)

describe('condominium 3DSOLID integration', () => {
  ;(hasCondominiumFixture ? it : it.skip)(
    'loads SAB wireframe geometry for model-space 3DSOLIDs',
    async () => {
      AcDbDatabaseConverterManager.instance.register(
        AcDbFileType.DXF,
        new AcDbDxfConverter({ useWorker: true })
      )

      const db = new AcDbDatabase()
      acdbHostApplicationServices().workingDatabase = db

      const bytes = new TextEncoder().encode(
        readFileSync(CONDOMINIUM_DXF, 'utf8')
      )
      await db.read(bytes.buffer, { readOnly: true, minimumChunkSize: 1 })

      const solids = [...db.tables.blockTable.modelSpace.newIterator()].filter(
        entity => entity instanceof AcDb3dSolid
      )

      const renderable = solids.filter(solid => solid.hasRenderableGeometry)

      expect(solids.length).toBe(52)
      expect(renderable.length).toBeGreaterThanOrEqual(40)
    },
    120_000
  )
})
