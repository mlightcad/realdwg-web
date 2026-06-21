import {
  addInlineMTextFonts,
  addResolvedStyleFonts,
  buildStyleFontMap,
  collectShapeDefinitionFonts,
  collectStyleEntryFontNames,
  normalizeFontFileName,
  resolveStyleFontNames
} from '../src/misc/AcDbFontUtil'

describe('AcDbFontUtil', () => {
  it('normalizes font file names', () => {
    expect(normalizeFontFileName('Arial.ttf')).toBe('arial')
    expect(normalizeFontFileName('SIMHEI')).toBe('simhei')
    expect(normalizeFontFileName('')).toBeUndefined()
    expect(normalizeFontFileName(undefined)).toBeUndefined()
  })

  it('collects font names from style entry fields', () => {
    expect(
      collectStyleEntryFontNames({
        font: 'txt.shx',
        bigFont: 'hztxt.shx',
        extendedFont: 'Ext.ttf'
      })
    ).toEqual(['txt', 'hztxt', 'ext'])
  })

  it('builds a style font map', () => {
    const styleMap = buildStyleFontMap([
      { name: 'Standard', font: 'txt.shx' },
      { name: 'Named', font: 'simplex.shx', bigFont: 'gbcbig.shx' }
    ])

    expect(styleMap.get('Standard')).toEqual(['txt'])
    expect(styleMap.get('Named')).toEqual(['simplex', 'gbcbig'])
  })

  it('collects shape definition fonts', () => {
    expect(
      collectShapeDefinitionFonts([
        { font: 'tecosymbol.shx', standardFlag: 1 },
        { font: 'romans.shx', standardFlag: 0 }
      ])
    ).toEqual(['tecosymbol'])
  })

  it('resolves style font names with TEXTSTYLE fallback', () => {
    const styleMap = buildStyleFontMap([
      { name: 'Standard', font: 'txt.shx' },
      { name: 'Named', font: 'simplex.shx' }
    ])

    expect(resolveStyleFontNames(undefined, styleMap, 'Standard')).toEqual([
      'txt'
    ])
    expect(resolveStyleFontNames('Named', styleMap, 'Standard')).toEqual([
      'simplex'
    ])
    expect(resolveStyleFontNames('missing', styleMap, 'Standard')).toEqual([
      'txt'
    ])
  })

  it('adds resolved and inline fonts to a set', () => {
    const styleMap = buildStyleFontMap([{ name: 'A', font: 'arial.ttf' }])
    const fonts = new Set<string>()

    addResolvedStyleFonts('A', styleMap, 'Standard', fonts)
    addInlineMTextFonts('{\\fCustom|b0|i0;Hello}', fonts)

    expect(fonts).toEqual(new Set(['arial', 'custom']))
  })
})
