import { AcCmColor, AcCmColorMethod } from '@mlightcad/common'
import { AcGePoint3d } from '@mlightcad/geometry-engine'
import { AcGiLineWeight } from '@mlightcad/graphic-interface'

import { acdbHostApplicationServices } from '../src/base'
import {
  AcDbBlockTableRecord,
  AcDbDatabase,
  AcDbLinetypeTableRecord
} from '../src/database'
import { AcDbLine, AcDbMLeader } from '../src/entity'
import { AcDbRenderingCache } from '../src/misc'
import { AcDbMLeaderStyle } from '../src/object'

const createWorkingDb = () => {
  const db = new AcDbDatabase()
  db.createDefaultData()
  acdbHostApplicationServices().workingDatabase = db
  return db
}

const createRenderer = () => {
  const renderer = {
    subEntityTraits: {
      color: undefined,
      rgbColor: 0,
      lineType: {
        type: 'UserSpecified',
        name: 'CONTINUOUS',
        standardFlag: 0,
        description: '',
        totalPatternLength: 0
      },
      lineTypeScale: 1,
      lineWeight: undefined,
      fillType: undefined,
      transparency: undefined,
      thickness: 0,
      layer: '0',
      drawOrder: 0
    },
    lines: jest.fn((points: unknown[]) => {
      return { kind: 'lines', points }
    }),
    group: jest.fn((entities: unknown[]) => ({ kind: 'group', entities })),
    point: jest.fn(),
    circularArc: jest.fn(),
    ellipticalArc: jest.fn(),
    lineSegments: jest.fn(),
    area: jest.fn(),
    mtext: jest.fn(),
    image: jest.fn(),
    setFontMapping: jest.fn()
  }
  return renderer
}

const createSimpleLeader = (db: AcDbDatabase) => {
  const mleader = new AcDbMLeader()
  const leaderIndex = mleader.addLeader()
  mleader.addLeaderLine(leaderIndex, [
    new AcGePoint3d(0, 0, 0),
    new AcGePoint3d(5, 0, 0)
  ])
  db.tables.blockTable.modelSpace.appendEntity(mleader)
  return mleader
}

describe('AcDbMLeader arrowhead rendering', () => {
  it('ensures database default mleader style exists when appending a new MLEADER', () => {
    const db = createWorkingDb()
    db.cmleaderstyle = 'AUTO_MLEADER_STYLE'

    const mleader = createSimpleLeader(db)
    const style = db.objects.mleaderStyle.getAt('AUTO_MLEADER_STYLE')

    expect(style).toBeDefined()
    expect(mleader.mleaderStyleId).toBe(style?.objectId)
    expect(style?.maxLeaderSegmentsPoints).toBe(2)
    expect(style?.leaderLineColor.isByBlock).toBe(true)
    expect(style?.textColor.isByBlock).toBe(true)
    expect(style?.blockColor.isByBlock).toBe(true)
    expect(style?.alignSpace).toBe(4)
    expect(style?.breakSize).toBe(3.75)
    expect(style?.enableBlockRotation).toBe(true)
    expect(style?.unknown1).toBe(2)
    expect(style?.unknown2).toBe(false)
  })

  it('uses CMLEADERSTYLE as default style for newly appended MLeader entities', () => {
    const db = createWorkingDb()
    const baseStyle = new AcDbMLeaderStyle()
    db.objects.mleaderStyle.setAt('BASE', baseStyle)
    const activeStyle = new AcDbMLeaderStyle()
    db.objects.mleaderStyle.setAt('ACTIVE', activeStyle)
    db.cmleaderstyle = 'ACTIVE'

    const mleader = createSimpleLeader(db)
    expect(mleader.mleaderStyleId).toBe(activeStyle.objectId)
  })

  it('renders closed-filled arrows when style arrowhead id is default 0', () => {
    const db = createWorkingDb()
    const mleader = createSimpleLeader(db)

    const style = new AcDbMLeaderStyle()
    style.arrowheadId = '0'
    db.objects.mleaderStyle.setAt(style.objectId, style)
    mleader.mleaderStyleId = style.objectId

    const renderer = createRenderer()
    mleader.worldDraw(renderer as never)

    expect(renderer.lines).toHaveBeenCalledTimes(1)
    expect(renderer.area).toHaveBeenCalledTimes(1)
  })

  it('renders arrowhead from referenced block record handle', () => {
    const db = createWorkingDb()
    const mleader = createSimpleLeader(db)

    const arrowBlock = new AcDbBlockTableRecord()
    arrowBlock.name = 'ARROW_BLOCK'
    db.tables.blockTable.add(arrowBlock)
    mleader.arrowheadId = arrowBlock.objectId

    const renderer = createRenderer()
    const cacheResult = { kind: 'arrow-block' }
    const drawSpy = jest
      .spyOn(AcDbRenderingCache.instance, 'draw')
      .mockReturnValue(cacheResult as never)

    mleader.worldDraw(renderer as never)

    expect(drawSpy).toHaveBeenCalledTimes(1)
    expect(drawSpy.mock.calls[0][1]).toBe(arrowBlock)
    expect(renderer.lines).toHaveBeenCalledTimes(1)
    expect(renderer.area).not.toHaveBeenCalled()

    drawSpy.mockRestore()
  })

  it('trims leader line start when block arrow occupies the tip area', () => {
    const db = createWorkingDb()
    const mleader = createSimpleLeader(db)

    const arrowBlock = new AcDbBlockTableRecord()
    arrowBlock.name = 'TRIM_ARROW_BLOCK'
    arrowBlock.origin = new AcGePoint3d(0, 0, 0)
    arrowBlock.appendEntity(
      new AcDbLine(new AcGePoint3d(-0.5, 0, 0), new AcGePoint3d(0.5, 0, 0))
    )
    db.tables.blockTable.add(arrowBlock)
    mleader.arrowheadId = arrowBlock.objectId

    const renderer = createRenderer()
    const drawSpy = jest
      .spyOn(AcDbRenderingCache.instance, 'draw')
      .mockReturnValue({ kind: 'arrow-block' } as never)

    mleader.worldDraw(renderer as never)

    const linePoints = renderer.lines.mock.calls[0][0] as AcGePoint3d[]
    expect(linePoints[0].x).toBeCloseTo(2)
    expect(linePoints[0].y).toBeCloseTo(0)
    expect(linePoints[1].x).toBeCloseTo(5)
    expect(drawSpy).toHaveBeenCalledTimes(1)

    drawSpy.mockRestore()
  })

  it('does not render arrows when arrowhead type resolves to _NONE', () => {
    const db = createWorkingDb()
    const mleader = createSimpleLeader(db)
    mleader.arrowheadId = '_NONE'

    const renderer = createRenderer()
    mleader.worldDraw(renderer as never)

    expect(renderer.lines).toHaveBeenCalledTimes(1)
    expect(renderer.area).not.toHaveBeenCalled()
  })

  it('applies style leader/text color when entity raw color is unresolved ByBlock', () => {
    const db = createWorkingDb()
    const mleader = createSimpleLeader(db)
    mleader.contents = 'Color by style'
    mleader.textLocation = new AcGePoint3d(5, 2, 0)

    // Simulate DXF payload that writes entity raw color fields as ByBlock.
    mleader.leaderLineColor = (0xc1 << 24) >> 0
    mleader.textColor = (0xc1 << 24) >> 0

    const style = new AcDbMLeaderStyle()
    style.leaderLineColor = new AcCmColor(AcCmColorMethod.ByColor, 0xff0000)
    style.textColor = new AcCmColor(AcCmColorMethod.ByColor, 0x00aa00)
    db.objects.mleaderStyle.setAt(style.objectId, style)
    mleader.mleaderStyleId = style.objectId

    const renderer = createRenderer()
    const lineRgbLog: number[] = []
    let mtextRgb = -1
    renderer.lines.mockImplementation((points: unknown[]) => {
      lineRgbLog.push(renderer.subEntityTraits.rgbColor)
      return { kind: 'lines', points }
    })
    renderer.mtext.mockImplementation(() => {
      mtextRgb = renderer.subEntityTraits.rgbColor
      return { kind: 'mtext' }
    })

    mleader.worldDraw(renderer as never)

    expect(lineRgbLog[0]).toBe(0xff0000)
    expect(mtextRgb).toBe(0x00aa00)
  })

  it('applies style leader linetype id and lineweight to rendered leader line', () => {
    const db = createWorkingDb()
    const mleader = createSimpleLeader(db)

    const customLinetype = new AcDbLinetypeTableRecord({
      name: 'ML_TEST_DASHED',
      standardFlag: 0,
      description: 'test',
      totalPatternLength: 0.6,
      pattern: [
        { elementLength: 0.3, elementTypeFlag: 0 },
        { elementLength: -0.3, elementTypeFlag: 0 }
      ]
    })
    db.tables.linetypeTable.add(customLinetype)

    const style = new AcDbMLeaderStyle()
    style.leaderLineTypeId = customLinetype.objectId
    style.leaderLineWeight = AcGiLineWeight.LineWeight040
    db.objects.mleaderStyle.setAt(style.objectId, style)
    mleader.mleaderStyleId = style.objectId

    const renderer = createRenderer()
    let lineTypeName = ''
    let lineWeight: AcGiLineWeight | undefined
    renderer.lines.mockImplementation((points: unknown[]) => {
      lineTypeName = renderer.subEntityTraits.lineType.name
      lineWeight = renderer.subEntityTraits.lineWeight
      return { kind: 'lines', points }
    })

    mleader.worldDraw(renderer as never)

    expect(lineTypeName).toBe('ML_TEST_DASHED')
    expect(lineWeight).toBe(AcGiLineWeight.LineWeight040)
  })

  it('uses style dogleg settings when entity has no dogleg override', () => {
    const db = createWorkingDb()
    const mleader = new AcDbMLeader()
    const leaderIndex = mleader.addLeader({
      lastLeaderLinePoint: new AcGePoint3d(5, 0, 0),
      lastLeaderLinePointSet: true
    })
    mleader.addLeaderLine(leaderIndex, [
      new AcGePoint3d(0, 0, 0),
      new AcGePoint3d(5, 0, 0)
    ])
    db.tables.blockTable.modelSpace.appendEntity(mleader)

    const style = new AcDbMLeaderStyle()
    style.doglegEnabled = true
    style.doglegLength = 3
    db.objects.mleaderStyle.setAt(style.objectId, style)
    mleader.mleaderStyleId = style.objectId

    const renderer = createRenderer()
    mleader.worldDraw(renderer as never)

    expect(renderer.lines).toHaveBeenCalledTimes(2)
  })
})
