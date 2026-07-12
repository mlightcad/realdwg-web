import type { DxfObjectByHandle } from '../src/Acsh3dSolidResolver'
import { resolveAcshSolidAcisData } from '../src/Acsh3dSolidResolver'

describe('resolveAcshSolidAcisData', () => {
  it('returns synthetic SAT point records from ACSH history chain', () => {
    const objectByHandle: DxfObjectByHandle = {
      '157': {
        name: 'ACSH_HISTORY_CLASS',
        handle: '157',
        ownerObjectId: '154',
        evalGraphHardId: '156',
      } as any,
      '156': {
        name: 'ACAD_EVALUATION_GRAPH',
        handle: '156',
        ownerObjectId: '157',
        nodeObjectHardIds: ['155'],
      } as any,
      '155': {
        name: 'ACSH_BOX_CLASS',
        handle: '155',
        ownerObjectId: '156',
        transform: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
        length: 4,
        width: 6,
        height: 8,
      } as any,
    }

    const acisData = resolveAcshSolidAcisData('157', objectByHandle)

    expect(acisData).toContain('point $-1')
    expect(acisData).toContain('End-of-ACIS-data')
    expect(acisData.match(/point \$/g)?.length).toBe(8)
  })

  it('returns empty string when history object is missing', () => {
    expect(resolveAcshSolidAcisData('157', {})).toBe('')
    expect(resolveAcshSolidAcisData(undefined, {})).toBe('')
  })
})
