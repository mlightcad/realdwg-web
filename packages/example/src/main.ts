/**
 * @fileoverview Example web application entry point for DWG/DXF parsing and PAT preview.
 *
 * This module wires up the demo UI: file selection, main-thread vs web-worker parsing
 * benchmarks, layer/linetype inspection, DXF export, and hatch pattern (PAT) parsing
 * with SVG previews.
 *
 * @module example/main
 */

import {
  AcDbDatabase,
  AcDbDatabaseConverterManager,
  AcDbFileType,
  acdbHostApplicationServices,
  AcDbOpenDatabaseOptions,
  AcDbPatDocument,
  AcDbPatParser,
  AcDbPatSvgRenderer,
  AcDbPredefinedAcadIsoPat,
  AcDbPredefinedAcadPat
} from '@mlightcad/data-model'
import { AcDbDxfConverter } from '@mlightcad/dxf-json-converter'
import { AcDbLibreDwgConverter } from '@mlightcad/libredwg-converter'

const fileInput = document.getElementById('fileInput') as HTMLInputElement
const modeSelect = document.getElementById('modeSelect') as HTMLSelectElement
const runButton = document.getElementById('runButton') as HTMLButtonElement
const status = document.getElementById('status') as HTMLDivElement
const output = document.getElementById('output') as HTMLPreElement
const exportButton = document.createElement('button')
const linetypePreviewPanel = document.createElement('section')
const patSourceSelect = document.getElementById(
  'patSourceSelect'
) as HTMLSelectElement
const patFileInput = document.getElementById('patFileInput') as HTMLInputElement
const parsePatButton = document.getElementById(
  'parsePatButton'
) as HTMLButtonElement
const patStatus = document.getElementById('patStatus') as HTMLDivElement
const patTableOutput = document.getElementById(
  'patTableOutput'
) as HTMLDivElement

exportButton.type = 'button'
exportButton.textContent = 'Export DXF'
exportButton.hidden = true
exportButton.disabled = true
exportButton.style.marginLeft = '8px'
runButton.insertAdjacentElement('afterend', exportButton)
output.insertAdjacentElement('afterend', linetypePreviewPanel)

linetypePreviewPanel.style.marginTop = '16px'
linetypePreviewPanel.style.display = 'none'

/**
 * Parsing execution mode selected in the demo UI.
 *
 * - `compare` — Parse the same file on the main thread and in a web worker, then report timings.
 * - `main` — Parse only on the main thread (DXF only; UI may freeze during parsing).
 * - `worker` — Parse only inside a dedicated web worker (required for DWG).
 */
type ParseMode = 'compare' | 'main' | 'worker'

let lastFile: File | null = null
let lastBuffer: ArrayBuffer | null = null
let lastParsedDatabase: AcDbDatabase | null = null
let lastDownloadUrl: string | null = null
const patSvgRenderer = new AcDbPatSvgRenderer()
const patParser = new AcDbPatParser()

/**
 * Registers DXF and DWG database converters with the global converter manager.
 *
 * Both converters share the same worker configuration. DXF supports main-thread parsing;
 * DWG parsing is worker-only and relies on the LibreDWG parser worker script.
 *
 * Registration failures are logged to the console but do not throw, so the demo can
 * continue with whichever converters succeeded.
 *
 * @param useWorker - When `true`, parsing runs in a web worker; when `false`, on the main thread.
 */
const registerConverters = (useWorker: boolean) => {
  // Register DXF converter
  try {
    const converter = new AcDbDxfConverter({
      convertByEntityType: false,
      useWorker,
      parserWorkerUrl: './assets/dxf-parser-worker.js'
    })
    AcDbDatabaseConverterManager.instance.register(AcDbFileType.DXF, converter)
  } catch (error) {
    console.error('Failed to register dxf converter: ', error)
  }

  // Register DWG converter (worker-only)
  try {
    const converter = new AcDbLibreDwgConverter({
      convertByEntityType: false,
      useWorker,
      parserWorkerUrl: './assets/libredwg-parser-worker.js'
    })
    AcDbDatabaseConverterManager.instance.register(AcDbFileType.DWG, converter)
  } catch (error) {
    console.error('Failed to register dwg converter: ', error)
  }
}

/**
 * Infers the CAD file type from a file name extension.
 *
 * @param fileName - Original file name, with or without path segments.
 * @returns {@link AcDbFileType.DWG} when the extension is `.dwg` (case-insensitive); otherwise {@link AcDbFileType.DXF}.
 */
const getFileType = (fileName: string) => {
  const extension = fileName.split('.').pop()?.toLocaleLowerCase()
  return extension === 'dwg' ? AcDbFileType.DWG : AcDbFileType.DXF
}

/**
 * Formats a duration in milliseconds for display in the output panel.
 *
 * @param value - Elapsed time in milliseconds.
 * @returns Human-readable string with two decimal places, e.g. `"123.45 ms"`.
 */
const formatMs = (value: number) => `${value.toFixed(2)} ms`

/**
 * Collects layer table metadata from an opened database.
 *
 * @param database - Parsed drawing database whose layer table will be iterated.
 * @returns Layer count and an ordered list of layer names.
 */
const collectLayers = (database: AcDbDatabase) => {
  const layers = database.tables.layerTable.newIterator()
  const names: string[] = []
  for (const layer of layers) {
    names.push(layer.name)
  }
  return {
    count: layers.count,
    names
  }
}

/**
 * Outcome of a single parse attempt.
 *
 * Uses a discriminated union on `skipped`:
 * - When `skipped` is `true`, parsing did not produce a database and `reason` explains why.
 * - When `skipped` is `false`, parsing succeeded and timing, layer summary, and the database are available.
 */
type ParseResult =
  | { skipped: true; reason: string }
  | {
      database: AcDbDatabase
      skipped: false
      durationMs: number
      layers: { count: number; names: string[] }
    }

/**
 * Parses a drawing buffer once using the configured converters and open options.
 *
 * Creates a fresh {@link AcDbDatabase}, assigns it as the host working database, and
 * measures wall-clock time for {@link AcDbDatabase.read}. Converters are (re)registered
 * on each call so worker vs main-thread mode can differ between invocations.
 *
 * @param buffer - Raw file bytes (DXF or DWG).
 * @param fileType - Format hint passed to the database reader.
 * @param useWorker - Whether to register and use worker-based converters.
 * @returns Parsed database with timing and layer info, or a skipped result if parsing is not attempted.
 */
const parseOnce = async (
  buffer: ArrayBuffer,
  fileType: AcDbFileType,
  useWorker: boolean
): Promise<ParseResult> => {
  registerConverters(useWorker)

  const database = new AcDbDatabase()
  acdbHostApplicationServices().workingDatabase = database
  const options: AcDbOpenDatabaseOptions = {
    minimumChunkSize: 1000,
    readOnly: true
  }

  const start = performance.now()
  await database.read(buffer, options, fileType)
  const end = performance.now()

  return {
    database,
    skipped: false,
    durationMs: end - start,
    layers: collectLayers(database)
  }
}

/**
 * Builds a short comparison message between main-thread and worker parse durations.
 *
 * @param mainMs - Elapsed time for main-thread parsing in milliseconds.
 * @param workerMs - Elapsed time for worker parsing in milliseconds.
 * @returns Sentence describing which side was faster and by what relative percentage.
 */
const compareTimes = (mainMs: number, workerMs: number) => {
  const diff = workerMs - mainMs
  const percent = (Math.abs(diff) / Math.max(mainMs, 1)) * 100
  if (diff === 0) return 'Worker and main thread are the same speed.'
  if (diff < 0) {
    return `Worker is ${percent.toFixed(1)}% faster than main thread.`
  }
  return `Worker is ${percent.toFixed(1)}% slower than main thread.`
}

/**
 * Updates the global status line shown above the parse output.
 *
 * @param message - Status text; pass an empty string to clear the line.
 */
const setStatus = (message: string) => {
  status.textContent = message
}

/**
 * Derives the download file name for a DXF export from the original upload name.
 *
 * Replaces the last extension segment with `.dxf`, or appends `.dxf` when no extension exists.
 *
 * @param fileName - Original uploaded file name.
 * @returns Suggested export file name ending in `.dxf`.
 */
const getExportFileName = (fileName: string) => {
  const suffixIndex = fileName.lastIndexOf('.')
  const baseName = suffixIndex >= 0 ? fileName.slice(0, suffixIndex) : fileName
  return `${baseName}.dxf`
}

/**
 * Shows or hides the DXF export button based on current session state.
 *
 * The button is visible when a file has been selected and enabled only when a database
 * has been successfully parsed and is available for export.
 */
const updateExportButton = () => {
  const shouldShow = lastFile != null
  exportButton.hidden = !shouldShow
  exportButton.disabled = !shouldShow || lastParsedDatabase == null
}

/**
 * Formats layer table summary lines for the text output area.
 *
 * @param layerInfo - Layer count and names from {@link collectLayers}; omit to return an empty array.
 * @returns Lines suitable for joining into the `<pre>` output, including a header and bullet list.
 */
const renderLayers = (layerInfo?: { count: number; names: string[] }) => {
  if (!layerInfo) return []
  const lines = [`Layers (${layerInfo.count})`]
  layerInfo.names.forEach(name => lines.push(`- ${name}`))
  return lines
}

/**
 * Renders SVG previews for every linetype record in the parsed database.
 *
 * Clears and hides the preview panel when `database` is null. Otherwise builds a grid of
 * rows with linetype name/comments and inline SVG from {@link AcDbLinetypeTableRecord.toPreviewSvgString}.
 *
 * @param database - Parsed drawing database, or `null` to reset the panel.
 */
const renderLinetypePreviews = (database: AcDbDatabase | null) => {
  linetypePreviewPanel.innerHTML = ''
  if (!database) {
    linetypePreviewPanel.style.display = 'none'
    return
  }

  const records = database.tables.linetypeTable
    .newIterator()
    .toArray()
    .sort((a, b) => a.name.localeCompare(b.name))

  const title = document.createElement('h3')
  title.textContent = `Linetypes (${records.length})`
  title.style.margin = '0 0 8px 0'
  title.style.fontSize = '16px'
  linetypePreviewPanel.appendChild(title)

  const list = document.createElement('div')
  list.style.display = 'grid'
  list.style.gridTemplateColumns = '1fr'
  list.style.gap = '8px'

  for (const record of records) {
    const row = document.createElement('div')
    row.style.display = 'grid'
    row.style.gridTemplateColumns = '220px auto'
    row.style.alignItems = 'center'
    row.style.gap = '12px'
    row.style.padding = '6px 8px'
    row.style.border = '1px solid #dadada'
    row.style.borderRadius = '6px'

    const label = document.createElement('div')
    label.textContent = record.comments
      ? `${record.name} - ${record.comments}`
      : record.name
    label.title = record.name
    label.style.fontFamily = 'monospace'
    label.style.fontSize = '13px'
    label.style.whiteSpace = 'nowrap'
    label.style.overflow = 'hidden'
    label.style.textOverflow = 'ellipsis'

    const preview = document.createElement('div')
    preview.innerHTML = record.toPreviewSvgString({
      width: 150,
      height: 10,
      padding: 8,
      strokeWidth: 2,
      stroke: '#202124',
      repeats: 4
    })

    row.appendChild(label)
    row.appendChild(preview)
    list.appendChild(row)
  }

  linetypePreviewPanel.appendChild(list)
  linetypePreviewPanel.style.display = 'block'
}

/**
 * Updates the PAT section status line.
 *
 * @param message - Status text shown below the PAT controls.
 */
const setPatStatus = (message: string) => {
  patStatus.textContent = message
}

/**
 * Removes all rendered PAT pattern rows from the preview table container.
 */
const clearPatPreview = () => {
  patTableOutput.innerHTML = ''
}

/**
 * Source of hatch pattern (PAT) definitions in the demo.
 *
 * - `predefined-acad` — Built-in `acad.pat` patterns shipped with the data model.
 * - `predefined-acadiso` — Built-in ISO `acadiso.pat` patterns.
 * - `file` — User-selected local `.pat` file loaded via the file input.
 */
type PatSource = 'predefined-acad' | 'predefined-acadiso' | 'file'

/**
 * Resolves a built-in PAT document for predefined sources.
 *
 * @param source - Selected PAT source; must not be `'file'`.
 * @returns The corresponding {@link AcDbPatDocument}, or `null` when the source is `'file'`.
 */
const getPredefinedPatDocument = (
  source: PatSource
): AcDbPatDocument | null => {
  if (source === 'predefined-acad') return AcDbPredefinedAcadPat
  if (source === 'predefined-acadiso') return AcDbPredefinedAcadIsoPat
  return null
}

/**
 * Builds an HTML table listing each pattern's JSON definition and SVG preview.
 *
 * Each row shows pretty-printed pattern metadata and a rasterized SVG thumbnail produced
 * by {@link AcDbPatSvgRenderer.renderPattern}. No-op when the document contains zero patterns.
 *
 * @param patDocument - Parsed or predefined PAT document to display.
 */
const renderPatTable = (patDocument: AcDbPatDocument) => {
  patTableOutput.innerHTML = ''
  if (patDocument.patterns.length === 0) return

  const table = document.createElement('table')
  table.style.width = '100%'
  table.style.borderCollapse = 'collapse'
  table.style.tableLayout = 'fixed'
  table.style.marginTop = '8px'

  const thead = document.createElement('thead')
  const headerRow = document.createElement('tr')
  const jsonHeader = document.createElement('th')
  jsonHeader.textContent = 'Pattern JSON'
  jsonHeader.style.textAlign = 'left'
  jsonHeader.style.padding = '8px'
  jsonHeader.style.border = '1px solid #dadada'
  jsonHeader.style.background = '#f3f4f6'

  const svgHeader = document.createElement('th')
  svgHeader.textContent = 'PAT Preview'
  svgHeader.style.textAlign = 'left'
  svgHeader.style.padding = '8px'
  svgHeader.style.border = '1px solid #dadada'
  svgHeader.style.background = '#f3f4f6'

  headerRow.appendChild(jsonHeader)
  headerRow.appendChild(svgHeader)
  thead.appendChild(headerRow)
  table.appendChild(thead)

  const tbody = document.createElement('tbody')
  patDocument.patterns.forEach(pattern => {
    const row = document.createElement('tr')

    const jsonCell = document.createElement('td')
    jsonCell.style.verticalAlign = 'top'
    jsonCell.style.border = '1px solid #dadada'
    jsonCell.style.padding = '8px'

    const jsonTitle = document.createElement('div')
    jsonTitle.style.fontFamily = 'monospace'
    jsonTitle.style.fontWeight = 'bold'
    jsonTitle.style.marginBottom = '6px'
    jsonTitle.textContent = pattern.description
      ? `${pattern.name} - ${pattern.description}`
      : pattern.name

    const jsonPre = document.createElement('pre')
    jsonPre.style.margin = '0'
    jsonPre.style.whiteSpace = 'pre-wrap'
    jsonPre.style.wordBreak = 'break-word'
    jsonPre.style.fontSize = '12px'
    jsonPre.textContent = JSON.stringify(pattern, null, 2)

    jsonCell.appendChild(jsonTitle)
    jsonCell.appendChild(jsonPre)

    const previewCell = document.createElement('td')
    previewCell.style.verticalAlign = 'top'
    previewCell.style.border = '1px solid #dadada'
    previewCell.style.padding = '8px'
    previewCell.style.width = '380px'
    previewCell.innerHTML = patSvgRenderer.renderPattern(pattern, {
      width: 360,
      height: 220,
      stroke: '#1f2937',
      strokeWidth: 1.25,
      background: '#f8fafc'
    })

    row.appendChild(jsonCell)
    row.appendChild(previewCell)
    tbody.appendChild(row)
  })

  table.appendChild(tbody)
  patTableOutput.appendChild(table)
}

/**
 * Parses raw PAT file text and loads the result into the preview UI.
 *
 * @param text - Full contents of a `.pat` file.
 */
const parsePatText = (text: string) => {
  const parsed = patParser.parse(text)
  loadPatDocument(parsed, 'Local PAT file')
}

/**
 * Displays a PAT document in the table and updates the PAT status summary.
 *
 * @param patDocument - Document whose patterns and issues will be summarized.
 * @param sourceLabel - Human-readable label for the pattern source (file name or built-in id).
 */
const loadPatDocument = (patDocument: AcDbPatDocument, sourceLabel: string) => {
  renderPatTable(patDocument)

  const summaryParts = [
    `Source: ${sourceLabel}`,
    `Patterns: ${patDocument.patterns.length}`
  ]
  if (patDocument.issues.length > 0) {
    summaryParts.push(`Issues: ${patDocument.issues.length}`)
  }
  setPatStatus(summaryParts.join(' | '))
}

/**
 * Enables or disables PAT file controls based on the selected {@link PatSource}.
 *
 * File input and parse button are active only when source is `'file'`.
 */
const updatePatSourceUi = () => {
  const source = patSourceSelect.value as PatSource
  const isFileSource = source === 'file'
  patFileInput.disabled = !isFileSource
  parsePatButton.disabled = !isFileSource
}

/**
 * Applies the current PAT source selection: loads predefined documents or prompts for a file.
 *
 * For built-in sources, immediately renders the corresponding document. For `'file'`, clears
 * the preview and instructs the user to upload and parse a local PAT file.
 */
const applyPatSource = () => {
  const source = patSourceSelect.value as PatSource
  updatePatSourceUi()

  if (source === 'file') {
    clearPatPreview()
    setPatStatus('Select a PAT file and click "Parse PAT".')
    return
  }

  const predefined = getPredefinedPatDocument(source)
  if (!predefined) {
    clearPatPreview()
    setPatStatus('No predefined PAT document is available for current source.')
    return
  }

  const sourceLabel = source === 'predefined-acad' ? 'acad.pat' : 'acadiso.pat'
  loadPatDocument(predefined, sourceLabel)
}

/**
 * Adjusts parse mode dropdown options for DWG vs DXF constraints.
 *
 * DWG parsing requires a web worker, so `compare` and `main` modes are disabled for DWG
 * files and the selection is forced to `worker` when necessary.
 *
 * @param fileType - Detected format of the currently selected file.
 */
const updateModeOptions = (fileType: AcDbFileType) => {
  const compareOption = modeSelect.querySelector(
    'option[value="compare"]'
  ) as HTMLOptionElement | null
  const mainOption = modeSelect.querySelector(
    'option[value="main"]'
  ) as HTMLOptionElement | null

  const disableMainThreadModes = fileType === AcDbFileType.DWG
  if (compareOption) compareOption.disabled = disableMainThreadModes
  if (mainOption) mainOption.disabled = disableMainThreadModes

  if (disableMainThreadModes && modeSelect.value !== 'worker') {
    modeSelect.value = 'worker'
  }
}

/**
 * Main parse workflow triggered by file selection or the Run button.
 *
 * Validates that a file buffer is loaded, enforces worker mode for DWG, runs parsing
 * according to {@link ParseMode}, writes timing and layer output, refreshes linetype
 * previews, and updates export button state. UI controls are disabled for the duration
 * of parsing to prevent concurrent runs.
 */
const runParse = async () => {
  if (!lastFile || !lastBuffer) {
    output.textContent = 'Please select a DWG or DXF file first.'
    renderLinetypePreviews(null)
    return
  }

  let mode = modeSelect.value as ParseMode
  const fileType = getFileType(lastFile.name)
  const lines: string[] = []
  let parsedDatabase: AcDbDatabase | null = null

  lastParsedDatabase = null
  updateExportButton()

  if (fileType === AcDbFileType.DWG && mode !== 'worker') {
    mode = 'worker'
    modeSelect.value = 'worker'
    lines.push(
      'Mode forced to worker because DWG parsing cannot run on main thread.'
    )
    lines.push('')
  }

  runButton.disabled = true
  modeSelect.disabled = true
  fileInput.disabled = true
  exportButton.disabled = true

  try {
    setStatus('')
    lines.push(`File: ${lastFile.name}`)
    lines.push(`Mode: ${mode}`)
    lines.push('')

    if (mode === 'compare') {
      setStatus('Parsing on main thread. The UI may freeze during this step.')
      const mainResult = await parseOnce(lastBuffer.slice(0), fileType, false)
      setStatus('Parsing in web worker.')
      if (mainResult.skipped) {
        lines.push(`Main thread: skipped (${mainResult.reason})`)
      } else {
        lines.push(`Main thread: ${formatMs(mainResult.durationMs)}`)
      }

      const workerResult = await parseOnce(lastBuffer.slice(0), fileType, true)
      setStatus('')
      if (workerResult.skipped) {
        lines.push(`Worker: skipped (${workerResult.reason})`)
      } else {
        lines.push(`Worker: ${formatMs(workerResult.durationMs)}`)
      }

      if (
        !mainResult.skipped &&
        !workerResult.skipped &&
        mainResult.durationMs != null &&
        workerResult.durationMs != null
      ) {
        lines.push('')
        lines.push(compareTimes(mainResult.durationMs, workerResult.durationMs))
      }

      lines.push('')
      let layerSource: { count: number; names: string[] } | undefined
      if (!workerResult.skipped) {
        layerSource = workerResult.layers
        parsedDatabase = workerResult.database
      } else if (!mainResult.skipped) {
        layerSource = mainResult.layers
        parsedDatabase = mainResult.database
      }
      lines.push(...renderLayers(layerSource))
    } else if (mode === 'main') {
      setStatus('Parsing on main thread. The UI may freeze during this step.')
      const result = await parseOnce(lastBuffer.slice(0), fileType, false)
      setStatus('')
      if (result.skipped) {
        lines.push(`Main thread: skipped (${result.reason})`)
      } else {
        parsedDatabase = result.database
        lines.push(`Main thread: ${formatMs(result.durationMs)}`)
        lines.push('')
        lines.push(...renderLayers(result.layers))
      }
    } else {
      setStatus('Parsing in web worker.')
      const result = await parseOnce(lastBuffer.slice(0), fileType, true)
      setStatus('')
      if (result.skipped) {
        lines.push(`Worker: skipped (${result.reason})`)
      } else {
        parsedDatabase = result.database
        lines.push(`Worker: ${formatMs(result.durationMs)}`)
        lines.push('')
        lines.push(...renderLayers(result.layers))
      }
    }
  } catch (error) {
    console.error(error)
    lines.push(`Error: ${(error as Error).message}`)
  } finally {
    lastParsedDatabase = parsedDatabase
    setStatus('')
    output.textContent = lines.join('\n')
    renderLinetypePreviews(lastParsedDatabase)
    runButton.disabled = false
    modeSelect.disabled = false
    fileInput.disabled = false
    updateExportButton()
  }
}

fileInput.addEventListener('change', async () => {
  const file = fileInput.files?.[0]
  if (!file) return
  lastFile = file
  lastParsedDatabase = null
  renderLinetypePreviews(null)
  updateModeOptions(getFileType(file.name))
  updateExportButton()
  output.textContent = 'Loading file...\n'
  lastBuffer = await file.arrayBuffer()
  await runParse()
})

runButton.addEventListener('click', async () => {
  await runParse()
})

exportButton.addEventListener('click', () => {
  if (!lastFile || !lastParsedDatabase) return

  exportButton.disabled = true

  try {
    setStatus('Generating DXF export...')
    const dxf = lastParsedDatabase.dxfOut(undefined, 6)
    const fileName = getExportFileName(lastFile.name)
    const blob = new Blob([dxf], {
      type: 'application/dxf;charset=utf-8'
    })

    if (lastDownloadUrl) {
      URL.revokeObjectURL(lastDownloadUrl)
    }

    lastDownloadUrl = URL.createObjectURL(blob)

    const anchor = document.createElement('a')
    anchor.href = lastDownloadUrl
    anchor.download = fileName
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    setStatus(`DXF exported: ${fileName}`)
  } catch (error) {
    console.error(error)
    setStatus(`DXF export failed: ${(error as Error).message}`)
  } finally {
    updateExportButton()
  }
})

patFileInput.addEventListener('change', async () => {
  if ((patSourceSelect.value as PatSource) !== 'file') return
  const file = patFileInput.files?.[0]
  if (!file) return

  parsePatButton.disabled = true
  setPatStatus('Loading PAT file...')
  clearPatPreview()

  try {
    const text = await file.text()
    parsePatText(text)
  } catch (error) {
    console.error(error)
    setPatStatus(`PAT load failed: ${(error as Error).message}`)
  } finally {
    parsePatButton.disabled = false
  }
})

parsePatButton.addEventListener('click', async () => {
  if ((patSourceSelect.value as PatSource) !== 'file') {
    setPatStatus(
      'Switch source to "From local PAT file" to parse uploaded files.'
    )
    return
  }
  const file = patFileInput.files?.[0]
  if (!file) {
    setPatStatus('Please select a PAT file first.')
    return
  }

  parsePatButton.disabled = true
  setPatStatus('Parsing PAT...')
  try {
    const text = await file.text()
    parsePatText(text)
  } catch (error) {
    console.error(error)
    setPatStatus(`PAT parse failed: ${(error as Error).message}`)
  } finally {
    parsePatButton.disabled = false
  }
})

patSourceSelect.addEventListener('change', () => {
  applyPatSource()
})

applyPatSource()
