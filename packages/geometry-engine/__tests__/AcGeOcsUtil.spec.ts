import {
  acgeGetOcsAngle,
  acgeGetOcsReferenceVector,
  acgeTransformOcsPointToWcs,
  acgeTransformWcsPointToOcs
} from '../src'

describe('AcGeOcsUtil', () => {
  it('converts OCS points to WCS and back for negative Z extrusion', () => {
    const normal = { x: 0, y: 0, z: -1 }

    const wcs = acgeTransformOcsPointToWcs({ x: 1, y: 2, z: 3 }, normal)
    expect(wcs).toMatchObject({ x: -1, y: 2, z: -3 })

    const ocs = acgeTransformWcsPointToOcs(wcs, normal)
    expect(ocs).toMatchObject({ x: 1, y: 2, z: 3 })
  })

  it('returns the OCS reference vector and angles in WCS coordinates', () => {
    const normal = { x: 0, y: 0, z: -1 }
    const refVec = acgeGetOcsReferenceVector(normal)

    expect(refVec).toMatchObject({ x: -1, y: 0, z: 0 })

    const center = acgeTransformOcsPointToWcs({ x: 1, y: 2, z: 0 }, normal)
    const start = acgeTransformOcsPointToWcs({ x: 2, y: 2, z: 0 }, normal)
    const end = acgeTransformOcsPointToWcs({ x: 1, y: 3, z: 0 }, normal)

    expect(acgeGetOcsAngle(center, start, normal)).toBeCloseTo(0, 8)
    expect(acgeGetOcsAngle(center, end, normal)).toBeCloseTo(Math.PI / 2, 8)
  })
})
