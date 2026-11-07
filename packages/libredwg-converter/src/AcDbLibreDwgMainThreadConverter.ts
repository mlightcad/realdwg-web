import type {
  AcDbDatabaseConverterConfig,
  AcDbParsingTaskResult
} from '@mlightcad/data-model'
import type { DwgDatabase } from '@mlightcad/libredwg-web'

import { AcDbLibreDwgConverter } from './AcDbLibreDwgConverter.js'
import { parseLibreDwgFile } from './AcDbLibreDwgConverterUtil.js'

/**
 * LibreDWG converter that parses on the current thread (no Web Worker).
 *
 * Intended for Node and other environments without a reliable worker + WASM
 * loader. Shares {@link parseLibreDwgFile} with the browser worker, including
 * the classic `previewAddress` thumbnail fallback for DWG files. Accepts DWG
 * and DXF payloads (file type is sniffed from the bytes).
 *
 * Import from `@mlightcad/libredwg-converter/node` so the browser UMD bundle
 * stays free of LibreDWG WASM.
 */
export class AcDbLibreDwgMainThreadConverter extends AcDbLibreDwgConverter {
  constructor(config: AcDbDatabaseConverterConfig = {}) {
    super({ ...config, useWorker: false })
    this.config.useWorker = false
  }

  protected override async parse(
    data: ArrayBuffer
  ): Promise<AcDbParsingTaskResult<DwgDatabase>> {
    const parsed = await parseLibreDwgFile(data)
    return {
      model: parsed.database,
      data: parsed.stats
    }
  }
}
