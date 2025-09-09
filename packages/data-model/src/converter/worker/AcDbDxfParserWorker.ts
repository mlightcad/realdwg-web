/// <reference lib="webworker" />
import DxfParser, { ParsedDxf } from '@mlightcad/dxf-json'

import { AcDbBaseWorker } from './AcDbBaseWorker'

/**
 * DXF parsing worker
 */
class AcDbDxfParserWorker extends AcDbBaseWorker<string, ParsedDxf> {
  protected async executeTask(dxfString: string): Promise<ParsedDxf> {
    const parser = new DxfParser()
    return parser.parseSync(dxfString)
  }
}

// Initialize the worker
new AcDbDxfParserWorker()
