import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { AcDbDatabase } from '../src/database/AcDbDatabase'
import { AcDbFileType } from '../src/database/AcDbDatabaseConverterManager'
import { AcDbMText } from '../src/entity/AcDbMText'
import { AcDbViewport } from '../src/entity/AcDbViewport'
import {
  acdbAnnotativeModelHeight,
  acdbAnnotativePaperHeight,
  acdbGetAnnotative,
  acdbGetAnnotationScaleContexts,
  acdbGetViewportAnnotationScale,
  acdbIsAnnotativeObject,
  acdbMatchAnnotationScaleContext,
  acdbSetAnnotative
} from '../src/misc/AcDbAnnotationScale'
import { AcDbOsnapMode } from '../src/misc/AcDbOsnapMode'
import { AcDbDictionary } from '../src/object/AcDbDictionary'
import { AcDbMTextObjectContextData } from '../src/object/AcDbMTextObjectContextData'
import { AcDbScale } from '../src/object/AcDbScale'

const FIXTURE = join(
  __dirname,
  'fixtures',
  'annotative-min.dxf'
)

async function openFixture(): Promise<AcDbDatabase> {
  const buf = readFileSync(FIXTURE)
  const db = new AcDbDatabase()
  await db.read(
    buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
    { readOnly: true },
    AcDbFileType.DXF
  )
  return db
}

describe('annotation scale support (#749)', () => {
  it('reads SCALE list, CANNOSCALE, context data, and viewport scales', async () => {
    const db = await openFixture()

    expect(db.cannoscale).toBe('1:100')
    expect(db.objects.scale.numEntries).toBeGreaterThanOrEqual(3)

    const scale50 = [...db.objects.scale.entries()].find(
      ([, s]) => s.scaleName === '1:50'
    )?.[1]
    const scale100 = [...db.objects.scale.entries()].find(
      ([, s]) => s.scaleName === '1:100'
    )?.[1]
    expect(scale50).toBeInstanceOf(AcDbScale)
    expect(scale100).toBeInstanceOf(AcDbScale)
    expect(scale50!.scaleFactor).toBe(50)
    expect(scale100!.scaleFactor).toBe(100)

    const mtexts: AcDbMText[] = []
    for (const e of db.tables.blockTable.modelSpace.newIterator()) {
      if (e instanceof AcDbMText) mtexts.push(e)
    }
    expect(mtexts).toHaveLength(2)

    const textA = mtexts.find(t => t.contents === 'A')!
    const textB = mtexts.find(t => t.contents === 'B')!
    expect(acdbIsAnnotativeObject(textA)).toBe(true)
    expect(acdbIsAnnotativeObject(textB)).toBe(true)
    expect(textA.annotative).toBe(true)
    expect(textB.annotative).toBe(true)
    expect(acdbGetAnnotative(textA)).toBe(true)

    // Extension dictionaries and context objects must resolve by handle.
    expect(textA.extensionDictionary).toBeTruthy()
    const extA = db.getObjectById(textA.extensionDictionary!)
    expect(extA).toBeInstanceOf(AcDbDictionary)

    const contextsA = acdbGetAnnotationScaleContexts(textA)
    expect(contextsA).toHaveLength(2)
    expect(contextsA.every(c => c.contextData instanceof AcDbMTextObjectContextData)).toBe(
      true
    )
    const contextsB = acdbGetAnnotationScaleContexts(textB)
    expect(contextsB).toHaveLength(1)

    const paperA = acdbAnnotativePaperHeight(textA.height, contextsA)
    expect(paperA).toBeCloseTo(2.5, 6)
    const matched100 = acdbMatchAnnotationScaleContext(contextsA, '1:100')
    expect(matched100?.scale.scaleName).toBe('1:100')
    expect(
      acdbAnnotativeModelHeight(paperA, matched100!.scale.scaleFactor)
    ).toBeCloseTo(250, 6)

    const layout1 = db.objects.layout.getAt('Layout1')
    expect(layout1?.blockTableRecordId).toBeTruthy()
    const paperSpace = db.tables.blockTable.getIdAt(layout1!.blockTableRecordId)
    expect(paperSpace).toBeTruthy()

    const viewports: AcDbViewport[] = []
    for (const e of paperSpace!.newIterator()) {
      if (e instanceof AcDbViewport) viewports.push(e)
    }
    const userViewports = viewports.filter(v => {
      const scale = acdbGetViewportAnnotationScale(v)
      return !!scale
    })
    expect(userViewports.length).toBeGreaterThanOrEqual(2)

    const scales = userViewports
      .map(v => acdbGetViewportAnnotationScale(v)?.scaleName)
      .filter(Boolean)
      .sort()
    expect(scales).toEqual(['1:100', '1:50'])

    const gi50 = userViewports
      .find(v => acdbGetViewportAnnotationScale(v)?.scaleName === '1:50')!
      .toGiViewport()
    expect(gi50.annotationScaleName).toBe('1:50')
    expect(gi50.annotationScaleFactor).toBe(50)

    const gi100 = userViewports
      .find(v => acdbGetViewportAnnotationScale(v)?.scaleName === '1:100')!
      .toGiViewport()
    expect(gi100.annotationScaleName).toBe('1:100')
    expect(gi100.annotationScaleFactor).toBe(100)
  })

  it('draws MTEXT at CANNOSCALE height and attaches annotation metadata', async () => {
    const db = await openFixture()
    const textA = [...db.tables.blockTable.modelSpace.newIterator()].find(
      e => e instanceof AcDbMText && e.contents === 'A'
    ) as AcDbMText

    const calls: Array<{ text: string; height: number }> = []
    const drawableUserData: { annotationScale?: unknown } = {}
    const renderer = {
      context: { database: db },
      subEntityTraits: {},
      mtext: (data: { text: string; height: number }) => {
        calls.push({ text: data.text, height: data.height })
        return { userData: drawableUserData }
      }
    }

    textA.subWorldDraw(renderer as never)
    expect(calls).toHaveLength(1)
    // CANNOSCALE is 1:100 → model height 250 for paper height 2.5
    expect(calls[0].height).toBeCloseTo(250, 6)
    expect(drawableUserData.annotationScale).toMatchObject({
      drawnScaleFactor: 100,
      drawnScaleName: '1:100',
      supportedScaleFactors: expect.arrayContaining([50, 100])
    })
  })

  it('uses annotative height and context insertion for extents and osnap', async () => {
    const db = await openFixture()
    const textA = [...db.tables.blockTable.modelSpace.newIterator()].find(
      e => e instanceof AcDbMText && e.contents === 'A'
    ) as AcDbMText

    const contexts = acdbGetAnnotationScaleContexts(textA)
    const matched100 = acdbMatchAnnotationScaleContext(contexts, '1:100')!
    const mtextCtx = matched100.contextData as AcDbMTextObjectContextData
    const ctxPoint = mtextCtx.insertionPoint

    // Stored height is 125 (1:50 default); CANNOSCALE 1:100 draws at 250.
    expect(textA.height).toBeCloseTo(125, 6)
    const extents = textA.geometricExtents
    // Extents must be large enough for the drawn (scaled) height, not the stored one.
    expect(extents.max.y - extents.min.y).toBeGreaterThan(200)

    const snapPoints: Array<{ x: number; y: number; z: number }> = []
    textA.subGetOsnapPoints(
      AcDbOsnapMode.Insertion,
      { x: 0, y: 0, z: 0 },
      { x: 0, y: 0, z: 0 },
      snapPoints
    )
    expect(snapPoints).toHaveLength(1)
    expect(snapPoints[0].x).toBeCloseTo(ctxPoint.x, 6)
    expect(snapPoints[0].y).toBeCloseTo(ctxPoint.y, 6)

    const grips = textA.subGetGripPoints()
    expect(grips[0].x).toBeCloseTo(ctxPoint.x, 6)
    expect(grips[0].y).toBeCloseTo(ctxPoint.y, 6)
  })

  it('supports get/set annotative via AcadAnnotative XDATA', async () => {
    const db = await openFixture()
    const textA = [...db.tables.blockTable.modelSpace.newIterator()].find(
      e => e instanceof AcDbMText && e.contents === 'A'
    ) as AcDbMText

    expect(textA.annotative).toBe(true)
    textA.annotative = false
    expect(acdbIsAnnotativeObject(textA)).toBe(false)
    expect(acdbGetAnnotative(textA)).toBe(false)
    expect(textA.annotative).toBe(false)
    expect(acdbGetAnnotationScaleContexts(textA)).toHaveLength(0)

    const plain = new AcDbMText()
    plain.database = db
    expect(plain.annotative).toBe(false)
    acdbSetAnnotative(plain, true)
    expect(acdbIsAnnotativeObject(plain)).toBe(true)
    expect(plain.annotative).toBe(true)
  })
})
