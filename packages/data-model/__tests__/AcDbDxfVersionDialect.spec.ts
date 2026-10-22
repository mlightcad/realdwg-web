import { AcCmColor, AcCmTransparency } from '@mlightcad/common'
import { AcGePoint2d, AcGePoint3d } from '@mlightcad/geometry-engine'
import { AcGiLineWeight } from '@mlightcad/graphic-interface'

import { acdbHostApplicationServices } from '../src/base'
import { AcDbDxfFiler } from '../src/base/AcDbDxfFiler'
import { AcDbDatabase } from '../src/database/AcDbDatabase'
import { AcDbLine } from '../src/entity/AcDbLine'
import { AcDbPolyline } from '../src/entity/AcDbPolyline'
import { AcDbText } from '../src/entity/AcDbText'

function createDbWithStyledLine() {
  const db = new AcDbDatabase()
  acdbHostApplicationServices().workingDatabase = db
  db.createDefaultData()
  const line = new AcDbLine(new AcGePoint3d(0, 0, 0), new AcGePoint3d(10, 0, 0))
  line.layer = '0'
  const color = new AcCmColor()
  color.setRGB(255, 0, 0)
  line.color = color
  line.lineWeight = AcGiLineWeight.LineWeight050
  line.transparency = new AcCmTransparency(128)
  db.tables.blockTable.modelSpace.appendEntity(line)
  return db
}

describe('AcDbDxf version write dialect', () => {
  it('omits post-version entity fields for AC1015', () => {
    const db = createDbWithStyledLine()
    const dxf = db.dxfOut(undefined, 6, 'AC1015') as string
    expect(dxf).toContain('$ACADVER\n1\nAC1015')
    expect(dxf).not.toContain('\n420\n')
    expect(dxf).not.toContain('\n440\n')
    expect(dxf).toContain('$DWGCODEPAGE\n3\nANSI_1252')
    // AC1015 still has lineweight
    expect(dxf).toContain('\n370\n')
  })

  it('writes AutoCAD-2000-compatible AC1015 headers and structure (#270)', () => {
    const db = new AcDbDatabase()
    acdbHostApplicationServices().workingDatabase = db
    db.createDefaultData()

    const text = new AcDbText()
    text.position = new AcGePoint3d(10, 20, 0)
    text.textString = 'Hello'
    text.height = 2.5
    text.styleName = 'Standard'
    db.tables.blockTable.modelSpace.appendEntity(text)

    const dxf = db.dxfOut(undefined, 6, 'AC1015') as string

    // $LWDISPLAY must use boolean group 290 (not 70) — AutoCAD 2007 Error 50.
    expect(dxf).toContain('9\n$LWDISPLAY\n290\n')
    expect(dxf).not.toMatch(/9\n\$LWDISPLAY\n70\n/)

    // Post-R2000 header vars / objects must be omitted.
    expect(dxf).not.toContain('$CMLEADERSTYLE')
    expect(dxf).not.toContain('$HPCOLOR')
    expect(dxf).not.toContain('$HPLAYER')
    expect(dxf).not.toContain('0\nMLEADERSTYLE\n')

    // BLOCK_RECORD units/explodability flags are R2007+.
    const blockRecordIdx = dxf.indexOf('0\nBLOCK_RECORD\n')
    expect(blockRecordIdx).toBeGreaterThanOrEqual(0)
    const modelSpaceIdx = dxf.indexOf('2\n*Model_Space\n', blockRecordIdx)
    const nextRecord = dxf.indexOf('\n0\n', modelSpaceIdx + 1)
    const modelSpaceRecord = dxf.slice(blockRecordIdx, nextRecord)
    expect(modelSpaceRecord).not.toMatch(/\n280\n/)
    expect(modelSpaceRecord).not.toMatch(/\n281\n/)

    // Required paper space + empty group dictionary.
    expect(dxf).toContain('2\n*Paper_Space\n')
    expect(dxf).toContain('1\nLayout1\n')
    expect(dxf).toContain('3\nACAD_GROUP\n')

    // $HANDSEED must be above every handle used in the file.
    const handseedMatch = dxf.match(/9\n\$HANDSEED\n5\n([0-9A-Fa-f]+)\n/)
    expect(handseedMatch).toBeTruthy()
    const handseed = Number.parseInt(handseedMatch![1], 16)
    // Only object/entity handles (0/TYPE/5/HANDLE), not other group-5 lookalikes.
    const handles = [
      ...dxf.matchAll(/\n0\n[A-Z][A-Z0-9_]*\n5\n([0-9A-Fa-f]+)\n/g)
    ].map(m => Number.parseInt(m[1], 16))
    expect(handles.length).toBeGreaterThan(0)
    expect(handseed).toBeGreaterThan(Math.max(...handles))

    // Extents are populated from geometry (not left as empty/0,0,0).
    expect(dxf).toMatch(/9\n\$EXTMIN\n10\n/)
    expect(dxf).not.toMatch(/9\n\$EXTMIN\n10\n0\n20\n0\n30\n0\n9\n\$EXTMAX\n10\n0\n/)

    // TEXT: dual AcDbText markers, baseline default, no bogus thickness 1.
    // Avoid `\n0\n` alone — layer name "0" (`8\n0\n`) is a false end marker.
    const textMatch = dxf.match(
      /0\nTEXT\n[\s\S]*?(?=\n0\n(?:ENDSEC|[A-Z_]+\n))/
    )
    expect(textMatch).toBeTruthy()
    const textRecord = textMatch![0]
    expect(textRecord).toMatch(/100\nAcDbText[\s\S]*100\nAcDbText\n73\n0/)
    expect(textRecord).not.toContain('\n39\n1\n')
    expect(textRecord).toContain('10\n10\n20\n20\n')

    // Exporting AC1015 must not permanently strip MLEADERSTYLE from the live DB.
    db.objects.dictionary.setAt('ACAD_MLEADERSTYLE', db.objects.mleaderStyle)
    expect(db.objects.mleaderStyle.numEntries).toBeGreaterThan(0)
    db.dxfOut(undefined, 6, 'AC1015')
    expect(db.objects.dictionary.getAt('ACAD_MLEADERSTYLE')).toBe(
      db.objects.mleaderStyle
    )
  })

  it('emits true color / transparency for AC1018+', () => {
    const db = createDbWithStyledLine()
    const dxf = db.dxfOut(undefined, 6, 'AC1018') as string
    expect(dxf).toContain('\n420\n')
    expect(dxf).toContain('\n440\n')
    expect(dxf).toContain('$DWGCODEPAGE\n3\nANSI_1252')
  })

  it('emits $DWGCODEPAGE for AC1021+', () => {
    const db = createDbWithStyledLine()
    const dxf = db.dxfOut(undefined, 6, 'AC1021') as string
    expect(dxf).toContain('$DWGCODEPAGE\n3\nUTF-8')
  })

  it('preserves source $DWGCODEPAGE for pre-UTF8 targets', () => {
    const db = createDbWithStyledLine()
    db.dwgCodePage = 'ANSI_936'
    const dxf = db.dxfOut(undefined, 6, 'AC1009') as string
    expect(dxf).toContain('$DWGCODEPAGE\n3\nANSI_936')
  })

  it('skips subclass markers and BLOCK_RECORD for AC1009', () => {
    const db = createDbWithStyledLine()
    const dxf = db.dxfOut(undefined, 6, 'AC1009') as string
    // Avoid matching numeric values like VPORT circle-zoom `71\n100`.
    expect(dxf).not.toMatch(/\n100\nAcDb/)
    expect(dxf).not.toContain('BLOCK_RECORD')
    expect(dxf).not.toContain('0\nSECTION\n2\nCLASSES')
    expect(dxf).not.toContain('0\nSECTION\n2\nOBJECTS')
  })

  it('writeSubclassMarker is a no-op without subclass capability', () => {
    const filer = new AcDbDxfFiler({ version: 'AC1009' })
    filer.writeSubclassMarker('AcDbLine')
    expect(filer.toString()).toBe('\n')
  })

  it('downgrades LWPOLYLINE to POLYLINE+VERTEX for AC1009', () => {
    const db = new AcDbDatabase()
    acdbHostApplicationServices().workingDatabase = db
    db.createDefaultData()
    const pl = new AcDbPolyline()
    pl.addVertexAt(0, new AcGePoint2d(0, 0))
    pl.addVertexAt(1, new AcGePoint2d(1, 0))
    pl.addVertexAt(2, new AcGePoint2d(1, 1))
    pl.closed = true
    db.tables.blockTable.modelSpace.appendEntity(pl)

    const dxf = db.dxfOut(undefined, 6, 'AC1009') as string
    expect(dxf).toContain('0\nPOLYLINE\n')
    expect(dxf).toContain('0\nVERTEX\n')
    expect(dxf).toContain('0\nSEQEND\n')
    expect(dxf).not.toContain('0\nLWPOLYLINE\n')
  })
})
