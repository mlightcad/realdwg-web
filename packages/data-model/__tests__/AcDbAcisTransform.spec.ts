import {
  acdbAcisTransformDirection,
  acdbAcisTransformIsIdentity,
  acdbAcisTransformPoint,
  acdbAcisTransformSegments,
  type AcDbAcisAffineTransform,
} from '../src/acis/AcDbAcisTransform'

const translationOnly: AcDbAcisAffineTransform = {
  xAxis: [1, 0, 0],
  yAxis: [0, 1, 0],
  zAxis: [0, 0, 1],
  translation: [-6438.553441499935, -965.402812514523, 0],
  scale: 1,
}

describe('AcDbAcisTransform', () => {
  it('detects identity transforms', () => {
    expect(
      acdbAcisTransformIsIdentity({
        xAxis: [1, 0, 0],
        yAxis: [0, 1, 0],
        zAxis: [0, 0, 1],
        translation: [0, 0, 0],
        scale: 1,
      }),
    ).toBe(true)
    expect(acdbAcisTransformIsIdentity(translationOnly)).toBe(false)
  })

  it('maps body-space points into model space with translation', () => {
    // Mirrors anteensolids equipment-03 solid A1AAD: body-space XY near
    // (6437–6438, 962–968) plus the body transform lands on the same local
    // frame as the block's LWPOLYLINE / LINE geometry.
    expect(
      acdbAcisTransformPoint([6437.353441499935, 962.277812514523, 14.2], translationOnly),
    ).toEqual([-1.199999999999818, -3.125, 14.2])
    expect(
      acdbAcisTransformPoint([6438.553441499935, 968.527812514523, 14.5], translationOnly),
    ).toEqual([0, 3.125, 14.5])
  })

  it('transforms directions without applying translation', () => {
    expect(acdbAcisTransformDirection([1, 0, 0], translationOnly)).toEqual([
      1, 0, 0,
    ])
  })

  it('transforms wireframe segment endpoints', () => {
    const segments = new Float32Array([
      6437.353441499935, 962.277812514523, 14.2, 6438.553441499935,
      968.527812514523, 14.5,
    ])
    const out = acdbAcisTransformSegments(segments, translationOnly)
    // Float32Array storage rounds intermediates; check model-space placement.
    expect(out[0]).toBeCloseTo(-1.2, 3)
    expect(out[1]).toBeCloseTo(-3.125, 3)
    expect(out[2]).toBeCloseTo(14.2, 5)
    expect(out[3]).toBeCloseTo(0, 3)
    expect(out[4]).toBeCloseTo(3.125, 3)
    expect(out[5]).toBeCloseTo(14.5, 5)
  })
})
