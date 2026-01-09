import {
  AcDbDatabase,
  AcDbDatabaseConverterManager,
  AcDbDxfConverter,
  AcDbFileType,
  acdbHostApplicationServices,
  AcDbOpenDatabaseOptions
} from '@mlightcad/data-model'
import { AcDbLibreDwgConverter } from '@mlightcad/libredwg-converter'

const fileInput = document.getElementById('fileInput') as HTMLInputElement
const output = document.getElementById('output') as HTMLPreElement

let isRegistered = false
const registerConverters = () => {
  // Register DXF converter
  try {
    const converter = new AcDbDxfConverter({
      convertByEntityType: false,
      useWorker: true,
      parserWorkerUrl: './assets/dxf-parser-worker.js'
    })
    AcDbDatabaseConverterManager.instance.register(AcDbFileType.DXF, converter)
  } catch (error) {
    console.error('Failed to register dxf converter: ', error)
  }

  // Register DWG converter
  try {
    const converter = new AcDbLibreDwgConverter({
      convertByEntityType: false,
      useWorker: true,
      parserWorkerUrl: './assets/libredwg-parser-worker.js'
    })
    AcDbDatabaseConverterManager.instance.register(AcDbFileType.DWG, converter)
  } catch (error) {
    console.error('Failed to register dwg converter: ', error)
  }

  isRegistered = true
}

fileInput.addEventListener('change', async () => {
  const file = fileInput.files?.[0]
  if (!file) return

  if (!isRegistered) registerConverters()

  output.textContent = 'Parsing file...\n'

  const buffer = await file.arrayBuffer()
  const fileExtension = file.name.split('.').pop()?.toLocaleLowerCase()
  const database = new AcDbDatabase()
  acdbHostApplicationServices().workingDatabase = database
  const options: AcDbOpenDatabaseOptions = {
    minimumChunkSize: 1000,
    readOnly: true
  }
  await database.read(
    buffer,
    options,
    fileExtension == 'dwg' ? AcDbFileType.DWG : AcDbFileType.DXF
  )

  const layers = database.tables.layerTable.newIterator()
  output.textContent = `Layers (${layers.count})\n`
  for (const layer of layers) {
    output.textContent += `- ${layer.name}\n`
  }
})
