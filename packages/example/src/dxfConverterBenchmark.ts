/**
 * Side-by-side performance comparison:
 * - `@mlightcad/data-model` {@link AcDbNativeDxfConverter} (streaming, main thread)
 * - `@mlightcad/dxf-json-converter` {@link AcDbDxfConverter} (ParsedDxf via worker)
 *
 * Metric: wall-clock time to produce a fully populated {@link AcDbDatabase}.
 */

import {
  AcDbDatabase,
  AcDbDatabaseConverterManager,
  AcDbFileType,
  acdbHostApplicationServices,
  AcDbNativeDxfConverter,
  AcDbOpenDatabaseOptions} from '@mlightcad/data-model'
import { AcDbDxfConverter } from '@mlightcad/dxf-json-converter'

import {
  type DxfBenchmarkSample,
  type DxfBuiltinBenchmarkSampleId,
  getDxfBenchmarkSample,
  getDxfBenchmarkSamples} from './dxfBenchmarkSamples'

export type DxfConverterKind = 'native' | 'dxf-json'

export interface DxfConverterBenchmarkResult {
  converter: DxfConverterKind
  label: string
  durationMs: number
  entityCount: number
  layerCount: number
  error?: string
}

export interface DxfSampleBenchmarkResult {
  sample: Pick<
    DxfBenchmarkSample,
    'id' | 'label' | 'description' | 'entityCount'
  >
  bufferBytes: number
  native: DxfConverterBenchmarkResult
  dxfJson: DxfConverterBenchmarkResult
  /** native / dxf-json; >1 means native faster */
  speedup: number | null
}

const OPEN_OPTIONS: AcDbOpenDatabaseOptions = {
  minimumChunkSize: 1000,
  readOnly: true
}

const countModelSpaceEntities = (database: AcDbDatabase) => {
  let count = 0
  for (const _ of database.tables.blockTable.modelSpace.newIterator()) {
    count++
  }
  return count
}

const countLayers = (database: AcDbDatabase) => {
  return database.tables.layerTable.newIterator().count
}

const registerNativeConverter = () => {
  AcDbDatabaseConverterManager.instance.register(
    AcDbFileType.DXF,
    new AcDbNativeDxfConverter({
      convertByEntityType: false,
      useWorker: false
    })
  )
}

const registerDxfJsonConverter = () => {
  AcDbDatabaseConverterManager.instance.register(
    AcDbFileType.DXF,
    new AcDbDxfConverter({
      convertByEntityType: false,
      useWorker: true,
      parserWorkerUrl: './assets/dxf-parser-worker.js'
    })
  )
}

/**
 * Parses one DXF buffer with the given converter into a fresh AcDbDatabase.
 */
export async function parseDxfToDatabase(
  buffer: ArrayBuffer,
  converter: DxfConverterKind
): Promise<DxfConverterBenchmarkResult> {
  const label =
    converter === 'native'
      ? 'data-model AcDbNativeDxfConverter'
      : 'dxf-json-converter AcDbDxfConverter'

  try {
    if (converter === 'native') {
      registerNativeConverter()
    } else {
      registerDxfJsonConverter()
    }

    const database = new AcDbDatabase()
    acdbHostApplicationServices().workingDatabase = database

    const start = performance.now()
    await database.read(buffer.slice(0), OPEN_OPTIONS, AcDbFileType.DXF)
    const end = performance.now()

    return {
      converter,
      label,
      durationMs: end - start,
      entityCount: countModelSpaceEntities(database),
      layerCount: countLayers(database)
    }
  } catch (error) {
    return {
      converter,
      label,
      durationMs: Number.NaN,
      entityCount: 0,
      layerCount: 0,
      error: (error as Error).message
    }
  }
}

/**
 * Runs both converters on one sample (native first, then json).
 */
export async function benchmarkSample(
  sample: DxfBenchmarkSample
): Promise<DxfSampleBenchmarkResult> {
  const native = await parseDxfToDatabase(sample.buffer, 'native')
  const dxfJson = await parseDxfToDatabase(sample.buffer, 'dxf-json')

  let speedup: number | null = null
  if (
    !native.error &&
    !dxfJson.error &&
    Number.isFinite(native.durationMs) &&
    Number.isFinite(dxfJson.durationMs) &&
    native.durationMs > 0
  ) {
    speedup = dxfJson.durationMs / native.durationMs
  }

  return {
    sample: {
      id: sample.id,
      label: sample.label,
      description: sample.description,
      entityCount: sample.entityCount
    },
    bufferBytes: sample.buffer.byteLength,
    native,
    dxfJson,
    speedup
  }
}

/**
 * Benchmarks both built-in verification datasets.
 */
export async function benchmarkBuiltinSamples(): Promise<
  DxfSampleBenchmarkResult[]
> {
  const results: DxfSampleBenchmarkResult[] = []
  for (const sample of getDxfBenchmarkSamples()) {
    results.push(await benchmarkSample(sample))
  }
  return results
}

/**
 * Benchmarks a single built-in sample by id.
 */
export async function benchmarkBuiltinSample(
  id: DxfBuiltinBenchmarkSampleId
): Promise<DxfSampleBenchmarkResult> {
  return benchmarkSample(getDxfBenchmarkSample(id))
}

/**
 * Formats benchmark results as plain text for the demo `<pre>` panel.
 */
export function formatBenchmarkResults(
  results: DxfSampleBenchmarkResult[]
): string {
  const formatMs = (ms: number) =>
    Number.isFinite(ms) ? `${ms.toFixed(2)} ms` : 'n/a'

  const lines: string[] = [
    'DXF → AcDbDatabase performance comparison',
    'Converters:',
    '  - native:  @mlightcad/data-model AcDbNativeDxfConverter (main thread)',
    '  - dxf-json: @mlightcad/dxf-json-converter AcDbDxfConverter (worker parse)',
    ''
  ]

  for (const result of results) {
    lines.push(`=== ${result.sample.label} ===`)
    lines.push(result.sample.description)
    lines.push(
      `Buffer: ${(result.bufferBytes / 1024).toFixed(1)} KB | expected entities: ${
        result.sample.entityCount > 0
          ? result.sample.entityCount.toLocaleString()
          : 'n/a (counted after parse)'
      }`
    )
    lines.push('')

    const pushConverter = (r: DxfConverterBenchmarkResult) => {
      if (r.error) {
        lines.push(`${r.label}`)
        lines.push(`  ERROR: ${r.error}`)
        return
      }
      lines.push(`${r.label}`)
      lines.push(`  time:     ${formatMs(r.durationMs)}`)
      lines.push(`  entities: ${r.entityCount.toLocaleString()}`)
      lines.push(`  layers:   ${r.layerCount}`)
    }

    pushConverter(result.native)
    lines.push('')
    pushConverter(result.dxfJson)
    lines.push('')

    if (result.speedup != null) {
      const faster =
        result.speedup >= 1
          ? `native is ${result.speedup.toFixed(2)}× faster`
          : `dxf-json is ${(1 / result.speedup).toFixed(2)}× faster`
      lines.push(`Speedup (dxf-json / native): ${result.speedup.toFixed(2)} → ${faster}`)
    } else {
      lines.push('Speedup: n/a (one converter failed)')
    }
    lines.push('')
  }

  return lines.join('\n')
}
