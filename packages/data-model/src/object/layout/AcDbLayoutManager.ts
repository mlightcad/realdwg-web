import { AcCmEventManager } from '@mlightcad/common'

import { acdbHostApplicationServices, AcDbObjectId } from '../../base'
import { AcDbBlockTableRecord, AcDbDatabase } from '../../database'
import { AcDbLayout } from './AcDbLayout'

/**
 * Event arguments for layout-related events.
 */
export interface AcDbLayoutEventArgs {
  /** The previous layout */
  oldLayout: AcDbLayout
  /** The new layout */
  newLayout: AcDbLayout
}

/**
 * Manages layout objects in a drawing database.
 *
 * This class provides functionality for managing layouts, including creating,
 * finding, renaming, and switching between layouts. It also provides event
 * notifications when layouts are switched.
 *
 * @example
 * ```typescript
 * const layoutManager = new AcDbLayoutManager();
 * const layoutCount = layoutManager.countLayouts();
 * const activeLayout = layoutManager.findActiveLayout();
 * ```
 */
export class AcDbLayoutManager {
  /**
   * Events that can be triggered by the layout manager.
   *
   * These events allow applications to respond to layout changes.
   */
  public readonly events = {
    /** Fired when the layout is switched */
    layoutSwitched: new AcCmEventManager<AcDbLayoutEventArgs>()
  }

  /**
   * Gets the number of layouts in the layout dictionary.
   *
   * This includes the Model tab, which is always present.
   *
   * @param db - Drawing database to use (defaults to the current database)
   * @returns The number of layouts in the dictionary
   *
   * @example
   * ```typescript
   * const count = layoutManager.countLayouts();
   * console.log(`Number of layouts: ${count}`);
   * ```
   */
  countLayouts(db?: AcDbDatabase) {
    return this.getWorkingDatabase(db).dictionaries.layouts.numEntries
  }

  /**
   * Finds a layout by name in the database.
   *
   * @param name - Name of the layout to find
   * @param db - Drawing database to use (defaults to the current database)
   * @returns The layout object, or undefined if not found
   *
   * @example
   * ```typescript
   * const layout = layoutManager.findLayoutNamed('A4 Landscape');
   * if (layout) {
   *   console.log('Found layout:', layout.layoutName);
   * }
   * ```
   */
  findLayoutNamed(name: string, db?: AcDbDatabase) {
    return this.getWorkingDatabase(db).dictionaries.layouts.getAt(name)
  }

  /**
   * Gets the name of the active layout in the database.
   *
   * @returns The name of the active layout, or 'Model' if no layout is active
   *
   * @example
   * ```typescript
   * const activeLayoutName = layoutManager.findActiveLayout();
   * console.log('Active layout:', activeLayoutName);
   * ```
   */
  findActiveLayout() {
    const layout = this.getActiveLayout()
    return layout ? layout.layoutName : 'Model'
  }

  /**
   * Makes the layout object associated with the given object ID the current layout.
   *
   * @param id - Object ID for the layout object to make current
   * @param db - Drawing database to use (defaults to the current database)
   * @returns True if setting the current layout was successful, false otherwise
   *
   * @example
   * ```typescript
   * const success = layoutManager.setCurrentLayoutId('some-layout-id');
   * if (success) {
   *   console.log('Layout switched successfully');
   * }
   * ```
   */
  setCurrentLayoutId(id: AcDbObjectId, db?: AcDbDatabase) {
    const currentDb = this.getWorkingDatabase(db)
    const layout = currentDb.dictionaries.layouts.getIdAt(id)
    return this.setCurrentLayoutInternal(layout, currentDb)
  }

  /**
   * Makes the layout object associated with the given block table record ID the current layout.
   *
   * @param id - Block table record ID for the layout object to make current
   * @param db - Drawing database to use (defaults to the current database)
   * @returns True if setting the current layout was successful, false otherwise
   *
   * @example
   * ```typescript
   * const success = layoutManager.setCurrentLayoutBtrId('some-block-id');
   * ```
   */
  setCurrentLayoutBtrId(id: AcDbObjectId, db?: AcDbDatabase) {
    const currentDb = this.getWorkingDatabase(db)
    const layout = currentDb.dictionaries.layouts.getBtrIdAt(id)
    return this.setCurrentLayoutInternal(layout, currentDb)
  }

  /**
   * Sets the layout named 'name' as the current layout in the database.
   *
   * @param name - Name of the layout to make current
   * @param db - Drawing database to use (defaults to the current database)
   * @returns True if setting the current layout was successful, false otherwise
   *
   * @example
   * ```typescript
   * const success = layoutManager.setCurrentLayout('A4 Landscape');
   * ```
   */
  setCurrentLayout(name: string, db?: AcDbDatabase) {
    const currentDb = this.getWorkingDatabase(db)
    const layout = currentDb.dictionaries.layouts.getAt(name)
    return this.setCurrentLayoutInternal(layout, currentDb)
  }

  /**
   * Renames a layout in the database.
   *
   * @param oldName - Current name of the layout to rename
   * @param newName - New name for the layout
   * @param db - Drawing database to use (defaults to the current database)
   * @returns True if the layout was renamed successfully, false otherwise
   *
   * @example
   * ```typescript
   * const success = layoutManager.renameLayout('Old Name', 'New Name');
   * ```
   */
  renameLayout(oldName: string, newName: string, db?: AcDbDatabase) {
    const currentDb = this.getWorkingDatabase(db)
    const layout = currentDb.dictionaries.layouts.getAt(oldName)
    if (layout) {
      layout.layoutName = newName
      return true
    }
    return false
  }

  /**
   * Return true if the layout named 'name' is found in the database 'db' (or the
   * workingDatabase if 'db' isn't provided).
   * @param name Input name of layout to find.
   * @param db Input drawing database to use. Default is the current database.
   * @returns Return true if the layout named name is found in the database 'db'
   * (or the workingDatabase if 'db' isn't provided).
   */
  layoutExists(name: string, db?: AcDbDatabase) {
    return this.getWorkingDatabase(db).dictionaries.layouts.has(name)
  }

  /**
   * Delete the layout named 'name' from the database 'db' (or the workingDatabase
   * if 'db' isn't provided).
   * @param name Input name of layout to delete.
   * @param db Input drawing database to use. Default is the current database.
   * @returns
   */
  deleteLayout(name: string, db?: AcDbDatabase) {
    return this.getWorkingDatabase(db).dictionaries.layouts.remove(name)
  }

  /**
   * Create a new AcDbLayout object given a unique layout name.
   * @param name Input name to give new AcDbLayout object
   * @param db Input drawing database to use. Default is the current database.
   * @returns Return newly created layout and its associated block table record.
   */
  createLayout(name: string, db?: AcDbDatabase) {
    const currentDb = this.getWorkingDatabase(db)

    const layout = new AcDbLayout()
    layout.layoutName = name
    layout.tabOrder = currentDb.dictionaries.layouts.maxTabOrder

    const btr = new AcDbBlockTableRecord()
    btr.name = `*Paper_Space${layout.tabOrder}`
    currentDb.tables.blockTable.add(btr)

    currentDb.dictionaries.layouts.setAt(name, layout)

    return { layout: layout, btr: btr }
  }

  /**
   * Get active layout in the database 'db' (or the workingDatabase if 'db' isn't provided).
   * @param db Input drawing database to use. Default is the current database.
   * @returns Return active layout if found. Otherwise, return undefined.
   */
  getActiveLayout(db?: AcDbDatabase) {
    const currentDb = this.getWorkingDatabase(db)
    return currentDb.dictionaries.layouts.getBtrIdAt(currentDb.currentSpaceId)
  }

  private getWorkingDatabase(db?: AcDbDatabase) {
    return db || acdbHostApplicationServices().workingDatabase
  }

  private setCurrentLayoutInternal(
    layout: AcDbLayout | undefined,
    currentDb: AcDbDatabase
  ) {
    if (layout) {
      this.events.layoutSwitched.dispatch({
        oldLayout: this.getActiveLayout()!,
        newLayout: layout
      })
      currentDb.currentSpaceId = layout.blockTableRecordId
      return true
    }
    return false
  }
}
