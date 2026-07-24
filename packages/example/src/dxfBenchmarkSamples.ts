/**
 * Built-in DXF sample datasets for converter performance comparison.
 *
 * Two fixed datasets (small / large) so native vs dxf-json-converter
 * timings to {@link AcDbDatabase} can be compared reproducibly.
 */

export type DxfBuiltinBenchmarkSampleId = 'small' | 'large'
export type DxfBenchmarkSampleId = DxfBuiltinBenchmarkSampleId | 'custom'

export interface DxfBenchmarkSample {
  id: DxfBenchmarkSampleId
  /** Display name in the UI */
  label: string
  /** Short description of content / intended scale */
  description: string
  /** Approximate entity count placed in model space (0 when unknown) */
  entityCount: number
  /** UTF-8 DXF bytes */
  buffer: ArrayBuffer
}

/**
 * Builds a minimal ASCII DXF with `count` LINE entities in model space.
 *
 * @param count - Number of LINE entities to emit.
 * @param title - Written into `$DWGCODEPAGE` comment via HEADER for identification.
 */
function buildLineGridDxf(count: number, title: string): ArrayBuffer {
  const lines: string[] = [
    '0',
    'SECTION',
    '2',
    'HEADER',
    '9',
    '$ACADVER',
    '1',
    'AC1021',
    '9',
    '$INSUNITS',
    '70',
    '4',
    '0',
    'ENDSEC',
    '0',
    'SECTION',
    '2',
    'TABLES',
    '0',
    'TABLE',
    '2',
    'LAYER',
    '5',
    '2',
    '100',
    'AcDbSymbolTable',
    '70',
    '1',
    '0',
    'LAYER',
    '5',
    '10',
    '100',
    'AcDbSymbolTableRecord',
    '100',
    'AcDbLayerTableRecord',
    '2',
    '0',
    '70',
    '0',
    '62',
    '7',
    '6',
    'Continuous',
    '0',
    'ENDTAB',
    '0',
    'ENDSEC',
    '0',
    'SECTION',
    '2',
    'ENTITIES'
  ]

  // Keep geometry simple and deterministic: a diagonal grid of short segments.
  const cols = Math.ceil(Math.sqrt(count))
  for (let i = 0; i < count; i++) {
    const col = i % cols
    const row = Math.floor(i / cols)
    const x = col * 10
    const y = row * 10
    lines.push(
      '0',
      'LINE',
      '5',
      (0x100 + i).toString(16).toUpperCase(),
      '100',
      'AcDbEntity',
      '8',
      '0',
      '100',
      'AcDbLine',
      '10',
      String(x),
      '20',
      String(y),
      '30',
      '0.0',
      '11',
      String(x + 5),
      '21',
      String(y + 5),
      '31',
      '0.0'
    )
  }

  // Title is unused by parsers but kept for human inspection of the buffer.
  void title

  lines.push('0', 'ENDSEC', '0', 'EOF')
  return new TextEncoder().encode(lines.join('\n')).buffer
}

const SMALL_ENTITY_COUNT = 2_000
const LARGE_ENTITY_COUNT = 25_000

/**
 * Returns the two built-in verification datasets (lazy-built once).
 */
let cachedSamples: DxfBenchmarkSample[] | null = null

export function getDxfBenchmarkSamples(): DxfBenchmarkSample[] {
  if (cachedSamples) return cachedSamples

  cachedSamples = [
    {
      id: 'small',
      label: 'Sample A — small',
      description: `${SMALL_ENTITY_COUNT.toLocaleString()} LINE entities (light load)`,
      entityCount: SMALL_ENTITY_COUNT,
      buffer: buildLineGridDxf(SMALL_ENTITY_COUNT, 'benchmark-small')
    },
    {
      id: 'large',
      label: 'Sample B — large',
      description: `${LARGE_ENTITY_COUNT.toLocaleString()} LINE entities (heavier load)`,
      entityCount: LARGE_ENTITY_COUNT,
      buffer: buildLineGridDxf(LARGE_ENTITY_COUNT, 'benchmark-large')
    }
  ]
  return cachedSamples
}

export function getDxfBenchmarkSample(
  id: DxfBuiltinBenchmarkSampleId
): DxfBenchmarkSample {
  const sample = getDxfBenchmarkSamples().find(s => s.id === id)
  if (!sample) throw new Error(`Unknown benchmark sample: ${id}`)
  return sample
}
