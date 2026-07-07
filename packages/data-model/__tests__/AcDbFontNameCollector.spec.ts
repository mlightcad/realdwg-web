import { AcDbFontNameCollector } from '../src/converter/AcDbFontNameCollector'

describe('AcDbFontNameCollector', () => {
  it('normalizes font file names', () => {
    expect(AcDbFontNameCollector.normalizeFontFileName('Arial.ttf')).toBe(
      'arial'
    )
    expect(AcDbFontNameCollector.normalizeFontFileName('SIMHEI')).toBe('simhei')
    expect(AcDbFontNameCollector.normalizeFontFileName('')).toBeUndefined()
    expect(
      AcDbFontNameCollector.normalizeFontFileName(undefined)
    ).toBeUndefined()
  })

  it('collects fonts from styles, inline mtext, and nested blocks', () => {
    const fonts = new AcDbFontNameCollector({
      styles: [
        {
          name: 'A',
          font: 'Arial.ttf',
          bigFont: 'Bigfont.shx',
          extendedFont: 'Ext.ttf'
        }
      ],
      textStyleVar: 'A'
    }).collect(
      [
        { type: 'TEXT', styleName: 'A' },
        { type: 'MTEXT', styleName: 'A', text: '{\\fCustom|b0|i0;Hello}' },
        { type: 'INSERT', name: 'B1' }
      ],
      {
        getEntityFontInfo: entity => {
          if (entity.type === 'TEXT') {
            return { styleName: entity.styleName, resolveStyle: true }
          }
          if (entity.type === 'MTEXT') {
            return {
              styleName: entity.styleName,
              formattedText: entity.text,
              resolveStyle: true
            }
          }
          if (entity.type === 'INSERT') {
            return { blockName: entity.name }
          }
          return null
        },
        getBlockEntities: blockName =>
          blockName === 'B1' ? [{ type: 'TEXT', styleName: 'A' }] : undefined
      }
    )

    expect(fonts).toEqual(
      expect.arrayContaining(['arial', 'bigfont', 'ext', 'custom'])
    )
  })

  it('resolves style font names with TEXTSTYLE fallback', () => {
    const fonts = new AcDbFontNameCollector({
      styles: [
        { name: 'Standard', font: 'txt.shx' },
        { name: 'Named', font: 'simplex.shx' }
      ],
      textStyleVar: 'Standard'
    }).collect(
      [
        { type: 'MTEXT', text: 'Hello' },
        { type: 'TEXT', styleName: 'Named' }
      ],
      {
        getEntityFontInfo: entity => {
          if (entity.type === 'MTEXT') {
            return { formattedText: entity.text, resolveStyle: true }
          }
          if (entity.type === 'TEXT') {
            return { styleName: entity.styleName, resolveStyle: true }
          }
          return null
        }
      }
    )

    expect(fonts).toEqual(expect.arrayContaining(['txt', 'simplex']))
  })

  it('collects inline mtext fonts from both pipe and semicolon overrides', () => {
    const fonts = new AcDbFontNameCollector({ styles: [] }).collect(
      [
        {
          type: 'TOLERANCE',
          text: '{\\Fgdt.shx|b0|i0|c134|p6;j}|0.05|A|'
        },
        {
          type: 'TOLERANCE',
          text: '{\\Fgdt;r}%%v{\\Fgdt;n}0.05%%v%%vA%%v%%v%%v^J'
        }
      ],
      {
        getEntityFontInfo: entity => ({
          formattedText: entity.text
        })
      }
    )

    expect(fonts).toEqual(expect.arrayContaining(['gdt.shx', 'gdt']))
  })

  it('collects fonts from every named style table entry', () => {
    const fonts = new AcDbFontNameCollector({
      styles: [
        { name: 'Standard', font: 'txt.shx', bigFont: 'gbcbig.shx' },
        { name: 'Romans', font: 'romans.shx', standardFlag: 0 },
        { name: '', font: 'tecosymbol.shx', standardFlag: 1 }
      ]
    }).collect([], {
      getEntityFontInfo: () => null
    })

    expect(fonts).toEqual(
      expect.arrayContaining(['txt', 'gbcbig', 'romans', 'tecosymbol'])
    )
  })

  it('collects shape-definition fonts from the style table', () => {
    const fonts = new AcDbFontNameCollector({
      styles: [
        { name: '', font: 'tecosymbol.shx', standardFlag: 1 },
        { name: 'pipe', font: 'romans.shx', standardFlag: 0 }
      ]
    }).collect([], {
      getEntityFontInfo: () => null
    })

    expect(fonts).toEqual(['tecosymbol', 'romans'])
  })
})
