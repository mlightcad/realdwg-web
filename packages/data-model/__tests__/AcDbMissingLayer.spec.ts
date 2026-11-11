import { acdbHostApplicationServices } from '../src/base'
import { AcDbDatabase } from '../src/database'
import { AcDbNativeDxfConverter } from '../src/dxf'
import { AcDbLine } from '../src/entity'

/**
 * R12 DXF without a TABLES section whose entities reference layers that are
 * never declared (mlightcad/cad-viewer#901 repro). AutoCAD creates such layers
 * on load; viewers rely on `layerAppended` to create a layer group before the
 * entity is drawn.
 */
const DXF_WITHOUT_LAYER_TABLE = [
  '0',
  'SECTION',
  '2',
  'HEADER',
  '9',
  '$ACADVER',
  '1',
  'AC1009',
  '0',
  'ENDSEC',
  '0',
  'SECTION',
  '2',
  'ENTITIES',
  '0',
  'TEXT',
  '8',
  'TEXT',
  '10',
  '5.0',
  '20',
  '30.0',
  '30',
  '0.0',
  '40',
  '5.0',
  '1',
  'WIDTH FACTOR 1.0',
  '0',
  'LINE',
  '8',
  'FRAME',
  '10',
  '5.0',
  '20',
  '29.0',
  '30',
  '0.0',
  '11',
  '95.0',
  '21',
  '29.0',
  '31',
  '0.0',
  '0',
  'LINE',
  '8',
  'frame',
  '10',
  '5.0',
  '20',
  '14.0',
  '30',
  '0.0',
  '11',
  '59.0',
  '21',
  '14.0',
  '31',
  '0.0',
  '0',
  'ENDSEC',
  '0',
  'EOF',
  ''
].join('\n')

describe('entities on layers missing from the LAYER table', () => {
  it('creates the missing layers before entities are announced', async () => {
    const db = new AcDbDatabase()
    db.createDefaultData()
    acdbHostApplicationServices().workingDatabase = db

    const missingAtAppend: string[] = []
    db.events.entityAppended.addEventListener(args => {
      const entities = Array.isArray(args.entity) ? args.entity : [args.entity]
      for (const entity of entities) {
        if (!db.tables.layerTable.has(entity.layer)) {
          missingAtAppend.push(entity.layer)
        }
      }
    })

    const converter = new AcDbNativeDxfConverter()
    const buffer = new TextEncoder().encode(DXF_WITHOUT_LAYER_TABLE).buffer
    await converter.read(buffer, db, { minimumChunkSize: 50 })

    expect(missingAtAppend).toEqual([])

    for (const name of ['TEXT', 'FRAME']) {
      const layer = db.tables.layerTable.getAt(name)
      expect(layer).toBeDefined()
      expect(layer!.color.colorIndex).toBe(7)
      expect(layer!.linetype).toBe('Continuous')
      expect(layer!.isOff).toBe(false)
      expect(layer!.isFrozen).toBe(false)
    }
    // Layer names are case-insensitive: `frame` reuses `FRAME`.
    const names = [...db.tables.layerTable.newIterator()].map(l => l.name)
    expect(names.filter(n => n.toUpperCase() === 'FRAME')).toEqual(['FRAME'])
  })

  it('creates a missing layer when an entity is appended through the API', () => {
    const db = new AcDbDatabase()
    db.createDefaultData()
    acdbHostApplicationServices().workingDatabase = db

    const line = new AcDbLine()
    line.layer = 'API_ONLY'
    db.tables.blockTable.modelSpace.appendEntity(line)

    expect(db.tables.layerTable.has('API_ONLY')).toBe(true)
  })
})
