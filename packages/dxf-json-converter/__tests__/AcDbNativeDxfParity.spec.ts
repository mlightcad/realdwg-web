import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import {
  AcDbArc,
  AcDbAttribute,
  AcDbBlockReference,
  AcDbCircle,
  AcDbDatabase,
  AcDbDatabaseConverterManager,
  AcDbEllipse,
  AcDbEntity,
  AcDbFileType,
  AcDbLine,
  AcDbNativeDxfConverter,
  AcDbPoint,
  AcDbPolyline,
  AcDbRay,
  AcDbText,
  AcDbXline,
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

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength
  ) as ArrayBuffer
}

function encodeUtf8(text: string) {
  return toArrayBuffer(new TextEncoder().encode(text))
}

function setWorkingDatabase(db: AcDbDatabase) {
  acdbHostApplicationServices().workingDatabase = db
  return db
}

async function readWithLegacy(dxf: string) {
  AcDbDatabaseConverterManager.instance.register(
    AcDbFileType.DXF,
    new AcDbDxfConverter({
      useWorker: true,
      parserWorkerUrl: '/assets/dxf-parser-worker.js'
    })
  )
  const db = setWorkingDatabase(new AcDbDatabase())
  await db.read(encodeUtf8(dxf), { readOnly: true, minimumChunkSize: 1 })
  return db
}

async function readWithNative(dxf: string) {
  AcDbDatabaseConverterManager.instance.register(
    AcDbFileType.DXF,
    new AcDbNativeDxfConverter({ useWorker: false })
  )
  const db = setWorkingDatabase(new AcDbDatabase())
  await db.read(encodeUtf8(dxf), { readOnly: true, minimumChunkSize: 1 })
  return db
}

function round(n: number, digits = 6): number {
  if (!Number.isFinite(n)) return 0
  const p = 10 ** digits
  return Math.round(n * p) / p
}

function pointSnapshot(p: { x: number; y: number; z?: number }) {
  return {
    x: round(p.x),
    y: round(p.y),
    z: round(p.z ?? 0)
  }
}

function entityTypeName(entity: AcDbEntity): string {
  return (
    (entity.constructor as { typeName?: string }).typeName ||
    entity.dxfTypeName ||
    entity.constructor.name
  )
}

function entitySample(entity: AcDbEntity): Record<string, unknown> {
  // Omit objectId: handle assignment can differ when BLOCK_RECORD is absent
  // from TABLES (both converters still produce equivalent geometry/content).
  const base: Record<string, unknown> = {
    type: entityTypeName(entity),
    layer: entity.layer,
    visibility: entity.visibility
  }

  if (entity instanceof AcDbLine) {
    return {
      ...base,
      start: pointSnapshot(entity.startPoint),
      end: pointSnapshot(entity.endPoint)
    }
  }
  if (entity instanceof AcDbCircle) {
    return {
      ...base,
      center: pointSnapshot(entity.center),
      radius: round(entity.radius)
    }
  }
  if (entity instanceof AcDbArc) {
    return {
      ...base,
      center: pointSnapshot(entity.center),
      radius: round(entity.radius),
      startAngle: round(entity.startAngle),
      endAngle: round(entity.endAngle)
    }
  }
  if (entity instanceof AcDbPoint) {
    return { ...base, position: pointSnapshot(entity.position) }
  }
  if (entity instanceof AcDbRay || entity instanceof AcDbXline) {
    return {
      ...base,
      basePoint: pointSnapshot(entity.basePoint),
      unitDir: pointSnapshot(entity.unitDir)
    }
  }
  if (entity instanceof AcDbEllipse) {
    return {
      ...base,
      center: pointSnapshot(entity.center),
      majorAxis: pointSnapshot(entity.majorAxis),
      majorAxisRadius: round(entity.majorAxisRadius),
      minorAxisRadius: round(entity.minorAxisRadius)
    }
  }
  if (entity instanceof AcDbPolyline) {
    return {
      ...base,
      closed: entity.closed,
      elevation: round(entity.elevation),
      vertexCount: entity.numberOfVertices,
      vertices: Array.from({ length: Math.min(entity.numberOfVertices, 8) }, (_, i) =>
        pointSnapshot(entity.getPoint2dAt(i))
      )
    }
  }
  if (entity instanceof AcDbText) {
    return {
      ...base,
      text: entity.textString,
      height: round(entity.height),
      position: pointSnapshot(entity.position),
      rotation: round(entity.rotation)
    }
  }
  if (entity instanceof AcDbBlockReference) {
    return {
      ...base,
      blockName: entity.blockName,
      position: pointSnapshot(entity.position),
      rotation: round(entity.rotation),
      scale: pointSnapshot(entity.scaleFactors),
      attribCount: [...entity.attributeIterator()].length
    }
  }
  if (entity instanceof AcDbAttribute) {
    return {
      ...base,
      tag: entity.tag,
      text: entity.textString
    }
  }
  return base
}

function countByType(entities: AcDbEntity[]) {
  const counts: Record<string, number> = {}
  for (const e of entities) {
    const t = entityTypeName(e)
    counts[t] = (counts[t] ?? 0) + 1
  }
  return Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)))
}

function databaseParitySnapshot(db: AcDbDatabase) {
  const layers = [...db.tables.layerTable.newIterator(true)]
    .map(layer => ({
      name: layer.name,
      colorIndex: layer.color.colorIndex ?? null,
      linetype: layer.linetype,
      isOff: layer.isOff,
      isPlottable: layer.isPlottable
    }))
    .sort((a, b) => a.name.localeCompare(b.name))

  const linetypes = [...db.tables.linetypeTable.newIterator(true)]
    .map(r => r.name)
    .sort()

  const textStyles = [...db.tables.textStyleTable.newIterator(true)]
    .map(r => r.name)
    .sort()

  const blocks = [...db.tables.blockTable.newIterator(true)]
    .map(block => {
      const entities = [...block.newIterator()]
      return {
        name: block.name,
        origin: pointSnapshot(block.origin),
        entityCount: entities.length,
        byType: countByType(entities),
        samples: entities.slice(0, 12).map(entitySample)
      }
    })
    .sort((a, b) => a.name.localeCompare(b.name))

  const modelEntities = [...db.tables.blockTable.modelSpace.newIterator()]
  const layouts = [...db.objects.layout.newIterator()]
    .map(layout => layout.layoutName)
    .sort()

  return {
    version: db.version?.name ?? null,
    insunits: db.insunits ?? null,
    ltscale: round(db.ltscale ?? 0),
    textstyle: db.textstyle ?? null,
    layers,
    linetypes,
    textStyles,
    blocks,
    modelSpace: {
      entityCount: modelEntities.length,
      byType: countByType(modelEntities),
      samples: modelEntities.slice(0, 24).map(entitySample)
    },
    layouts
  }
}

/** DXF covering common tables + entities for structural parity. */
function buildParityDxf() {
  return [
    '0',
    'SECTION',
    '2',
    'HEADER',
    '9',
    '$ACADVER',
    '1',
    'AC1032',
    '9',
    '$INSUNITS',
    '70',
    '4',
    '9',
    '$LTSCALE',
    '40',
    '1.5',
    '9',
    '$TEXTSTYLE',
    '7',
    'Standard',
    '9',
    '$HANDSEED',
    '5',
    '200',
    '0',
    'ENDSEC',
    '0',
    'SECTION',
    '2',
    'TABLES',
    '0',
    'TABLE',
    '2',
    'LTYPE',
    '0',
    'LTYPE',
    '5',
    '14',
    '100',
    'AcDbSymbolTableRecord',
    '100',
    'AcDbLinetypeTableRecord',
    '2',
    'DASHED',
    '70',
    '0',
    '3',
    'Dashed __ __',
    '72',
    '65',
    '73',
    '2',
    '40',
    '0.75',
    '49',
    '0.5',
    '49',
    '-0.25',
    '0',
    'ENDTAB',
    '0',
    'TABLE',
    '2',
    'LAYER',
    '0',
    'LAYER',
    '5',
    '10',
    '100',
    'AcDbSymbolTableRecord',
    '100',
    'AcDbLayerTableRecord',
    '2',
    '0',
    '70',
    '0',
    '62',
    '7',
    '6',
    'Continuous',
    '0',
    'LAYER',
    '5',
    '11',
    '100',
    'AcDbSymbolTableRecord',
    '100',
    'AcDbLayerTableRecord',
    '2',
    'Walls',
    '70',
    '0',
    '62',
    '1',
    '6',
    'DASHED',
    '290',
    '1',
    '0',
    'ENDTAB',
    '0',
    'TABLE',
    '2',
    'STYLE',
    '0',
    'STYLE',
    '5',
    '12',
    '100',
    'AcDbSymbolTableRecord',
    '100',
    'AcDbTextStyleTableRecord',
    '2',
    'Standard',
    '70',
    '0',
    '40',
    '0',
    '41',
    '1',
    '50',
    '0',
    '71',
    '0',
    '3',
    'txt',
    '0',
    'ENDTAB',
    '0',
    'TABLE',
    '2',
    'BLOCK_RECORD',
    '0',
    'BLOCK_RECORD',
    '5',
    '1F',
    '100',
    'AcDbSymbolTableRecord',
    '100',
    'AcDbBlockTableRecord',
    '2',
    '*MODEL_SPACE',
    '0',
    'BLOCK_RECORD',
    '5',
    '20',
    '100',
    'AcDbSymbolTableRecord',
    '100',
    'AcDbBlockTableRecord',
    '2',
    'Door',
    '0',
    'ENDTAB',
    '0',
    'ENDSEC',
    '0',
    'SECTION',
    '2',
    'BLOCKS',
    '0',
    'BLOCK',
    '5',
    '21',
    '100',
    'AcDbEntity',
    '8',
    '0',
    '100',
    'AcDbBlockBegin',
    '2',
    'Door',
    '70',
    '0',
    '10',
    '0',
    '20',
    '0',
    '30',
    '0',
    '0',
    'LINE',
    '5',
    '22',
    '100',
    'AcDbEntity',
    '8',
    '0',
    '100',
    'AcDbLine',
    '10',
    '0',
    '20',
    '0',
    '30',
    '0',
    '11',
    '10',
    '21',
    '0',
    '31',
    '0',
    '0',
    'ENDBLK',
    '5',
    '23',
    '100',
    'AcDbEntity',
    '8',
    '0',
    '100',
    'AcDbBlockEnd',
    '0',
    'ENDSEC',
    '0',
    'SECTION',
    '2',
    'ENTITIES',
    '0',
    'LINE',
    '5',
    '30',
    '100',
    'AcDbEntity',
    '8',
    'Walls',
    '100',
    'AcDbLine',
    '10',
    '1',
    '20',
    '2',
    '30',
    '0',
    '11',
    '10',
    '21',
    '20',
    '31',
    '0',
    '0',
    'CIRCLE',
    '5',
    '31',
    '100',
    'AcDbEntity',
    '8',
    '0',
    '100',
    'AcDbCircle',
    '10',
    '5',
    '20',
    '5',
    '30',
    '0',
    '40',
    '3',
    '0',
    'ARC',
    '5',
    '32',
    '100',
    'AcDbEntity',
    '8',
    '0',
    '100',
    'AcDbCircle',
    '10',
    '0',
    '20',
    '0',
    '30',
    '0',
    '40',
    '2',
    '100',
    'AcDbArc',
    '50',
    '0',
    '51',
    '90',
    '0',
    'POINT',
    '5',
    '33',
    '100',
    'AcDbEntity',
    '8',
    '0',
    '100',
    'AcDbPoint',
    '10',
    '7',
    '20',
    '8',
    '30',
    '0',
    '0',
    'LWPOLYLINE',
    '5',
    '34',
    '100',
    'AcDbEntity',
    '8',
    '0',
    '100',
    'AcDbPolyline',
    '90',
    '3',
    '70',
    '1',
    '10',
    '0',
    '20',
    '0',
    '10',
    '4',
    '20',
    '0',
    '10',
    '4',
    '20',
    '3',
    '0',
    'TEXT',
    '5',
    '35',
    '100',
    'AcDbEntity',
    '8',
    '0',
    '100',
    'AcDbText',
    '10',
    '1',
    '20',
    '1',
    '30',
    '0',
    '40',
    '2.5',
    '1',
    'Hello',
    '50',
    '0',
    '7',
    'Standard',
    '0',
    'INSERT',
    '5',
    '36',
    '100',
    'AcDbEntity',
    '8',
    '0',
    '100',
    'AcDbBlockReference',
    '2',
    'Door',
    '10',
    '100',
    '20',
    '200',
    '30',
    '0',
    '41',
    '1',
    '42',
    '1',
    '43',
    '1',
    '50',
    '0',
    '0',
    'ATTRIB',
    '5',
    '37',
    '330',
    '36',
    '100',
    'AcDbEntity',
    '8',
    '0',
    '100',
    'AcDbText',
    '10',
    '100',
    '20',
    '200',
    '30',
    '0',
    '40',
    '1',
    '1',
    'A1',
    '100',
    'AcDbAttribute',
    '2',
    'TAG1',
    '0',
    'SEQEND',
    '5',
    '38',
    '0',
    'ENDSEC',
    '0',
    'EOF',
    ''
  ].join('\n')
}

describe('AcDbNativeDxfConverter parity vs AcDbDxfConverter', () => {
  it('matches legacy converter on synthetic multi-entity DXF', async () => {
    const dxf = buildParityDxf()
    const [legacy, native] = await Promise.all([
      readWithLegacy(dxf),
      readWithNative(dxf)
    ])

    expect(databaseParitySnapshot(native)).toEqual(
      databaseParitySnapshot(legacy)
    )
  })

  it('matches legacy converter on block visibility fixtures', async () => {
    const fixturesDir = join(__dirname, 'fixtures')
    for (const fileName of [
      'invisible-lwpolylines-in-block.dxf',
      'visible-lwpolylines-in-block.dxf'
    ]) {
      const dxf = readFileSync(join(fixturesDir, fileName), 'utf8')
      const [legacy, native] = await Promise.all([
        readWithLegacy(dxf),
        readWithNative(dxf)
      ])
      expect(databaseParitySnapshot(native)).toEqual(
        databaseParitySnapshot(legacy)
      )
    }
  })

  it('matches legacy converter on sheet_0.dxf structural snapshot', async () => {
    const dxf = readFileSync(
      join(__dirname, 'fixtures', 'sheet_0.dxf'),
      'utf8'
    )
    const [legacy, native] = await Promise.all([
      readWithLegacy(dxf),
      readWithNative(dxf)
    ])

    const legacySnap = databaseParitySnapshot(legacy)
    const nativeSnap = databaseParitySnapshot(native)

    // Core tables / entity inventory must match exactly.
    expect(nativeSnap.layers).toEqual(legacySnap.layers)
    expect(nativeSnap.linetypes).toEqual(legacySnap.linetypes)
    expect(nativeSnap.textStyles).toEqual(legacySnap.textStyles)
    expect(nativeSnap.modelSpace.entityCount).toBe(
      legacySnap.modelSpace.entityCount
    )
    expect(nativeSnap.modelSpace.byType).toEqual(legacySnap.modelSpace.byType)
    expect(nativeSnap.blocks.map(b => ({
      name: b.name,
      entityCount: b.entityCount,
      byType: b.byType
    }))).toEqual(
      legacySnap.blocks.map(b => ({
        name: b.name,
        entityCount: b.entityCount,
        byType: b.byType
      }))
    )
  })
})
