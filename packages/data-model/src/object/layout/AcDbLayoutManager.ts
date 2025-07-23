import { AcCmEventManager } from '@mlightcad/common'

import { acdbHostApplicationServices, AcDbObjectId } from '../../base'
import { AcDbBlockTableRecord, AcDbDatabase } from '../../database'
import { AcDbLayout } from './AcDbLayout'

export interface AcDbLayoutEventArgs {
  oldLayout: AcDbLayout
  newLayout: AcDbLayout
}

export class AcDbLayoutManager {
  public readonly events = {
    layoutSwitched: new AcCmEventManager<AcDbLayoutEventArgs>()
  }
  /**
   * Return the number of items in the layout dictionary which should represent the number of
   * AcDbLayout objects in the drawing. This includes the Model tab, which is always present.
   * @param db Input drawing database to use. Default is the current database.
   * @returns Return the number of items in the layout dictionary.
   */
  countLayouts(db?: AcDbDatabase) {
    return this.getWorkingDatabase(db).dictionaries.layouts.numEntries
  }

  /**
   * Find the layout "name" in the database 'db' (or the workingDatabase if 'db' isn't provided)
   * and return the layout object or undefined if no layout with that name is found.
   * @param name Input name of layout to find.
   * @param db Input drawing database to use. Default is the current database.
   * @returns Return the layout object or undefined if no layout with that name is found.
   */
  findLayoutNamed(name: string, db?: AcDbDatabase) {
    return this.getWorkingDatabase(db).dictionaries.layouts.getAt(name)
  }

  /**
   * Return the name of the active layout in the database 'db' (or the workingDatabase if
   * 'db' isn't provided).
   */
  findActiveLayout() {
    const layout = this.getActiveLayout()
    return layout ? layout.layoutName : 'Model'
  }

  /**
   * Make the layout object associated with the given object id the current layout
   * in the active database.
   * @param id Input object id for the layout object to make current
   * @param db Input drawing database to use. Default is the current database.
   * @returns Return true if setting current layout correctly. Otherwise, return false.
   */
  setCurrentLayoutId(id: AcDbObjectId, db?: AcDbDatabase) {
    const currentDb = this.getWorkingDatabase(db)
    const layout = currentDb.dictionaries.layouts.getIdAt(id)
    return this.setCurrentLayoutInternal(layout, currentDb)
  }

  /**
   * Make the layout object associated with the given block table record id the current layout
   * in the active database.
   * @param id Input object for the layout object to make current
   * @param db Input drawing database to use. Default is the current database.
   * @returns Return true if setting current layout correctly. Otherwise, return false.
   */
  setCurrentLayoutBtrId(id: AcDbObjectId, db?: AcDbDatabase) {
    const currentDb = this.getWorkingDatabase(db)
    const layout = currentDb.dictionaries.layouts.getBtrIdAt(id)
    return this.setCurrentLayoutInternal(layout, currentDb)
  }

  /**
   * Set the layout named 'name' as the current layout in the database 'db' (or the
   * workingDatabase if 'db' isn't provided).
   * @param name Input the layout named 'name' as the current layout in the database.
   * @param db Input drawing database to use. Default is the current database.
   * @returns Return true if setting current layout correctly. Otherwise, return false.
   */
  setCurrentLayout(name: string, db?: AcDbDatabase) {
    const currentDb = this.getWorkingDatabase(db)
    const layout = currentDb.dictionaries.layouts.getAt(name)
    return this.setCurrentLayoutInternal(layout, currentDb)
  }

  /**
   * Rename the layout named "oldName" to the new name "newName" in the database 'db'
   * (or the workingDatabase if 'db' isn't provided).
   * @param oldName Input name of layout to rename.
   * @param newName Input new name for layout.
   * @param db Input drawing database to use. Default is the current database.
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
