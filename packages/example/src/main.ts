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

type ParseMode = 'compare' | 'main' | 'worker'

let lastFile: File | null = null
let lastBuffer: ArrayBuffer | null = null
let lastParsedDatabase: AcDbDatabase | null = null
let lastDownloadUrl: string | null = null
const patSvgRenderer = new AcDbPatSvgRenderer()
const patParser = new AcDbPatParser()

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

const getFileType = (fileName: string) => {
  const extension = fileName.split('.').pop()?.toLocaleLowerCase()
  return extension === 'dwg' ? AcDbFileType.DWG : AcDbFileType.DXF
}

const formatMs = (value: number) => `${value.toFixed(2)} ms`

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

type ParseResult =
  | { skipped: true; reason: string }
  | {
      database: AcDbDatabase
      skipped: false
      durationMs: number
      layers: { count: number; names: string[] }
    }

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

const compareTimes = (mainMs: number, workerMs: number) => {
  const diff = workerMs - mainMs
  const percent = (Math.abs(diff) / Math.max(mainMs, 1)) * 100
  if (diff === 0) return 'Worker and main thread are the same speed.'
  if (diff < 0) {
    return `Worker is ${percent.toFixed(1)}% faster than main thread.`
  }
  return `Worker is ${percent.toFixed(1)}% slower than main thread.`
}

const setStatus = (message: string) => {
  status.textContent = message
}

const getExportFileName = (fileName: string) => {
  const suffixIndex = fileName.lastIndexOf('.')
  const baseName = suffixIndex >= 0 ? fileName.slice(0, suffixIndex) : fileName
  return `${baseName}.dxf`
}

const updateExportButton = () => {
  const shouldShow = lastFile != null
  exportButton.hidden = !shouldShow
  exportButton.disabled = !shouldShow || lastParsedDatabase == null
}

const renderLayers = (layerInfo?: { count: number; names: string[] }) => {
  if (!layerInfo) return []
  const lines = [`Layers (${layerInfo.count})`]
  layerInfo.names.forEach(name => lines.push(`- ${name}`))
  return lines
}

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

const setPatStatus = (message: string) => {
  patStatus.textContent = message
}

const clearPatPreview = () => {
  patTableOutput.innerHTML = ''
}

type PatSource = 'predefined-acad' | 'predefined-acadiso' | 'file'

const getPredefinedPatDocument = (
  source: PatSource
): AcDbPatDocument | null => {
  if (source === 'predefined-acad') return AcDbPredefinedAcadPat
  if (source === 'predefined-acadiso') return AcDbPredefinedAcadIsoPat
  return null
}

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

const parsePatText = (text: string) => {
  const parsed = patParser.parse(text)
  loadPatDocument(parsed, 'Local PAT file')
}

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

const updatePatSourceUi = () => {
  const source = patSourceSelect.value as PatSource
  const isFileSource = source === 'file'
  patFileInput.disabled = !isFileSource
  parsePatButton.disabled = !isFileSource
}

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
