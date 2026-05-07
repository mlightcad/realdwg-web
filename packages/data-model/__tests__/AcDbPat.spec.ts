import { HATCH_PATTERN_SOLID } from '../src/misc'
import {
  AcDbPatSvgRenderer,
  AcDbPredefinedAcadIsoPat,
  AcDbPredefinedAcadPat
} from '../src/misc/pat'

describe('AcDbPat predefined patterns', () => {
  it('defines SOLID without PAT line descriptors', () => {
    const acadSolid = AcDbPredefinedAcadPat.patterns.find(
      pattern => pattern.name === HATCH_PATTERN_SOLID
    )
    const acadIsoSolid = AcDbPredefinedAcadIsoPat.patterns.find(
      pattern => pattern.name === HATCH_PATTERN_SOLID
    )

    expect(acadSolid?.lines).toEqual([])
    expect(acadIsoSolid?.lines).toEqual([])
  })
})

describe('AcDbPatSvgRenderer', () => {
  it('renders SOLID as an area fill', () => {
    const solid = AcDbPredefinedAcadPat.patterns.find(
      pattern => pattern.name === HATCH_PATTERN_SOLID
    )
    expect(solid).toBeDefined()

    const svg = new AcDbPatSvgRenderer().renderPattern(solid!, {
      width: 20,
      height: 10,
      stroke: '#123456',
      background: '#abcdef'
    })

    expect(svg).toContain('fill="#abcdef"')
    expect(svg).toContain('fill="#123456"')
    expect(svg).not.toContain('<path')
  })

  it('keeps non-SOLID empty patterns visually empty', () => {
    const svg = new AcDbPatSvgRenderer().renderPattern(
      {
        name: 'EMPTY',
        lines: []
      },
      {
        width: 20,
        height: 10,
        stroke: '#123456',
        background: '#abcdef'
      }
    )

    expect(svg).toContain('fill="#abcdef"')
    expect(svg).not.toContain('fill="#123456"')
    expect(svg).not.toContain('<path')
  })
})
