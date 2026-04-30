import { AcCmColor } from '@mlightcad/common'

import { acdbHostApplicationServices } from '../src/base'
import { AcDbDatabase } from '../src/database'
import { AcDbMLine } from '../src/entity'
import { AcDbMlineStyle } from '../src/object'

const createDb = () => {
  const db = new AcDbDatabase()
  db.createDefaultData()
  acdbHostApplicationServices().workingDatabase = db
  return db
}

const createBasicMline = (style: AcDbMlineStyle) => {
  const mline = new AcDbMLine()
  mline.styleName = style.styleName
  mline.styleObjectHandle = style.objectId
  mline.styleCount = 2
  mline.startPosition = { x: 0, y: 0, z: 0 }
  mline.segments = [
    {
      position: { x: 10, y: 0, z: 0 },
      direction: { x: 1, y: 0, z: 0 },
      miterDirection: { x: 0, y: 1, z: 0 },
      elements: [
        {
          parameterCount: 1,
          parameters: [0.5],
          fillCount: 0,
          fillParameters: []
        },
        {
          parameterCount: 1,
          parameters: [-0.5],
          fillCount: 0,
          fillParameters: []
        }
      ]
    },
    {
      position: { x: 20, y: 0, z: 0 },
      direction: { x: 1, y: 0, z: 0 },
      miterDirection: { x: 0, y: 1, z: 0 },
      elements: [
        {
          parameterCount: 1,
          parameters: [0.5],
          fillCount: 0,
          fillParameters: []
        },
        {
          parameterCount: 1,
          parameters: [-0.5],
          fillCount: 0,
          fillParameters: []
        }
      ]
    }
  ]
  return mline
}

describe('AcDbMLine', () => {
  it('renders fill area when mline style fill is enabled and restores traits', () => {
    const db = createDb()

    const style = new AcDbMlineStyle()
    style.styleName = 'FILL_STYLE'
    style.flags = 1
    style.fillColor = 1
    style.elements = [
      { offset: 0.5, color: 3, lineType: 'BYLAYER' },
      { offset: -0.5, color: 5, lineType: 'BYLAYER' }
    ]
    db.objects.mlineStyle.setAt(style.styleName, style)

    const mline = createBasicMline(style)
    db.tables.blockTable.modelSpace.appendEntity(mline)

    const baseColor = new AcCmColor()
    baseColor.colorIndex = 2
    const traits = {
      color: baseColor,
      rgbColor: 0x123456,
      fillType: {
        solidFill: false,
        patternAngle: 0,
        definitionLines: []
      },
      drawOrder: 0
    }

    const fillTraitSnapshots: Array<{
      colorIndex: number | undefined
      drawOrder: number
      fillTypeSolid: boolean
    }> = []
    const renderer = {
      subEntityTraits: traits,
      area: jest.fn(() => {
        fillTraitSnapshots.push({
          colorIndex: traits.color.colorIndex,
          drawOrder: traits.drawOrder,
          fillTypeSolid: traits.fillType.solidFill
        })
        return { kind: 'area' }
      }),
      lines: jest.fn(() => ({ kind: 'line' })),
      group: jest.fn((entities: unknown[]) => ({ kind: 'group', entities }))
    }

    const result = mline.subWorldDraw(renderer as never) as unknown as {
      kind: string
      entities: unknown[]
    }

    expect(renderer.area).toHaveBeenCalledTimes(1)
    expect(renderer.lines).toHaveBeenCalledTimes(2)
    expect(renderer.group).toHaveBeenCalledTimes(1)
    expect(result.kind).toBe('group')
    expect(result.entities).toHaveLength(3)

    expect(fillTraitSnapshots).toEqual([
      {
        colorIndex: 1,
        drawOrder: -1,
        fillTypeSolid: true
      }
    ])
    expect(traits.color).toBe(baseColor)
    expect(traits.rgbColor).toBe(0x123456)
    expect(traits.fillType).toMatchObject({
      solidFill: false,
      patternAngle: 0
    })
    expect(traits.drawOrder).toBe(0)
  })

  it('does not render fill area when fill flag is disabled', () => {
    const db = createDb()

    const style = new AcDbMlineStyle()
    style.styleName = 'NO_FILL_STYLE'
    style.flags = 0
    style.fillColor = 1
    style.elements = [
      { offset: 0.5, color: 3, lineType: 'BYLAYER' },
      { offset: -0.5, color: 5, lineType: 'BYLAYER' }
    ]
    db.objects.mlineStyle.setAt(style.styleName, style)

    const mline = createBasicMline(style)
    db.tables.blockTable.modelSpace.appendEntity(mline)

    const renderer = {
      subEntityTraits: {
        color: new AcCmColor(),
        rgbColor: 0xffffff,
        fillType: {
          solidFill: false,
          patternAngle: 0,
          definitionLines: []
        },
        drawOrder: 0
      },
      area: jest.fn(() => ({ kind: 'area' })),
      lines: jest.fn(() => ({ kind: 'line' })),
      group: jest.fn((entities: unknown[]) => ({ kind: 'group', entities }))
    }

    const result = mline.subWorldDraw(renderer as never) as unknown as {
      kind: string
      entities: unknown[]
    }

    expect(renderer.area).not.toHaveBeenCalled()
    expect(renderer.lines).toHaveBeenCalledTimes(2)
    expect(result.kind).toBe('group')
    expect(result.entities).toHaveLength(2)
  })
})
