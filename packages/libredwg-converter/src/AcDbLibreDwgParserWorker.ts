/// <reference lib="webworker" />

import { AcDbBaseWorker, AcDbParsingTaskResult } from '@mlightcad/data-model'
import { DwgDatabase } from '@mlightcad/libredwg-web'

import { parseLibreDwgFile } from './AcDbLibreDwgConverterUtil.js'
/**
 * DWG/DXF parsing worker (file type is sniffed from the payload).
 */
class AcDbDwgParserWorker extends AcDbBaseWorker<
  ArrayBuffer,
  AcDbParsingTaskResult<DwgDatabase>
> {
  protected async executeTask(data: ArrayBuffer) {
    const result = await parseLibreDwgFile(data)
    return {
      model: result.database,
      data: result.stats
    }
  }
}

// Initialize the worker
new AcDbDwgParserWorker()
