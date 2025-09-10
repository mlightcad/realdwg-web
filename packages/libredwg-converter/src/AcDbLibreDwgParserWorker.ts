/// <reference lib="webworker" />

import { AcDbBaseWorker } from '@mlightcad/data-model'
import { DwgDatabase } from '@mlightcad/libredwg-web'

import { parseDwg } from './AcDbLibreDwgConverterUtil'

/**
 * DXF parsing worker
 */
class AcDbDxfParserWorker extends AcDbBaseWorker<string, DwgDatabase> {
  protected async executeTask(dxfString: string): Promise<DwgDatabase> {
    return parseDwg(dxfString)
  }
}

// Initialize the worker
new AcDbDxfParserWorker()
