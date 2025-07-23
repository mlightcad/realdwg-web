import { AcCmColor } from '@mlightcad/common'
import { AcGeMatrix3d, AcGeVector3d } from '@mlightcad/geometry-engine'
import { AcGiEntity, AcGiRenderer } from '@mlightcad/graphic-interface'

import { AcDbBlockTableRecord } from '../database'

/**
 * Internal class used to cache rendered results to avoid duplicated rendering.
 * It can be used to improve performance to render block references.
 * Because differnt color will result in different material, the block name and
 * color are used together to create the key.
 * @internal
 */
export class AcDbRenderingCache {
  private _blocks: Map<string, AcGiEntity>
  private static _instance?: AcDbRenderingCache

  static get instance() {
    if (!this._instance) {
      this._instance = new AcDbRenderingCache()
    }
    return this._instance
  }

  constructor() {
    this._blocks = new Map()
  }

  /**
   * Create one key by combining the inputted name and the inputted color
   * @param name Input the name
   * @param color Input the color
   */
  createKey(name: string, color: number) {
    return `${name}_${color}`
  }

  /**
   * Store rendering results of one block in the cache.
   * @param key Input the key of the rendering results
   * @param group Input rendering results with specified key
   * @returns Return the inputted rendering results
   */
  set(key: string, group: AcGiEntity) {
    group = group.fastDeepClone()
    this._blocks.set(key, group)
    return group
  }

  /**
   * Get rendering results with the specified key
   * @param name Input the key of the rendering results
   * @return Return rendering results with the specified key if found it.
   * Othewise, return undefined.
   */
  get(name: string) {
    let block = this._blocks.get(name)
    if (block) {
      block = block.fastDeepClone()
    }
    return block
  }

  /**
   * Return true if the cache contains rendering results with the specified key.
   * @param name Input the key of the rendering results
   * @return Return true if the cache contains rendering results with the specified
   * key. Otherwise, reutrn false.
   */
  has(name: string) {
    return this._blocks.has(name)
  }

  /**
   * Remove all of rendering results stored in the cache.
   */
  clear() {
    this._blocks.clear()
  }

  /**
   * Render the specified the block. If rendering results of the block is already in cache,
   * use cached data. Otherwise, render it and store rendered results in cache.
   * @param renderer Input renderer used to render the block
   * @param blockTableRecord Input the block to render
   * @param color Input overriden color when color of entitis in the block is 'ByBlock'. If
   * not specified, use color of entities directly.
   * @param cache Input the flag whether to cache the rendering results
   * @param transform Input matrix transform applied on the block
   * @param normal Input extrusion direction of the block
   * @returns Return rendering results of the block
   */
  draw(
    renderer: AcGiRenderer,
    blockTableRecord: AcDbBlockTableRecord,
    color: number,
    cache: boolean = true,
    transform?: AcGeMatrix3d,
    normal?: AcGeVector3d
  ) {
    const results: AcGiEntity[] = []
    if (blockTableRecord != null) {
      const key = this.createKey(blockTableRecord.name, color)
      let block: AcGiEntity | undefined
      if (this.has(key)) {
        block = this.get(key)
      } else {
        const entities = blockTableRecord.newIterator()
        for (const entity of entities) {
          // If the color of this entity is 'byBlock', then store the original color of this entity color
          // and set the color of this entity to block's color. After renderering this entity, restore
          // its original color
          if (entity.color.isByBlock && color) {
            _tmpColor.copy(entity.color)
            entity.color.color = color
            const object = entity.draw(renderer)
            if (object) results.push(object)
            entity.color.copy(_tmpColor)
          } else {
            const object = entity.draw(renderer)
            if (object) results.push(object)
          }
        }
        block = renderer.group(results)
        if (block && cache) this.set(key, block)
      }

      if (block && transform) {
        block.applyMatrix(transform)
        if (normal && (normal.x != 0 || normal.y != 0 || normal.z != 1)) {
          transform.setFromExtrusionDirection(normal)
          block.applyMatrix(transform)
        }
      }
      return block
    } else {
      return renderer.group(results)
    }
  }
}

const _tmpColor = /*@__PURE__*/ new AcCmColor()
