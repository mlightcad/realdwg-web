import { AcDbDxfFiler } from '../base/AcDbDxfFiler'
import type { AcDbDatabase } from '../database/AcDbDatabase'
import {
  type AcDbConversionProgressCallback,
  AcDbDatabaseConverter,
  type AcDbDatabaseConverterConfig
} from '../database/AcDbDatabaseConverter'
import { AcDbDxfDocumentReader } from './AcDbDxfDocumentReader'

/**
 * Native DXF → database converter.
 *
 * Streams DXF pairs through {@link AcDbDxfFiler} / {@link AcDbDxfDocumentReader}
 * directly into {@link AcDbDatabase}, avoiding the ParsedDxf JSON intermediate
 * used by `@mlightcad/dxf-json-converter`.
 *
 * Conversion stages mirror {@link AcDbDatabaseConverter}:
 * `START → PARSE → FONT → ENTITY → END`. The reader fills the database quietly
 * (entity-appended events batched); fonts load on FONT; then the batch flushes
 * so the first draw happens with fonts already available — no mid-parse FONT
 * or post-open regen.
 */
export class AcDbNativeDxfConverter extends AcDbDatabaseConverter<null> {
  constructor(config: AcDbDatabaseConverterConfig = {}) {
    super({
      useWorker: false,
      ...config
    })
  }

  override async read(
    data: ArrayBuffer,
    db: AcDbDatabase,
    minimumChunkSize: number,
    progress?: AcDbConversionProgressCallback,
    _timeout?: number,
    _sysVars?: Record<string, number | boolean | string>
  ) {
    this.progress = progress

    const emit = async (
      percentage: number,
      stage: Parameters<AcDbConversionProgressCallback>[1],
      status: Parameters<AcDbConversionProgressCallback>[2],
      stageData?: unknown
    ) => {
      if (!progress) return
      await progress(percentage, stage, status, stageData)
    }

    await emit(0, 'START', 'START')
    await emit(5, 'PARSE', 'START')

    // Suppress entityAppended (and related) until FONT finishes so the viewer
    // does not worldDraw text before fontLoader.load has run.
    db.beginEventBatch()
    let batchOpen = true
    try {
      const filer = AcDbDxfFiler.fromBuffer(data, { database: db })
      const reader = new AcDbDxfDocumentReader(db, {
        entityBatchSize: Math.max(1, minimumChunkSize || 200)
        // No progress callback: this converter owns all stage events.
      })
      const result = await reader.read(filer)

      await emit(40, 'PARSE', 'END')

      // Same FONT contract as AcDbDxfConverter / AcDbDatabaseConverter.
      await emit(45, 'FONT', 'START')
      await emit(50, 'FONT', 'END', result.fonts)

      await emit(60, 'ENTITY', 'START')
      // Flush queued entityAppended → first draw with fonts loaded.
      db.endEventBatch()
      batchOpen = false
      await emit(95, 'ENTITY', 'END')

      await emit(100, 'END', 'END')
    } catch (error) {
      if (batchOpen) {
        db.endEventBatch()
      }
      throw error
    }
  }

  protected override async parse(_data: ArrayBuffer) {
    return { model: null, data: { unknownEntityCount: 0 } }
  }

  protected override getFonts(_model: null): string[] {
    return []
  }
}
