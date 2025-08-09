import {
  AcCmPerformanceCollector,
  AcCmPerformanceEntry,
  AcCmTask,
  AcCmTaskScheduler
} from '@mlightcad/common'

import { AcDbRenderingCache } from '../misc'
import { AcDbDatabase } from './AcDbDatabase'

/**
 * Represents the different stages of DXF/DWG file conversion.
 * 
 * These stages define the order and types of operations performed
 * during the conversion of a DXF or DWG file into an AcDbDatabase.
 */
export type AcDbConversionStage =
  /**
   * Start DXF/DWG file conversion
   */
  | 'START'
  /**
   * Parsing DXF/DWG file
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

/**
 * Represents the status of a conversion stage.
 */
export type AcDbConversionStageStatus = 'START' | 'END' | 'IN-PROGRESS'

/**
 * Callback function to update progress when parsing one file.
 * 
 * This callback is called during the conversion process to provide
 * progress updates and stage information.
 * 
 * @param percentage - Finish percentage (0-100)
 * @param stage - Name of the current stage
 * @param stageStatus - Status of the current stage
 * @param data - Store data associated with the current stage. Its meaning varies by stage:
 *   - 'FONT' stage: fonts needed by this drawing
 * 
 * @example
 * ```typescript
 * const progressCallback: AcDbConversionProgressCallback = async (
 *   percentage,
 *   stage,
 *   stageStatus,
 *   data
 * ) => {
 *   console.log(`Progress: ${percentage}% - Stage: ${stage} - Status: ${stageStatus}`);
 *   if (stage === 'FONT' && data) {
 *     console.log('Fonts needed:', data);
 *   }
 * };
 * ```
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

/**
 * Interface defining the data for a conversion task.
 * 
 * @template TIn - The input type for the task
 * @template TOut - The output type for the task
 */
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

/**
 * Interface defining performance data for database conversion.
 */
export interface AcDbConvertDatabasePerformanceData {
  [key: string]: number
  total: number
}

const PERFORMANCE_ENTRY_NAME = 'Load Database'

/**
 * Task class for database conversion operations.
 * 
 * This class extends AcCmTask to provide specialized functionality
 * for database conversion tasks, including progress tracking and
 * stage management.
 * 
 * @template TIn - The input type for the task
 * @template TOut - The output type for the task
 */
class AcDbConversionTask<TIn, TOut> extends AcCmTask<TIn, TOut> {
  readonly data: AcDbConversionTaskData<TIn, TOut>
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
 * Abstract base class for database converters.
 * 
 * This class provides the foundation for converting various file formats
 * (such as DXF, DWG) into AcDbDatabase objects. It handles the conversion
 * process in stages and provides progress tracking capabilities.
 * 
 * @template TModel - The type of the parsed model data
 * 
 * @example
 * ```typescript
 * class MyConverter extends AcDbDatabaseConverter<MyModel> {
 *   protected parse(data: string | ArrayBuffer): MyModel {
 *     // Implementation for parsing data
 *   }
 *   
 *   protected processEntities(model: MyModel, db: AcDbDatabase) {
 *     // Implementation for processing entities
 *   }
 * }
 * ```
 */
export abstract class AcDbDatabaseConverter<TModel = unknown> {
  /** Optional progress callback for tracking conversion progress */
  progress?: AcDbConversionProgressCallback

  /**
   * Reads and converts data into an AcDbDatabase.
   * 
   * This method orchestrates the entire conversion process, including
   * parsing, processing various components (fonts, linetypes, styles, etc.),
   * and building the final database.
   * 
   * @param data - The input data to convert (string or ArrayBuffer)
   * @param db - The database to populate with converted data
   * @param minimumChunkSize - Minimum chunk size for batch processing
   * @param progress - Optional progress callback
   * @returns Promise that resolves when conversion is complete
   * 
   * @example
   * ```typescript
   * const converter = new MyConverter();
   * const database = new AcDbDatabase();
   * await converter.read(dxfData, database, 100, progressCallback);
   * ```
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
