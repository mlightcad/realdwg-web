import { AcGePoint3d } from '@mlightcad/geometry-engine'

import { acdbHostApplicationServices } from '../src/base'
import { AcDbBlockTableRecord, AcDbDatabase } from '../src/database'
import { AcDbMLeader } from '../src/entity'
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

  it('does not render arrows when arrowhead type resolves to _NONE', () => {
    const db = createWorkingDb()
    const mleader = createSimpleLeader(db)
    mleader.arrowheadId = '_NONE'

    const renderer = createRenderer()
    mleader.worldDraw(renderer as never)

    expect(renderer.lines).toHaveBeenCalledTimes(1)
    expect(renderer.area).not.toHaveBeenCalled()
  })
})
