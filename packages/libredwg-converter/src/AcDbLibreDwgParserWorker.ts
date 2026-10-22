/// <reference lib="webworker" />

import { AcDbBaseWorker, AcDbParsingTaskResult } from '@mlightcad/data-model'
import { DwgDatabase } from '@mlightcad/libredwg-web'

import { parseDwg } from './AcDbLibreDwgConverterUtil.js'
/**
 * DWG parsing worker
 */
class AcDbDwgParserWorker extends AcDbBaseWorker<
  ArrayBuffer,
  AcDbParsingTaskResult<DwgDatabase>
> {
  protected async executeTask(data: ArrayBuffer) {
    const result = await parseDwg(data)
    return {
      model: result.database,
      data: result.stats
    }
  }
}

// Initialize the worker
new AcDbDwgParserWorker()
