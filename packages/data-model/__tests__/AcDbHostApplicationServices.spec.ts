import {
  AcDbHostApplicationServices,
  acdbHostApplicationServices,
  setAcDbLayoutManagerFactory
} from '../src/base/AcDbHostApplicationServices'
import { AcDbDatabase } from '../src/database/AcDbDatabase'

describe('AcDbHostApplicationServices', () => {
  it('exposes singleton, database and lazy layout manager', () => {
    const services = acdbHostApplicationServices()
    expect(services).toBe(AcDbHostApplicationServices.instance)
    ;(
      services as unknown as { _workingDatabase: AcDbDatabase | null }
    )._workingDatabase = null
    expect(() => services.workingDatabase).toThrow(
      'The current working database must be set before using it!'
    )

    const db = new AcDbDatabase()
    services.workingDatabase = db
    expect(services.workingDatabase).toBe(db)
    ;(services as unknown as { _layoutManager?: unknown })._layoutManager =
      undefined
    setAcDbLayoutManagerFactory(() => ({ kind: 'layout' }) as never)
    expect(services.layoutManager).toEqual({ kind: 'layout' })
  })

  it('throws when layout manager factory is not registered', () => {
    const services = acdbHostApplicationServices()
    ;(services as unknown as { _layoutManager?: unknown })._layoutManager =
      undefined
    setAcDbLayoutManagerFactory(undefined as never)
    expect(() => services.layoutManager).toThrow(
      'The layout manager factory must be registered before using it!'
    )
  })
})
