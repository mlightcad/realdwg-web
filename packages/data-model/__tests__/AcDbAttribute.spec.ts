import { AcDbDxfFiler, acdbHostApplicationServices } from '../src/base'
import { AcDbDatabase } from '../src/database'
import { AcDbAttribute, AcDbMText } from '../src/entity'
import { expectDetachedClone } from '../test-utils/cloneTestUtils'

const setWorkingDb = () => {
  const db = new AcDbDatabase()
  db.createDefaultData()
  acdbHostApplicationServices().workingDatabase = db
  return db
}

const createDxf = (attribute: AcDbAttribute) => {
  const filer = new AcDbDxfFiler()
  attribute.dxfOutFields(filer)
  return filer.toString()
}

const prepareAttributeForDxf = (attribute: AcDbAttribute) => {
  attribute.ownerId = 'NON_EXIST_OWNER'
  attribute.layer = '0'
  attribute.lineWeight = 0
  attribute.linetypeScale = 1
}

describe('AcDbAttribute', () => {
  it('has expected type metadata', () => {
    const attribute = new AcDbAttribute()

    expect(AcDbAttribute.typeName).toBe('Attrib')
    expect(attribute.dxfTypeName).toBe('ATTRIB')
  })

  it('toggles attribute flags via boolean accessors', () => {
    const attribute = new AcDbAttribute()

    expect(attribute.isInvisible).toBe(false)
    attribute.isInvisible = true
    expect(attribute.isInvisible).toBe(true)
    attribute.isInvisible = false
    expect(attribute.isInvisible).toBe(false)

    expect(attribute.isConst).toBe(false)
    attribute.isConst = true
    expect(attribute.isConst).toBe(true)
    attribute.isConst = false
    expect(attribute.isConst).toBe(false)

    expect(attribute.isVerifiable).toBe(false)
    attribute.isVerifiable = true
    expect(attribute.isVerifiable).toBe(true)
    attribute.isVerifiable = false
    expect(attribute.isVerifiable).toBe(false)

    expect(attribute.isPreset).toBe(false)
    attribute.isPreset = true
    expect(attribute.isPreset).toBe(true)
    attribute.isPreset = false
    expect(attribute.isPreset).toBe(false)

    expect(attribute.isConstMTextAttribute).toBe(false)
    attribute.isConstMTextAttribute = true
    expect(attribute.isConstMTextAttribute).toBe(true)
    attribute.isConstMTextAttribute = false
    expect(attribute.isConstMTextAttribute).toBe(false)
  })

  it('supports scalar properties', () => {
    const attribute = new AcDbAttribute()

    attribute.tag = 'TAG_A'
    attribute.fieldLength = 64
    attribute.lockPositionInBlock = true
    attribute.isReallyLocked = true

    expect(attribute.tag).toBe('TAG_A')
    expect(attribute.fieldLength).toBe(64)
    expect(attribute.lockPositionInBlock).toBe(true)
    expect(attribute.isReallyLocked).toBe(true)
  })

  it('updates mtext and multiline flags automatically', () => {
    const attribute = new AcDbAttribute()
    const mtext = new AcDbMText()

    expect(attribute.mtext).toBeUndefined()
    expect(attribute.isMTextAttribute).toBe(false)

    attribute.mtext = mtext
    expect(attribute.mtext).toBe(mtext)
    expect(attribute.isMTextAttribute).toBe(true)

    attribute.isMTextAttribute = false
    expect(attribute.isMTextAttribute).toBe(false)

    attribute.mtext = undefined
    expect(attribute.mtext).toBeUndefined()
    expect(attribute.isMTextAttribute).toBe(false)
  })

  it('writes expected DXF fields for single-line attribute', () => {
    setWorkingDb()
    const attribute = new AcDbAttribute()
    prepareAttributeForDxf(attribute)
    attribute.tag = 'TAG_A'
    attribute.fieldLength = 32
    attribute.isInvisible = true
    attribute.isReallyLocked = true

    const filer = new AcDbDxfFiler()
    expect(attribute.dxfOutFields(filer)).toBe(attribute)

    const dxf = filer.toString()
    expect(dxf).toContain('100\nAcDbAttribute\n')
    expect(dxf).toContain('70\n1\n')
    expect(dxf).toContain('73\n32\n')
    expect(dxf).toContain('2\nTAG_A\n')
    expect(dxf).toContain('74\n1\n')
    expect(dxf).not.toContain('\n71\n')
  })

  it('writes group 71 as 1 when multiline attribute is enabled', () => {
    setWorkingDb()
    const attribute = new AcDbAttribute()
    prepareAttributeForDxf(attribute)
    attribute.mtext = new AcDbMText()

    const dxf = createDxf(attribute)
    expect(dxf).toContain('71\n1\n')
  })

  it('writes group 71 as 0 when mtext exists but multiline flag is disabled', () => {
    setWorkingDb()
    const attribute = new AcDbAttribute()
    prepareAttributeForDxf(attribute)
    attribute.mtext = new AcDbMText()
    attribute.isMTextAttribute = false

    const dxf = createDxf(attribute)
    expect(dxf).toContain('71\n0\n')
  })

  it('clone creates a detached clone with a new objectId', () => {
    expectDetachedClone(() => new AcDbAttribute())
  })
})
