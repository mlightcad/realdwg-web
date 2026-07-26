import {
  AcCmColor,
  AcCmUiYieldGate,
  acCmYieldToUi
} from '@mlightcad/common'
import { AcGeMatrix3d, AcGeVector3d } from '@mlightcad/geometry-engine'
import { AcGiEntity, AcGiRenderer } from '@mlightcad/graphic-interface'

import { AcDbBlockTableRecord } from '../database/AcDbBlockTableRecord'
import { AcDbEntity } from '../entity/AcDbEntity'

/**
 * Optional timing counters for one cache-miss block build during
 * {@link AcDbRenderingCache.draw}. Enable with
 * {@link AcDbRenderingCache.profiling} = true.
 */
export interface AcDbRenderingCacheBlockMissProfile {
  /** Block table record name (or `'(unnamed)'`). */
  blockName: string
  /** Entity `worldDraw` + `group` time in ms (excludes compact). */
  buildMs: number
  /** `compactForInstancing` time in ms. */
  compactMs: number
  /** Time spent cloning the template in {@link AcDbRenderingCache.set}. */
  setCloneMs: number
}

/**
 * Accumulated timing counters for {@link AcDbRenderingCache}.
 * Only updated while {@link AcDbRenderingCache.profiling} is true.
 */
export interface AcDbRenderingCacheProfileStats {
  /** Cache hit count (template already built). */
  hits: number
  /** Cache miss count (template built on this call). */
  misses: number
  /** Total time spent on hit path before apply/attribs (includes clone). */
  hitMs: number
  /** Miss path: entity worldDraw + group, excluding compact. */
  missBuildMs: number
  /** Miss path: compactForInstancing. */
  missCompactMs: number
  /** Time spent in get() → fastDeepClone (hit clones). */
  cloneMs: number
  /** Time spent in set() → fastDeepClone (store template). */
  setCloneMs: number
  /** applyMatrix + attribute attach after template ready. */
  applyMs: number
  /**
   * Same counters as above but only for outermost `draw()` calls
   * (excludes nested INSERT draws while building a parent template).
   */
  topLevel: {
    /** Top-level cache hits. */
    hits: number
    /** Top-level cache misses. */
    misses: number
    /** Top-level hit-path time in ms. */
    hitMs: number
    /** Top-level miss build time in ms. */
    missBuildMs: number
    /** Top-level compact time in ms. */
    missCompactMs: number
    /** Top-level hit-clone time in ms. */
    cloneMs: number
    /** Top-level set-clone time in ms. */
    setCloneMs: number
    /** Top-level apply/attribute time in ms. */
    applyMs: number
  }
  /** Per-block miss breakdown (all depths). */
  blockMisses: AcDbRenderingCacheBlockMissProfile[]
}

/**
 * Creates a zeroed top-level profile counter bag.
 *
 * @returns Fresh top-level stats object.
 */
const emptyTopLevel = () => ({
  hits: 0,
  misses: 0,
  hitMs: 0,
  missBuildMs: 0,
  missCompactMs: 0,
  cloneMs: 0,
  setCloneMs: 0,
  applyMs: 0
})

/**
 * Creates a zeroed {@link AcDbRenderingCacheProfileStats} instance.
 *
 * @returns Fresh profile stats with empty `blockMisses`.
 */
const emptyProfileStats = (): AcDbRenderingCacheProfileStats => ({
  hits: 0,
  misses: 0,
  hitMs: 0,
  missBuildMs: 0,
  missCompactMs: 0,
  cloneMs: 0,
  setCloneMs: 0,
  applyMs: 0,
  topLevel: emptyTopLevel(),
  blockMisses: []
})

/**
 * Internal class used to cache rendered results to avoid duplicated rendering.
 *
 * This class can be used to improve performance when rendering block references.
 * Blocks without ByBlock-colored entities share one color-independent template.
 * Blocks that contain ByBlock entities still key by block name and color because
 * different INSERT colors produce different materials.
 *
 * Templates are compacted (same-material leaves merged) before caching so each
 * INSERT clones O(material) geometries instead of O(entity) geometries.
 *
 * @internal
 *
 * @example
 * ```typescript
 * const cache = AcDbRenderingCache.instance;
 * const color = new AcCmColor().setRGBValue(0xFF0000);
 * const key = cache.createKey('MyBlock', color);
 * const renderedEntity = cache.draw(renderer, blockRecord, color);
 * ```
 */
export class AcDbRenderingCache {
  /** Map of cached rendering results indexed by key. */
  private _blocks: Map<string, AcGiEntity>
  /** Singleton instance of the cache. */
  private static _instance?: AcDbRenderingCache
  /**
   * When true, {@link draw} / {@link get} / {@link set} accumulate
   * {@link profileStats}. Off by default (zero overhead when false).
   */
  static profiling = false
  /**
   * Mutable profile accumulator used while {@link profiling} is true.
   */
  private static _profileStats: AcDbRenderingCacheProfileStats =
    emptyProfileStats()
  /** Nesting depth of {@link draw} while profiling (1 = outermost). */
  private static _drawDepth = 0

  /**
   * Accumulated profile counters. Only updated while {@link profiling} is true.
   */
  static get profileStats(): Readonly<AcDbRenderingCacheProfileStats> {
    return this._profileStats
  }

  /**
   * Clears {@link profileStats} and draw nesting depth.
   * Leaves {@link profiling} unchanged.
   */
  static resetProfile() {
    this._profileStats = emptyProfileStats()
    this._drawDepth = 0
  }

  /**
   * Gets the singleton instance of the rendering cache.
   *
   * @returns The singleton instance of AcDbRenderingCache
   *
   * @example
   * ```typescript
   * const cache = AcDbRenderingCache.instance;
   * ```
   */
  static get instance() {
    if (!this._instance) {
      this._instance = new AcDbRenderingCache()
    }
    return this._instance
  }

  /**
   * Creates a new AcDbRenderingCache instance.
   *
   * @example
   * ```typescript
   * const cache = new AcDbRenderingCache();
   * ```
   */
  constructor() {
    this._blocks = new Map()
  }

  /**
   * Creates a cache key by combining the block name and color.
   *
   * Prefer {@link createCacheKey} when the block's ByBlock dependency is known,
   * so color-independent blocks can share one template.
   *
   * @param name - The block name
   * @param color - The resolved block color
   * @returns A unique key for the cache entry
   *
   * @example
   * ```typescript
   * const color = new AcCmColor().setRGBValue(0xFF0000);
   * const key = cache.createKey('MyBlock', color);
   * // Returns: "MyBlock_RGB:255,0,0"
   * ```
   */
  createKey(name: string, color: AcCmColor) {
    let colorKey = color.toString()
    if (!colorKey && color.isByColor) {
      colorKey = `RGB:${color.red},${color.green},${color.blue}`
    }
    return `${name}_${colorKey}`
  }

  /**
   * Creates a cache key, omitting color when the block has no ByBlock entities.
   *
   * Color-independent keys let INSERTs that differ only by layer (ByLayer
   * traits remapped at instance time) share one compacted template.
   *
   * @param name - The block name
   * @param color - The resolved INSERT color (used only when `hasByBlockColor`)
   * @param hasByBlockColor - Whether any entity in the block uses ByBlock color
   * @returns Cache key: `name` alone, or `name_color` when ByBlock entities exist
   */
  createCacheKey(name: string, color: AcCmColor, hasByBlockColor: boolean) {
    if (!hasByBlockColor) {
      return name
    }
    return this.createKey(name, color)
  }

  /**
   * Stores rendering results of a block in the cache.
   *
   * Deep-clones `group` so later mutations of the live instance cannot corrupt
   * the cached template.
   *
   * @param key - The key for the rendering results
   * @param group - The rendering results to store
   * @returns The stored rendering results (deep cloned)
   *
   * @example
   * ```typescript
   * const renderedEntity = cache.set(key, entity);
   * ```
   */
  set(key: string, group: AcGiEntity) {
    if (AcDbRenderingCache.profiling) {
      const t0 = performance.now()
      group = group.fastDeepClone()
      const dt = performance.now() - t0
      AcDbRenderingCache._profileStats.setCloneMs += dt
      if (AcDbRenderingCache._drawDepth === 1) {
        AcDbRenderingCache._profileStats.topLevel.setCloneMs += dt
      }
    } else {
      group = group.fastDeepClone()
    }
    this._blocks.set(key, group)
    return group
  }

  /**
   * Gets rendering results with the specified key.
   *
   * Returns a deep clone so callers can transform the instance without
   * mutating the cached template.
   *
   * @param name - The key of the rendering results
   * @returns The cloned rendering results, or `undefined` if not found
   *
   * @example
   * ```typescript
   * const cachedEntity = cache.get('MyBlock_16711680');
   * if (cachedEntity) {
   *   // Use cached entity
   * }
   * ```
   */
  get(name: string) {
    let block = this._blocks.get(name)
    if (block) {
      if (AcDbRenderingCache.profiling) {
        const t0 = performance.now()
        block = block.fastDeepClone()
        const dt = performance.now() - t0
        AcDbRenderingCache._profileStats.cloneMs += dt
        if (AcDbRenderingCache._drawDepth === 1) {
          AcDbRenderingCache._profileStats.topLevel.cloneMs += dt
        }
      } else {
        block = block.fastDeepClone()
      }
    }
    return block
  }

  /**
   * Checks if rendering results with the specified key exist in the cache.
   *
   * @param name - The key to check
   * @returns True if the key exists in the cache, false otherwise
   *
   * @example
   * ```typescript
   * if (cache.has('MyBlock_16711680')) {
   *   console.log('Cached result found');
   * }
   * ```
   */
  has(name: string) {
    return this._blocks.has(name)
  }

  /**
   * Clears all cached rendering results and disposes owned geometry.
   *
   * @example
   * ```typescript
   * cache.clear();
   * console.log('Cache cleared');
   * ```
   */
  clear() {
    this._blocks.forEach(block => {
      block.dispose?.()
    })
    this._blocks.clear()
  }

  /**
   * Prebuilds color-independent block templates before entity flush.
   *
   * Skips layout blocks (`*Model_Space` / `*Paper_Space*`), empty blocks,
   * anonymous `*U` blocks, and blocks that contain ByBlock-colored entities
   * (those require the INSERT color and are built on demand).
   *
   * @param renderer - Renderer used to convert block entities
   * @param blocks - Iterator over block table records
   * @param progress - Optional progress callback `(built, total, blockName)`
   */
  async prebuildAll(
    renderer: AcGiRenderer,
    blocks: Iterable<AcDbBlockTableRecord>,
    progress?: (
      built: number,
      total: number,
      blockName: string
    ) => void | Promise<void>
  ) {
    const candidates: AcDbBlockTableRecord[] = []
    for (const block of blocks) {
      if (!block || !block.name) {
        continue
      }
      if (this.shouldSkipPrebuild(block)) {
        continue
      }
      candidates.push(block)
    }

    const total = candidates.length
    let built = 0
    // Color is unused for color-independent templates (no ByBlock entities).
    const prebuildColor = new AcCmColor().setForeground()
    // Time-budgeted rAF yields so progressive open UI can paint between
    // large blocks without stalling on many small ones.
    const yieldGate = new AcCmUiYieldGate()
    for (const block of candidates) {
      const key = this.createCacheKey(block.name, prebuildColor, false)
      if (!this.has(key)) {
        this.draw(renderer, block, prebuildColor, [], true)
      }
      built++
      if (progress) {
        await progress(built, total, block.name)
      }
      await yieldGate.maybeYield(acCmYieldToUi)
    }
  }

  /**
   * Draws a block table record and optionally caches the result.
   *
   * This method renders the block table record using the specified renderer
   * and color, and optionally stores the result in the cache for future use.
   *
   * @param renderer - The renderer to use for drawing
   * @param blockTableRecord - The block table record to draw
   * @param blockColor - The resolved color to use for rendering
   * @param attributes - Attribute graphics to attach (WCS); converted to
   *   block-local space when `transform` is provided
   * @param cache - Whether to cache the rendering result (default: true)
   * @param transform - Optional block-reference transformation matrix
   * @param normal - Optional extrusion / normal vector
   * @returns The rendered entity
   *
   * @example
   * ```typescript
   * const renderedEntity = cache.draw(
   *   renderer,
   *   blockRecord,
   *   new AcCmColor().setRGBValue(0xFF0000),
   *   [],
   *   true,
   *   transform,
   *   normal
   * );
   * ```
   */
  draw(
    renderer: AcGiRenderer,
    blockTableRecord: AcDbBlockTableRecord,
    blockColor: AcCmColor,
    attributes: AcGiEntity[] = [],
    cache: boolean = true,
    transform?: AcGeMatrix3d,
    normal?: AcGeVector3d
  ) {
    const profile = AcDbRenderingCache.profiling
    if (profile) {
      AcDbRenderingCache._drawDepth++
    }
    const isTop = profile && AcDbRenderingCache._drawDepth === 1
    const stats = AcDbRenderingCache._profileStats
    const results: AcGiEntity[] = []
    try {
      if (blockTableRecord != null) {
        const blockRgb = blockColor.RGB ?? 0
        const hasByBlockColor = this.blockHasByBlockColor(blockTableRecord)
        const key = this.createCacheKey(
          blockTableRecord.name,
          blockColor,
          hasByBlockColor
        )
        let block: AcGiEntity | undefined
        if (this.has(key)) {
          const tHit0 = profile ? performance.now() : 0
          block = this.get(key)
          if (profile) {
            const dt = performance.now() - tHit0
            stats.hits++
            stats.hitMs += dt
            if (isTop) {
              stats.topLevel.hits++
              stats.topLevel.hitMs += dt
            }
          }
        } else {
          const tBuild0 = profile ? performance.now() : 0
          const entities = blockTableRecord.newIterator()
          for (const entity of entities) {
            if (!entity.visibility) {
              continue
            }
            // ByBlock entities temporarily inherit the INSERT color for material
            // creation. Use a local saved color so nested draw() calls cannot
            // corrupt a shared module-level scratch buffer.
            if (entity.color.isByBlock) {
              const savedColor = new AcCmColor().copy(entity.color)
              try {
                if (blockColor.isForeground) {
                  entity.color.setForeground()
                } else {
                  entity.color.setRGBValue(blockRgb)
                }
                this.addEntity(entity, results, renderer)
              } finally {
                entity.color.copy(savedColor)
              }
            } else {
              this.addEntity(entity, results, renderer)
            }
          }
          block = renderer.group(results)
          let buildMs = 0
          if (profile) {
            buildMs = performance.now() - tBuild0
            stats.missBuildMs += buildMs
            if (isTop) {
              stats.topLevel.missBuildMs += buildMs
            }
          }
          // Merge same-material leaves before caching so INSERT clones are cheap.
          let compactMs = 0
          if (block?.compactForInstancing) {
            const tCompact0 = profile ? performance.now() : 0
            block.compactForInstancing()
            if (profile) {
              compactMs = performance.now() - tCompact0
              stats.missCompactMs += compactMs
              if (isTop) {
                stats.topLevel.missCompactMs += compactMs
              }
            }
          }
          const setCloneBefore = profile ? stats.setCloneMs : 0
          if (block && cache) {
            // Transient anonymous blocks (*U…) are not reused across INSERTs.
            if (
              blockTableRecord.name &&
              !blockTableRecord.name.startsWith('*U')
            ) {
              this.set(key, block)
            }
          }
          if (profile) {
            stats.misses++
            if (isTop) {
              stats.topLevel.misses++
            }
            stats.blockMisses.push({
              blockName: blockTableRecord.name || '(unnamed)',
              buildMs,
              compactMs,
              setCloneMs: stats.setCloneMs - setCloneBefore
            })
          }
        }

        const tApply0 = profile ? performance.now() : 0
        if (block && transform) {
          _tmpWorldTransform.copy(transform)
          block.applyMatrix(_tmpWorldTransform)
          if (normal && (normal.x != 0 || normal.y != 0 || normal.z != 1)) {
            _tmpExtrusion.setFromExtrusionDirection(normal)
            block.applyMatrix(_tmpExtrusion)
            _tmpWorldTransform.premultiply(_tmpExtrusion)
          }
        }
        if (block && attributes && attributes.length > 0) {
          // Attribute geometry is emitted in WCS. Convert it to block-local space so
          // the block reference transform applied above places it correctly.
          const inverse =
            transform != null
              ? _tmpInverse.copy(_tmpWorldTransform).invert()
              : undefined
          attributes.forEach(attrib => {
            if (inverse) {
              attrib.applyMatrix(inverse)
            }
            block.addChild(attrib)
          })
        }
        if (profile) {
          const dt = performance.now() - tApply0
          stats.applyMs += dt
          if (isTop) {
            stats.topLevel.applyMs += dt
          }
        }
        return block
      } else {
        return renderer.group(results)
      }
    } finally {
      if (profile) {
        AcDbRenderingCache._drawDepth--
      }
    }
  }

  /**
   * Returns whether `block` should be excluded from {@link prebuildAll}.
   *
   * Skips layout blocks, anonymous `*U` blocks, blocks with ByBlock colors
   * (key depends on INSERT color), and blocks with no visible entities.
   *
   * @param block - Block table record to evaluate.
   * @returns `true` when the block should not be prebuilt.
   */
  private shouldSkipPrebuild(block: AcDbBlockTableRecord): boolean {
    const name = block.name
    if (
      AcDbBlockTableRecord.isModelSapceName(name) ||
      AcDbBlockTableRecord.isPaperSapceName(name)
    ) {
      return true
    }
    if (name.startsWith('*U')) {
      return true
    }
    if (this.blockHasByBlockColor(block)) {
      return true
    }
    // Empty blocks produce nothing useful to cache.
    for (const entity of block.newIterator()) {
      if (entity.visibility) {
        return false
      }
    }
    return true
  }

  /**
   * Returns whether any visible entity in the block uses ByBlock color.
   *
   * @param blockTableRecord - Block whose entities are scanned.
   * @returns `true` when at least one visible ByBlock-colored entity exists.
   */
  private blockHasByBlockColor(blockTableRecord: AcDbBlockTableRecord): boolean {
    for (const entity of blockTableRecord.newIterator()) {
      if (entity.visibility && entity.color.isByBlock) {
        return true
      }
    }
    return false
  }

  /**
   * Draws one visible entity and appends its graphic result to `results`.
   *
   * @param entity - Database entity to convert.
   * @param results - Accumulator for graphic-interface entities.
   * @param renderer - Renderer used for `worldDraw`.
   */
  private addEntity(
    entity: AcDbEntity,
    results: AcGiEntity[],
    renderer: AcGiRenderer
  ) {
    if (!entity.visibility) {
      return
    }
    const object = entity.worldDraw(renderer)
    if (object) {
      this.attachEntityInfo(object, entity)
      results.push(object)
    }
  }

  /**
   * Copies database identity/layer/visibility onto a graphic-interface entity.
   *
   * @param target - Graphic entity produced by `worldDraw`.
   * @param source - Source database entity.
   */
  private attachEntityInfo(target: AcGiEntity, source: AcDbEntity) {
    target.objectId = source.objectId
    target.ownerId = source.ownerId
    target.layerName = source.layer
    target.visible = source.visibility
  }
}

/** Scratch matrix for the INSERT world transform applied in {@link AcDbRenderingCache.draw}. */
const _tmpWorldTransform = /*@__PURE__*/ new AcGeMatrix3d()
/** Scratch matrix for extrusion/normal correction in {@link AcDbRenderingCache.draw}. */
const _tmpExtrusion = /*@__PURE__*/ new AcGeMatrix3d()
/** Scratch inverse of the world transform used to bring ATTRIB geometry into block space. */
const _tmpInverse = /*@__PURE__*/ new AcGeMatrix3d()
