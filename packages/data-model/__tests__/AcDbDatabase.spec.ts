import { AcCmColor, AcCmColorMethod } from '@mlightcad/common'

import { acdbHostApplicationServices } from '../src/base/AcDbHostApplicationServices'
import { AcDbOpenDatabaseError } from '../src/database/AcDbOpenDatabaseError'
import { AcDbDatabase } from '../src/database/AcDbDatabase'
import { AcDbDatabaseConverterManager } from '../src/database/AcDbDatabaseConverterManager'
import { AcDbLayerTableRecord } from '../src/database/AcDbLayerTableRecord'
import { AcDbTextStyleTableRecord } from '../src/database/AcDbTextStyleTableRecord'
import { DEFAULT_TEXT_STYLE } from '../src/misc/AcDbConstants'
import { AcDbSystemVariables } from '../src/database/AcDbSystemVariables'
import { AcDbSysVarManager } from '../src/database/AcDbSysVarManager'
import { expectDetachedClone } from '../test-utils/cloneTestUtils'

describe('AcDbDatabase', () => {
  it('creates a detached clone with a new objectId', () => {
    expectDetachedClone(() => new AcDbDatabase())
  })

  it('assigns sequential default DWGNAME values to new databases', () => {
    const db1 = new AcDbDatabase()
    const db2 = new AcDbDatabase()

    expect(db1.dwgname).toMatch(/^Drawing\d+\.dwg$/)
    expect(db2.dwgname).toMatch(/^Drawing\d+\.dwg$/)
    expect(db1.dwgname).not.toBe(db2.dwgname)
  })

  it('updates DWGNAME when setDwgName is called', () => {
    const db = new AcDbDatabase()
    const manager = AcDbSysVarManager.instance()

    db.setDwgName('Site Plan.dxf')
    expect(db.dwgname).toBe('Site Plan.dxf')
    expect(manager.getVar(AcDbSystemVariables.DWGNAME, db)).toBe(
      'Site Plan.dxf'
    )
  })

  it('reassigns symbol-table handles that collide across tables', () => {
    const db = new AcDbDatabase()
    acdbHostApplicationServices().workingDatabase = db
    const textStyle = new AcDbTextStyleTableRecord({
      name: DEFAULT_TEXT_STYLE,
      font: 'SimKai'
    })
    db.tables.textStyleTable.add(textStyle)

    const layer = new AcDbLayerTableRecord({
      name: '0',
      isOff: false,
      isPlottable: true,
      color: new AcCmColor(AcCmColorMethod.ByACI, 7),
      linetype: 'Continuous'
    })
    layer.objectId = textStyle.objectId
    const preferredLayerId = layer.objectId
    db.tables.layerTable.add(layer)

    expect(layer.objectId).toBe(preferredLayerId)
    expect(textStyle.objectId).not.toBe(layer.objectId)
    expect(db.tables.layerTable.getIdAt(layer.objectId)).toBe(layer)
    expect(db.tables.textStyleTable.getIdAt(textStyle.objectId)).toBe(textStyle)
  })

  it('initializes handle seed from hexadecimal HANDSEED values', () => {
    const db = new AcDbDatabase()
    db.initializeHandleSeed('FFFF')
    expect(db.generateHandle()).toBe('FFFF')
  })

  it('continues reading when font loading fails by default', async () => {
    const db = new AcDbDatabase()
    const fileType = 'test-font-load'
    const fontLoader = {
      load: jest.fn().mockRejectedValue(new Error('Failed to fetch')),
      getAvaiableFonts: jest.fn().mockResolvedValue([])
    }
    const converter = {
      read: jest.fn(
        async (
          _data: ArrayBuffer,
          _db: AcDbDatabase,
          _minimumChunkSize: number,
          progress?: (
            percentage: number,
            stage: string,
            stageStatus: string,
            data?: unknown
          ) => Promise<void>
        ) => {
          if (progress) {
            await progress(5, 'FONT', 'END', ['arial'])
          }
        }
      )
    }
    const manager = AcDbDatabaseConverterManager.instance
    manager.register(fileType, converter as never)

    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})

    try {
      await expect(
        db.read(new ArrayBuffer(0), { fontLoader, readOnly: true }, fileType)
      ).resolves.toBeUndefined()
      expect(fontLoader.load).toHaveBeenCalledWith(['arial'])
      expect(warnSpy).toHaveBeenCalled()
    } finally {
      warnSpy.mockRestore()
      manager.unregister(fileType)
    }
  })

  it('aborts reading when font loading fails and failOnFontLoadError is true', async () => {
    const db = new AcDbDatabase()
    const fileType = 'test-font-load-strict'
    const loadError = new Error('Failed to fetch')
    const fontLoader = {
      load: jest.fn().mockRejectedValue(loadError),
      getAvaiableFonts: jest.fn().mockResolvedValue([])
    }
    const converter = {
      read: jest.fn(
        async (
          _data: ArrayBuffer,
          _db: AcDbDatabase,
          _minimumChunkSize: number,
          progress?: (
            percentage: number,
            stage: string,
            stageStatus: string,
            data?: unknown
          ) => Promise<void>
        ) => {
          if (progress) {
            await progress(5, 'FONT', 'END', ['arial'])
          }
        }
      )
    }
    const manager = AcDbDatabaseConverterManager.instance
    manager.register(fileType, converter as never)

    try {
      await expect(
        db.read(
          new ArrayBuffer(0),
          { fontLoader, readOnly: true, failOnFontLoadError: true },
          fileType
        )
      ).rejects.toThrow('Failed to fetch')
    } finally {
      manager.unregister(fileType)
    }
  })

  it('exposes worker OOM failures via lastOpenError, openFailed, and openProgress', async () => {
    const db = new AcDbDatabase()
    const fileType = 'test-open-failure'
    const oomError = new AcDbOpenDatabaseError(
      "Failed to parse drawing due to error: 'Data cannot be cloned, out of memory.'",
      'worker_oom',
      { stage: 'PARSE' }
    )
    const converter = {
      read: jest.fn(
        async (
          _data: ArrayBuffer,
          _db: AcDbDatabase,
          _minimumChunkSize: number,
          progress?: (
            percentage: number,
            stage: string,
            stageStatus: string,
            data?: unknown,
            taskError?: { error: unknown; task: { name: string }; taskIndex: number }
          ) => Promise<void>
        ) => {
          if (progress) {
            await progress(5, 'PARSE', 'ERROR', undefined, {
              error: oomError,
              task: { name: 'PARSE' },
              taskIndex: 1
            })
          }
          throw oomError
        }
      )
    }
    const manager = AcDbDatabaseConverterManager.instance
    manager.register(fileType, converter as never)

    const openFailed = jest.fn()
    const openProgress = jest.fn()
    db.events.openFailed.addEventListener(openFailed)
    db.events.openProgress.addEventListener(openProgress)

    try {
      await expect(
        db.read(new ArrayBuffer(0), { readOnly: true }, fileType)
      ).rejects.toMatchObject({ code: 'worker_oom' })

      expect(db.lastOpenError?.code).toBe('worker_oom')
      expect(openFailed).toHaveBeenCalledWith(
        expect.objectContaining({
          database: db,
          error: expect.objectContaining({ code: 'worker_oom' })
        })
      )
      expect(openProgress).toHaveBeenCalledWith(
        expect.objectContaining({
          subStageStatus: 'ERROR',
          data: expect.objectContaining({ code: 'worker_oom' })
        })
      )
    } finally {
      manager.unregister(fileType)
    }
  })
})
