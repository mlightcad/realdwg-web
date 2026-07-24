import {
  AcDbDatabaseConverterManager,
  AcDbFileType
} from '../database/AcDbDatabaseConverterManager'
import { AcDbNativeDxfConverter } from './AcDbNativeDxfConverter'

/**
 * Registers {@link AcDbNativeDxfConverter} as the default DXF converter.
 *
 * Importing `@mlightcad/data-model` runs this once so DXF files work without
 * an explicit `register` call. Apps that prefer `@mlightcad/dxf-json-converter`
 * (or another DXF converter) can call `register(AcDbFileType.DXF, …)` afterward;
 * that replaces this default.
 */
AcDbDatabaseConverterManager.instance.register(
  AcDbFileType.DXF,
  new AcDbNativeDxfConverter()
)
