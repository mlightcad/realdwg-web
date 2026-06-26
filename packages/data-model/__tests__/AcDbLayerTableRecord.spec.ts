import { AcCmColor, AcCmColorMethod } from '@mlightcad/common'

import { AcDbDatabase } from '../src/database/AcDbDatabase'
import { AcDbLayerTableRecord } from '../src/database/AcDbLayerTableRecord'
import { expectDetachedClone } from '../test-utils/cloneTestUtils'

describe('AcDbLayerTableRecord', () => {
  it('creates a detached clone with a new objectId', () => {
    expectDetachedClone(() => new AcDbLayerTableRecord())
  })

  it('dispatches layerModified on transaction commit', () => {
    const db = new AcDbDatabase()
    const layer = new AcDbLayerTableRecord({ name: 'Layer-A' })
    db.tables.layerTable.add(layer)

    const modified: Array<{
      name: string
      changes: Record<string, unknown>
    }> = []
    db.events.layerModified.addEventListener(args => {
      modified.push({
        name: args.layer.name,
        changes: args.changes as Record<string, unknown>
      })
    })

    db.transactionManager.runUndoable('Layer Edit', () => {
      layer.isOff = true
      layer.isOff = true
      layer.color = new AcCmColor(AcCmColorMethod.ByACI, 1)
    })

    expect(modified).toEqual([
      {
        name: 'Layer-A',
        changes: {
          isOff: true,
          color: layer.color
        }
      }
    ])
  })

  it('does not dispatch layerModified for edits outside a transaction', () => {
    const db = new AcDbDatabase()
    const layer = new AcDbLayerTableRecord({ name: 'Layer-A' })
    db.tables.layerTable.add(layer)

    const modified: unknown[] = []
    db.events.layerModified.addEventListener(args => modified.push(args))

    layer.isOff = true

    expect(modified).toEqual([])
  })
})
