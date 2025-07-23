import {
  AcCmPerformanceCollector,
  AcCmPerformanceEntry,
  AcCmTask,
  AcCmTaskScheduler
} from '@mlightcad/common'

import { AcDbRenderingCache } from '../misc'
import { AcDbDatabase } from './AcDbDatabase'

export type AcDbConversionStage =
  /**
   * Start DXF/DWG file conversion
   */
  | 'START'
  /**
   * Prasing DXF/DWG file
   */
  | 'PARSE'
  /**
   * Downloading font files
   */
  | 'FONT'
  /**
   * Converting line types
   */
  | 'LTYPE'
  /**
   * Converting text styles
   */
  | 'STYLE'
  /**
   * Converting dimension styles
   */
  | 'DIMSTYLE'
  /**
   * Converting layers
   */
  | 'LAYER'
  /**
   * Converting viewports
   */
  | 'VPORT'
  /**
   * Converting block table record
   */
  | 'BLOCK_RECORD'
  /**
   * Converting file header
   */
  | 'HEADER'
  /**
   * Converting blocks
   */
  | 'BLOCK'
  /**
   * Converting entities in model space
   */
  | 'ENTITY'
  /**
   * Converting objects such as nod
   */
  | 'OBJECT'
  /**
   * Finish file conversion
   */
  | 'END'

export type AcDbConversionStageStatus = 'START' | 'END' | 'IN-PROGRESS'

/**
 * Callback function to update progress when parsing one file
 */
export type AcDbConversionProgressCallback = (
  /**
   * Finish percentage
   */
  percentage: number,
  /**
   * Name of the current stage.
   */
  stage: AcDbConversionStage,
  /**
   * Status of the current stage.
   */
  stageStatus: AcDbConversionStageStatus,
  /**
   * Store data associated with the current stage. Its meaning of different stages are as follows.
   * - 'FONT' stage: fonts needed by this drawing
   *
   * Note: For now, 'FONT' stage uses this field only.
   */
  data?: unknown
) => Promise<void>

interface AcDbConversionTaskData<TIn, TOut> {
  /**
   * The name of the task.
   */
  stage: AcDbConversionStage
  /**
   * The step of this task to add in the overall process.
   */
  step: number
  /**
   * The progress of the overall process.
   */
  progress: { value: number }
  /**
   * The function to notify progress.
   */
  task: (input: TIn) => Promise<TOut>
}

export interface AcDbConvertDatabasePerformanceData {
  [key: string]: number
  total: number
}

const PERFORMANCE_ENTRY_NAME = 'Load Database'

/**
 * A specialized task that includes additional data for dwg conversion.
 * @template TIn Input type
 * @template TOut Output type
 */
class AcDbConversionTask<TIn, TOut> extends AcCmTask<TIn, TOut> {
  readonly data: AcDbConversionTaskData<TIn, TOut>
  /**
   * The function to notify progress.
   */
  readonly progress?: AcDbConversionProgressCallback

  constructor(
    data: AcDbConversionTaskData<TIn, TOut>,
    progress?: AcDbConversionProgressCallback
  ) {
    super(data.stage)
    this.data = data
    this.progress = progress
  }

  /**
   * Executes the task.
   */
  async run(input: TIn): Promise<TOut> {
    const entry = AcCmPerformanceCollector.getInstance().getEntry(
      PERFORMANCE_ENTRY_NAME
    )
    const t = Date.now()

    if (this.progress) {
      await this.progress(this.data.progress.value, this.data.stage, 'START')
    }
    const out = await this.data.task(input)
    if (this.progress) {
      const outData = (out as { data?: unknown }).data
      await this.progress(
        this.data.progress.value,
        this.data.stage,
        'END',
        outData
      )
      this.data.progress.value += this.data.step
      if (this.data.progress.value > 100) {
        this.data.progress.value = 100
      }
    }
    if (entry) {
      ;(entry as AcCmPerformanceEntry<AcDbConvertDatabasePerformanceData>).data[
        this.name
      ] = Date.now() - t
    }

    return out
  }
}

/**
 * It defines interface that one drawing database convert should follow. One drawing database converter
 * can convert one dxf/dwg file to one instance of AcDbDatabase.
 */
export abstract class AcDbDatabaseConverter<TModel = unknown> {
  progress?: AcDbConversionProgressCallback

  /**
   * Read the drawing specified by data and store them into the specified database. It will break up
   * entities in the drawing into smaller chunks that are processed asynchronously to allow the UI to
   * remain responsive.
   * @param data Input drawing data in dxf format
   * @param db Input database to store drawing data
   * @param progress Input optional callback function to update progress
   * @param minimumChunkSize Input the minimum number of entities in one chunk. If it is greater than
   * the total number of entities to process, the total number is used.
   */
  async read(
    data: string | ArrayBuffer,
    db: AcDbDatabase,
    minimumChunkSize: number,
    progress?: AcDbConversionProgressCallback
  ) {
    const loadDbTimeEntry: AcCmPerformanceEntry<AcDbConvertDatabasePerformanceData> =
      {
        name: PERFORMANCE_ENTRY_NAME,
        data: { total: 0 },
        format() {
          let result = ''
          Object.keys(this.data).forEach(key => {
            if (key !== 'total') {
              result += `- ${key}: ${this.data[key]} ms\n`
            }
          })
          result += `- total: ${this.data.total} ms`
          return result
        }
      }
    AcCmPerformanceCollector.getInstance().collect(loadDbTimeEntry)

    this.progress = progress

    const percentage = { value: 0 }
    const scheduler = new AcCmTaskScheduler<string | ArrayBuffer, void>()
    scheduler.setCompleteCallback(() => this.onFinished())
    scheduler.setErrorCallback(() => this.onFinished())
    scheduler.addTask(
      new AcDbConversionTask(
        {
          stage: 'START',
          step: 1,
          progress: percentage,
          task: async (data: string | ArrayBuffer) => {
            return data
          }
        },
        progress
      )
    )
    scheduler.addTask(
      new AcDbConversionTask(
        {
          stage: 'PARSE',
          step: 5,
          progress: percentage,
          task: async (data: string | ArrayBuffer) => {
            const model = await this.parse(data)
            return { model }
          }
        },
        progress
      )
    )
    scheduler.addTask(
      new AcDbConversionTask(
        {
          stage: 'FONT',
          step: 5,
          progress: percentage,
          task: async (data: { model: TModel }) => {
            const fonts = this.getFonts(data.model)
            return { model: data.model, data: fonts }
          }
        },
        progress
      )
    )
    scheduler.addTask(
      new AcDbConversionTask(
        {
          stage: 'LTYPE',
          step: 1,
          progress: percentage,
          task: async (data: { model: TModel }) => {
            this.processLineTypes(data.model, db)
            return data
          }
        },
        progress
      )
    )
    scheduler.addTask(
      new AcDbConversionTask(
        {
          stage: 'STYLE',
          step: 1,
          progress: percentage,
          task: async (data: { model: TModel }) => {
            this.processTextStyles(data.model, db)
            return data
          }
        },
        progress
      )
    )
    scheduler.addTask(
      new AcDbConversionTask(
        {
          stage: 'DIMSTYLE',
          step: 1,
          progress: percentage,
          task: async (data: { model: TModel }) => {
            this.processDimStyles(data.model, db)
            return data
          }
        },
        progress
      )
    )
    scheduler.addTask(
      new AcDbConversionTask(
        {
          stage: 'LAYER',
          step: 1,
          progress: percentage,
          task: async (data: { model: TModel }) => {
            this.processLayers(data.model, db)
            return data
          }
        },
        progress
      )
    )
    scheduler.addTask(
      new AcDbConversionTask(
        {
          stage: 'VPORT',
          step: 1,
          progress: percentage,
          task: async (data: { model: TModel }) => {
            this.processViewports(data.model, db)
            return data
          }
        },
        progress
      )
    )
    scheduler.addTask(
      new AcDbConversionTask(
        {
          stage: 'HEADER',
          step: 1,
          progress: percentage,
          task: async (data: { model: TModel }) => {
            this.processHeader(data.model, db)
            return data
          }
        },
        progress
      )
    )
    scheduler.addTask(
      new AcDbConversionTask(
        {
          stage: 'BLOCK_RECORD',
          step: 5,
          progress: percentage,
          task: async (data: { model: TModel }) => {
            this.processBlockTables(data.model, db)
            return data
          }
        },
        progress
      )
    )
    scheduler.addTask(
      new AcDbConversionTask(
        {
          stage: 'OBJECT',
          step: 5,
          progress: percentage,
          task: async (data: { model: TModel }) => {
            this.processObjects(data.model, db)
            return data
          }
        },
        progress
      )
    )
    scheduler.addTask(
      new AcDbConversionTask(
        {
          stage: 'BLOCK',
          step: 5,
          progress: percentage,
          task: async (data: { model: TModel }) => {
            await this.processBlocks(data.model, db)
            return data
          }
        },
        progress
      )
    )
    scheduler.addTask(
      new AcDbConversionTask(
        {
          stage: 'ENTITY',
          step: 100,
          progress: percentage,
          task: async (data: { model: TModel }) => {
            await this.processEntities(
              data.model,
              db,
              minimumChunkSize,
              percentage,
              progress
            )
            return data
          }
        },
        progress
      )
    )
    scheduler.addTask(
      new AcDbConversionTask(
        {
          stage: 'END',
          step: 0,
          progress: percentage,
          task: async (data: { model: TModel }) => {
            return data
          }
        },
        progress
      )
    )

    const t = Date.now()
    await scheduler.run(data)
    loadDbTimeEntry.data.total = Date.now() - t
  }

  protected onFinished() {
    if (this.progress) {
      this.progress(100, 'END', 'END')
      // Clear cache to reduce memory consumption
      AcDbRenderingCache.instance.clear()
    }
  }

  protected parse(_data: string | ArrayBuffer): TModel {
    throw new Error('Not impelemented yet!')
  }

  protected getFonts(_model: TModel): string[] {
    throw new Error('Not impelemented yet!')
  }

  protected processLineTypes(_model: TModel, _db: AcDbDatabase) {
    throw new Error('Not impelemented yet!')
  }

  protected processTextStyles(_model: TModel, _db: AcDbDatabase) {
    throw new Error('Not impelemented yet!')
  }

  protected processDimStyles(_model: TModel, _db: AcDbDatabase) {
    throw new Error('Not impelemented yet!')
  }

  protected processLayers(_model: TModel, _db: AcDbDatabase) {
    throw new Error('Not impelemented yet!')
  }

  protected processViewports(_model: TModel, _db: AcDbDatabase) {
    throw new Error('Not impelemented yet!')
  }

  protected processHeader(_model: TModel, _db: AcDbDatabase) {
    throw new Error('Not impelemented yet!')
  }

  protected processBlockTables(_model: TModel, _db: AcDbDatabase) {
    throw new Error('Not impelemented yet!')
  }

  protected processObjects(_model: TModel, _db: AcDbDatabase) {
    throw new Error('Not impelemented yet!')
  }

  protected processBlocks(_model: TModel, _db: AcDbDatabase) {
    throw new Error('Not impelemented yet!')
  }

  protected processEntities(
    _model: TModel,
    _db: AcDbDatabase,
    _minimumChunkSize: number,
    _percentage: { value: number },
    _progress?: AcDbConversionProgressCallback
  ) {
    throw new Error('Not impelemented yet!')
  }
}
