import { AcGePoint3d } from '@mlightcad/geometry-engine'

import { acdbHostApplicationServices } from '../src/base'
import { AcDbAlignedDimension } from '../src/entity'
import {
  acdbApplyDimStyleOverrides,
  AcDbBlockTableRecord,
  AcDbDatabase,
  AcDbDimStyleTableRecord,
  AcDbDxfCode,
  AcDbLeader,
  acdbReadDimStyleOverrides,
  acdbResolveDimStyleOverrides,
  acdbResolveEffectiveDimStyle,
  AcDbResultBuffer,
  acdbWriteDimStyleOverrides
} from '../src/index'

/**
 * Builds the `ACAD`/`DSTYLE` XData block AutoCAD attaches to a leader.
 *
 * Handles 2B15F / 77A85 from 蓝田记翼项目檐下集装饰施工图8.19.dwg carry exactly
 * this payload: DIMASZ 0.08, DIMTAD 0, DIMCLRD 1 and a cleared DIMLDRBLK.
 */
function dstyleValues(
  overrides: Array<{ code: number; value: number | string }>,
  extra: Array<{ code: AcDbDxfCode; value: unknown }> = []
) {
  const values: Array<{ code: AcDbDxfCode; value: unknown }> = [
    { code: AcDbDxfCode.ExtendedDataRegAppName, value: 'ACAD' },
    ...extra,
    { code: AcDbDxfCode.ExtendedDataAsciiString, value: 'DSTYLE' },
    { code: AcDbDxfCode.ExtendedDataControlString, value: '{' }
  ]
  for (const override of overrides) {
    values.push({
      code: AcDbDxfCode.ExtendedDataInteger16,
      value: override.code
    })
    if (typeof override.value === 'string') {
      values.push({
        code: AcDbDxfCode.ExtendedDataHandle,
        value: override.value
      })
    } else if (Number.isInteger(override.value)) {
      values.push({
        code: AcDbDxfCode.ExtendedDataInteger16,
        value: override.value
      })
    } else {
      values.push({ code: AcDbDxfCode.ExtendedDataReal, value: override.value })
    }
  }
  values.push({ code: AcDbDxfCode.ExtendedDataControlString, value: '}' })
  return values
}

const ARROW_OVERRIDES = [
  { code: 41, value: 0.08 },
  { code: 77, value: 0 },
  { code: 176, value: 1 },
  { code: 341, value: '0' }
]

describe('entity-level DSTYLE overrides', () => {
  it('reads the ACAD/DSTYLE override pairs of a leader', () => {
    const leader = new AcDbLeader()
    leader.setXData(
      new AcDbResultBuffer(dstyleValues(ARROW_OVERRIDES) as never)
    )

    expect(acdbReadDimStyleOverrides(leader)).toEqual([
      { code: 41, value: 0.08 },
      { code: 77, value: 0 },
      { code: 176, value: 1 },
      { code: 341, value: '0' }
    ])
  })

  it('reads the compact imported form without materializing it', () => {
    const leader = new AcDbLeader()
    leader.setImportedXData(dstyleValues(ARROW_OVERRIDES) as never)

    // Reading must not spend the compact representation: DXF output order and
    // fidelity depend on it during a whole-drawing import.
    const first = acdbReadDimStyleOverrides(leader)
    const second = acdbReadDimStyleOverrides(leader)

    expect(first).toEqual(second)
    expect(first).toHaveLength(4)
  })

  it('returns no overrides when the entity has no DSTYLE section', () => {
    const leader = new AcDbLeader()
    leader.setXData(
      new AcDbResultBuffer([
        { code: AcDbDxfCode.ExtendedDataRegAppName, value: 'ACAD' },
        { code: AcDbDxfCode.ExtendedDataAsciiString, value: 'OTHER' }
      ] as never)
    )
    expect(acdbReadDimStyleOverrides(leader)).toEqual([])
  })

  it('keeps a cleared arrow-handle override as "use the standard arrow"', () => {
    const db = new AcDbDatabase()
    const resolved = acdbResolveDimStyleOverrides(
      [{ code: 341, value: '0' }],
      db
    )
    expect(resolved).toEqual([{ code: 341, value: '' }])
  })

  it('resolves DIMLDRBLK handles to the referenced block name', () => {
    const db = new AcDbDatabase()
    const block = new AcDbBlockTableRecord()
    block.name = 'MYARROW'
    block.objectId = 'A1'
    ;(
      db as unknown as { _handleRegistry: Map<string, unknown> }
    )._handleRegistry.set('A1', block)

    expect(
      acdbResolveDimStyleOverrides([{ code: 341, value: 'A1' }], db)
    ).toEqual([{ code: 341, value: 'MYARROW' }])
  })

  it('applies overrides on a copy and leaves the table record untouched', () => {
    const base = new AcDbDimStyleTableRecord()
    base.name = 'HBA_60'
    base.dimasz = 2.5
    base.dimtad = 1
    base.dimldrblk = 'CCD_Leader_Dot'

    const effective = acdbApplyDimStyleOverrides(
      base,
      acdbResolveDimStyleOverrides(ARROW_OVERRIDES, undefined)
    )

    expect(effective).not.toBe(base)
    expect(effective.objectId).toBe('')
    expect(effective.dimasz).toBe(0.08)
    expect(effective.dimtad).toBe(0)
    expect(effective.dimclrd).toBe(1)
    expect(effective.dimldrblk).toBe('')
    // The source record keeps its own values.
    expect(base.dimasz).toBe(2.5)
    expect(base.dimldrblk).toBe('CCD_Leader_Dot')
  })

  it('drives the leader style from entity overrides without touching the table record', () => {
    const db = new AcDbDatabase()
    db.createDefaultData()

    const style = new AcDbDimStyleTableRecord()
    style.name = 'OVERRIDE_STYLE'
    style.dimasz = 25
    style.dimscale = 1
    db.tables.dimStyleTable.add(style)

    const leader = new AcDbLeader()
    leader.database = db
    leader.dimensionStyle = 'OVERRIDE_STYLE'
    leader.setXData(
      new AcDbResultBuffer(dstyleValues([{ code: 41, value: 0.08 }]) as never)
    )

    const effective = acdbResolveEffectiveDimStyle(leader, style, db)
    expect(effective?.dimasz).toBe(0.08)
    // The shared table record must keep its own DIMASZ.
    expect(style.dimasz).toBe(25)
    expect(db.tables.dimStyleTable.getAt('OVERRIDE_STYLE')?.dimasz).toBe(25)

    // Fallback for entities without overrides stays untouched.
    const plain = new AcDbLeader()
    plain.database = db
    plain.dimensionStyle = 'OVERRIDE_STYLE'
    expect(acdbResolveEffectiveDimStyle(plain, style, db)).toBe(style)
  })

  it('round-trips overrides through acdbWriteDimStyleOverrides', () => {
    const leader = new AcDbLeader()
    acdbWriteDimStyleOverrides(leader, [
      { code: 41, value: 0.08 },
      { code: 147, value: 0.6 },
      { code: 341, value: '' }
    ])

    expect(acdbReadDimStyleOverrides(leader)).toEqual([
      { code: 41, value: 0.08 },
      { code: 147, value: 0.6 },
      { code: 341, value: '0' }
    ])

    // Rewriting replaces only the DSTYLE subsection and keeps other ACAD data.
    leader.setImportedXData([
      ...dstyleValues([{ code: 41, value: 1 }]),
      { code: AcDbDxfCode.ExtendedDataAsciiString, value: 'KEEP_ME' }
    ] as never)
    acdbWriteDimStyleOverrides(leader, [{ code: 41, value: 2 }])
    const values = Array.from(acdbReadDimStyleOverrides(leader))
    expect(values).toEqual([{ code: 41, value: 2 }])
    expect(
      Array.from(leader.iterateXData('ACAD')).some(
        item => item.value === 'KEEP_ME'
      )
    ).toBe(true)
  })

  it('resolveEffectiveDimStyle returns the base style when there is no override', () => {
    const base = new AcDbDimStyleTableRecord()
    base.name = 'PLAIN'
    const leader = new AcDbLeader()
    expect(acdbResolveEffectiveDimStyle(leader, base, undefined)).toBe(base)
  })

  it('converts numeric XData back to the text property type (DIMDSEP)', () => {
    // DSTYLE stores DIMDSEP as the group code 1070 default, i.e. the ASCII code
    // of the single-character separator. Assigning the raw code to the string
    // property makes `String.prototype.replace` splice "44" into the number.
    const base = new AcDbDimStyleTableRecord()
    base.name = 'SEP'
    const leader = new AcDbLeader()
    leader.setXData(
      new AcDbResultBuffer(dstyleValues([{ code: 278, value: 44 }]) as never)
    )

    const effective = acdbResolveEffectiveDimStyle(leader, base, undefined)

    expect(effective?.dimdsep).toBe(',')
    expect(base.dimdsep).toBe('.')
  })

  it('applies DIMPOST text overrides verbatim', () => {
    const base = new AcDbDimStyleTableRecord()
    base.name = 'POST'
    const leader = new AcDbLeader()
    leader.setXData(
      new AcDbResultBuffer(dstyleValues([{ code: 3, value: ' mm' }]) as never)
    )

    expect(acdbResolveEffectiveDimStyle(leader, base, undefined)?.dimpost).toBe(
      ' mm'
    )
  })
})

describe('AcDbDimension effective style', () => {
  const createDb = () => {
    const db = new AcDbDatabase()
    db.createDefaultData()
    acdbHostApplicationServices().workingDatabase = db
    return db
  }

  const createStyledDimension = () => {
    const db = createDb()

    const style = new AcDbDimStyleTableRecord()
    style.name = 'DIM_OVERRIDE'
    style.dimasz = 3.5
    style.dimtad = 1
    style.dimclrd = 256
    style.dimldrblk = 'ARCHTICK'
    db.tables.dimStyleTable.add(style)

    const dim = new AcDbAlignedDimension(
      new AcGePoint3d(),
      new AcGePoint3d(10, 0, 0),
      new AcGePoint3d(10, 5, 0)
    )
    dim.dimensionStyleName = 'DIM_OVERRIDE'
    db.tables.blockTable.modelSpace.appendEntity(dim)

    return { db, style, dim }
  }

  it('layers entity DSTYLE overrides over the referenced table record', () => {
    const { db, style, dim } = createStyledDimension()
    dim.setXData(new AcDbResultBuffer(dstyleValues(ARROW_OVERRIDES) as never))

    const effective = dim.dimensionStyle
    expect(effective).not.toBe(style)
    expect(effective.dimasz).toBe(0.08)
    expect(effective.dimtad).toBe(0)
    expect(effective.dimclrd).toBe(1)
    expect(effective.dimldrblk).toBe('')

    // The shared table record keeps the drawing-wide values.
    expect(style.dimasz).toBe(3.5)
    expect(style.dimtad).toBe(1)
    expect(style.dimclrd).toBe(256)
    expect(style.dimldrblk).toBe('ARCHTICK')
    expect(db.tables.dimStyleTable.getAt('DIM_OVERRIDE')).toBe(style)
  })

  it('returns the table record itself when there is no override', () => {
    const { style, dim } = createStyledDimension()
    expect(dim.dimensionStyle).toBe(style)
  })

  it('drops the cached style when ACAD XData is rewritten', () => {
    const { dim } = createStyledDimension()
    dim.setXData(
      new AcDbResultBuffer(dstyleValues([{ code: 41, value: 0.1 }]) as never)
    )
    expect(dim.dimensionStyle.dimasz).toBe(0.1)

    dim.setXData(
      new AcDbResultBuffer(dstyleValues([{ code: 41, value: 0.2 }]) as never)
    )
    expect(dim.dimensionStyle.dimasz).toBe(0.2)

    dim.removeXData('ACAD')
    expect(dim.dimensionStyle.dimasz).toBe(3.5)
  })

  it('drops the cached style when imported ACAD XData is replaced', () => {
    const { dim } = createStyledDimension()
    dim.setImportedXData(dstyleValues([{ code: 41, value: 0.3 }]) as never)
    expect(dim.dimensionStyle.dimasz).toBe(0.3)

    dim.setImportedXData(dstyleValues([{ code: 41, value: 0.4 }]) as never)
    expect(dim.dimensionStyle.dimasz).toBe(0.4)
  })

  it('keeps the cache when unrelated XData changes', () => {
    const { dim } = createStyledDimension()
    dim.setXData(
      new AcDbResultBuffer(dstyleValues([{ code: 41, value: 0.1 }]) as never)
    )
    const cached = dim.dimensionStyle

    dim.setXData(
      new AcDbResultBuffer([
        { code: AcDbDxfCode.ExtendedDataRegAppName, value: 'MY_APP' },
        { code: AcDbDxfCode.ExtendedDataAsciiString, value: 'payload' }
      ] as never)
    )

    expect(dim.dimensionStyle).toBe(cached)
  })
})
