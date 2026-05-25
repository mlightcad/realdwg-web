import { acdbHostApplicationServices } from '../src/base/AcDbHostApplicationServices'
import { AcDbDatabase } from '../src/database/AcDbDatabase'
import { AcDbTextStyleTableRecord } from '../src/database/AcDbTextStyleTableRecord'
import { AcDbText } from '../src/entity/AcDbText'
import type { AcGiTextStyle } from '@mlightcad/graphic-interface'

function encodeUtf8(text: string): ArrayBuffer {
  const bytes = new TextEncoder().encode(text)
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength
  ) as ArrayBuffer
}

function makeTextStyle(name: string, font = 'Arial'): AcGiTextStyle {
  return {
    name,
    standardFlag: 0,
    fixedTextHeight: 0,
    widthFactor: 1,
    obliqueAngle: 0,
    textGenerationFlag: 0,
    lastHeight: 0.2,
    font,
    bigFont: '',
    extendedFont: font
  }
}

const MINIMAL_DXF_NO_STYLE_TABLE = `0
SECTION
2
HEADER
9
$ACADVER
1
AC1015
9
$TEXTSTYLE
7
STANDARD
0
ENDSEC
0
SECTION
2
TABLES
0
TABLE
2
LAYER
70
1
0
LAYER
2
0
70
0
62
7
6
CONTINUOUS
0
ENDTAB
0
TABLE
2
LTYPE
70
1
0
LTYPE
2
CONTINUOUS
70
0
3
Solid
72
65
73
0
40
0
0
ENDTAB
0
ENDSEC
0
SECTION
2
ENTITIES
0
TEXT
8
0
10
0
20
0
30
0
40
2.5
1
Hello
7
STANDARD
0
ENDSEC
0
EOF
`

describe('text style resolution', () => {
  it('loads TEXT referencing STANDARD when STYLE table is missing', async () => {
    const db = new AcDbDatabase()
    acdbHostApplicationServices().workingDatabase = db
    await db.read(encodeUtf8(MINIMAL_DXF_NO_STYLE_TABLE), {
      readOnly: true,
      minimumChunkSize: 1
    })

    const texts = [
      ...db.tables.blockTable.modelSpace.newIterator()
    ] as AcDbText[]
    expect(texts).toHaveLength(1)
    expect(texts[0].styleName).toBe('STANDARD')

    const renderer = { mtext: jest.fn(() => ({})) }
    expect(() => texts[0].subWorldDraw(renderer as never)).not.toThrow()
    expect(renderer.mtext).toHaveBeenCalled()
  })

  it('resolves text styles before database defaults run at end of read', () => {
    const db = new AcDbDatabase()
    acdbHostApplicationServices().workingDatabase = db

    const text = new AcDbText()
    text.textString = 'Hello'
    text.styleName = 'STANDARD'
    db.tables.blockTable.modelSpace.appendEntity(text)

    const renderer = { mtext: jest.fn(() => ({})) }
    expect(() => text.subWorldDraw(renderer as never)).not.toThrow()
    expect(renderer.mtext).toHaveBeenCalled()
    expect(db.tables.textStyleTable.getAt('Standard')).toBeDefined()
  })

  it('matches text styles case-insensitively', () => {
    const db = new AcDbDatabase()
    acdbHostApplicationServices().workingDatabase = db
    db.tables.textStyleTable.add(
      new AcDbTextStyleTableRecord(makeTextStyle('STANDARD', 'Arial'))
    )

    const resolved = db.tables.textStyleTable.resolveAt('standard')
    expect(resolved?.name).toBe('STANDARD')
  })
})
