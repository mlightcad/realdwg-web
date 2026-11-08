import { AcCmColor } from '@mlightcad/common'
import { AcGePoint3d } from '@mlightcad/geometry-engine'

import { AcDbDxfFiler } from '../src/base/AcDbDxfFiler'
import { AcDbDatabase } from '../src/database/AcDbDatabase'
import { AcDbLine } from '../src/entity/AcDbLine'
import { AcDbGroup } from '../src/object/AcDbGroup'

function createDb() {
  return new AcDbDatabase()
}

describe('AcDbGroup', () => {
  it('appends, prepends, inserts, and removes members', () => {
    const group = new AcDbGroup('desc')
    group.append('A')
    group.append(['B', 'C'])
    group.prepend('Z')
    group.insertAt(2, 'X')
    expect(group.entityIds).toEqual(['Z', 'A', 'X', 'B', 'C'])
    expect(group.numEntities()).toBe(5)
    expect(group.has('X')).toBe(true)
    expect(group.getIndex('B')).toBe(3)

    group.remove('X')
    group.removeAt(0)
    expect(group.entityIds).toEqual(['A', 'B', 'C'])

    group.replace('B', 'BB')
    expect(group.entityIds).toEqual(['A', 'BB', 'C'])

    group.reverse()
    expect(group.entityIds).toEqual(['C', 'BB', 'A'])

    group.transfer(0, 2, 1)
    expect(group.entityIds).toEqual(['BB', 'C', 'A'])

    group.clear()
    expect(group.numEntities()).toBe(0)
  })

  it('does not duplicate the same member id', () => {
    const group = new AcDbGroup()
    group.append('A')
    group.append('A')
    group.prepend('A')
    group.insertAt(0, 'A')
    expect(group.entityIds).toEqual(['A'])
  })

  it('exposes ObjectARX naming and flags', () => {
    const group = new AcDbGroup('Door tags', true)
    expect(group.description).toBe('Door tags')
    expect(group.selectable).toBe(true)
    expect(group.isAnonymous()).toBe(false)
    expect(group.isNotAccessible()).toBe(false)

    group.description = 'Updated'
    group.selectable = false
    group.setAnonymous()
    expect(group.description).toBe('Updated')
    expect(group.selectable).toBe(false)
    expect(group.isAnonymous()).toBe(true)
    expect(group.unnamed).toBe(true)
  })

  it('iterates members with AcDbObjectIterator', () => {
    const group = new AcDbGroup()
    group.append(['A', 'B', 'C'])
    expect([...group.newIterator()]).toEqual(['A', 'B', 'C'])
  })

  it('renames the ACAD_GROUP dictionary key via setName', () => {
    const db = createDb()
    const group = new AcDbGroup()
    group.objectId = 'G1'
    db.objects.group.setAt('OldName', group)
    group.name = 'OldName'
    group.database = db

    group.setName('NewName')
    expect(group.name).toBe('NewName')
    expect(db.objects.group.getAt('OldName')).toBeUndefined()
    expect(db.objects.group.getAt('NewName')).toBe(group)
  })

  it('renames via setName when _name was never set after setAt', () => {
    const db = createDb()
    const group = new AcDbGroup()
    group.objectId = 'G1'
    db.objects.group.setAt('OldName', group)
    group.database = db
    expect(group.name).toBe('')

    group.setName('NewName')
    expect(group.name).toBe('NewName')
    expect(db.objects.group.getAt('OldName')).toBeUndefined()
    expect(db.objects.group.getAt('NewName')).toBe(group)
  })

  it('leaves name and dict unchanged when setName targets a taken key', () => {
    const db = createDb()
    const a = new AcDbGroup()
    a.objectId = 'G1'
    const b = new AcDbGroup()
    b.objectId = 'G2'
    db.objects.group.setAt('A', a)
    db.objects.group.setAt('B', b)
    a.name = 'A'
    a.database = db

    a.setName('B')
    expect(a.name).toBe('A')
    expect(db.objects.group.getAt('A')).toBe(a)
    expect(db.objects.group.getAt('B')).toBe(b)
  })

  it('applies setColor / setLayer / setVisibility to member entities', () => {
    const db = createDb()
    const line = new AcDbLine(
      new AcGePoint3d(0, 0, 0),
      new AcGePoint3d(1, 0, 0)
    )
    line.objectId = 'E1'
    line.database = db
    db.commitObjectHandle(line)
    db.tables.blockTable.modelSpace.appendEntity(line)

    const group = new AcDbGroup()
    group.database = db
    group.append('E1')

    const color = new AcCmColor()
    color.colorIndex = 1
    group.setColor(color)
    group.setLayer('0')
    group.setVisibility(false)

    expect(line.color.colorIndex).toBe(1)
    expect(line.layer).toBe('0')
    expect(line.visibility).toBe(false)
  })

  it('round-trips description and flags through DXF fields', () => {
    const group = new AcDbGroup()
    group.description = 'Tags'
    group.anonymous = true
    group.selectable = false
    group.append(['E1', 'E2'])

    const out = new AcDbDxfFiler()
    group.dxfOutFields(out)
    const text = out.toString()

    expect(text).toContain('300\nTags')
    expect(text).toContain('70\n1')
    expect(text).toContain('71\n0')
    expect(text).toContain('340\nE1')

    const restored = new AcDbGroup()
    restored.dxfInFields(AcDbDxfFiler.fromString(text))
    expect(restored.description).toBe('Tags')
    expect(restored.isAnonymous()).toBe(true)
    expect(restored.selectable).toBe(false)
    expect(restored.entityIds).toEqual(['E1', 'E2'])
  })
})
