/**
 * Best-effort wireframe extraction from SAT/ASM text (non-SAB) payloads.
 * Used when ACSH history provides inline text rather than ACDSDATA binary.
 */

import {
  type AcDbAcisEllipseCurveParams,
  type AcDbAcisVec3,
  acdbSampleAcisEllipseArc,
} from './AcDbAcisGeometry'

const DEFAULT_ELLIPSE_SAMPLES = 16

/**
 * Reads numeric tokens from one SAT record, skipping pointers and sentinel tokens.
 *
 * @param record - One SAT entity record line.
 * @param skipLeadingIndex - When true, skip the leading record index token.
 */
function readSatNumericTokens(record: string, skipLeadingIndex = true): number[] {
  const parts = record.split(/\s+/)
  const values: number[] = []
  let skippedIndex = !skipLeadingIndex
  for (const part of parts) {
    if (!skippedIndex && /^-?\d+$/.test(part)) {
      skippedIndex = true
      continue
    }
    if (part.startsWith('$') || part === 'I' || part === 'F' || part === '#') {
      continue
    }
    const value = Number.parseFloat(part)
    if (Number.isFinite(value)) {
      values.push(value)
    }
  }
  return values
}

/** Appends one line segment (`a` → `b`) to a flat coordinate buffer. */
function pushSegment(
  segments: number[],
  a: AcDbAcisVec3,
  b: AcDbAcisVec3,
): void {
  segments.push(a[0], a[1], a[2], b[0], b[1], b[2])
}

/** Splits SAT text into individual `#`-delimited entity records. */
function splitSatRecords(satText: string): string[] {
  return satText
    .split('#')
    .map(record => record.trim())
    .filter(record => record.length > 0)
}

/** Parses a `straight-curve` SAT record into start/end segment endpoints. */
function parseStraightCurve(record: string): [AcDbAcisVec3, AcDbAcisVec3] | null {
  if (!record.includes('straight-curve')) {
    return null
  }
  const values = readSatNumericTokens(record)
  if (values.length < 6) {
    return null
  }
  const ox = values[0]!
  const oy = values[1]!
  const oz = values[2]!
  const dx = values[3]!
  const dy = values[4]!
  const dz = values[5]!
  return [
    [ox, oy, oz],
    [ox + dx, oy + dy, oz + dz],
  ]
}

/** Parses an `ellipse-curve` SAT record into analytic curve parameters. */
function parseEllipseCurve(record: string): AcDbAcisEllipseCurveParams | null {
  if (!record.includes('ellipse-curve')) {
    return null
  }
  const values = readSatNumericTokens(record)
  if (values.length < 10) {
    return null
  }
  return {
    kind: 'ellipse',
    center: [values[0]!, values[1]!, values[2]!],
    normal: [values[3]!, values[4]!, values[5]!],
    majorAxis: [values[6]!, values[7]!, values[8]!],
    ratio: values[9]!,
  }
}

/**
 * Extract wireframe segments from a SAT text stream by matching common curve
 * records. This is a fallback when SAB decoding is unavailable.
 *
 * @param satText - Plain SAT/ASM text payload.
 * @returns Flat `Float32Array` of line-segment endpoint pairs (`[x,y,z,x,y,z,...]`).
 */
export function acdbAcisWireframeSegmentsFromSatText(satText: string): Float32Array {
  const segments: number[] = []
  if (!satText || satText.trim().length === 0) {
    return new Float32Array(0)
  }

  for (const record of splitSatRecords(satText)) {
    const straight = parseStraightCurve(record)
    if (straight !== null) {
      pushSegment(segments, straight[0], straight[1])
      continue
    }

    const ellipse = parseEllipseCurve(record)
    if (ellipse !== null) {
      const arc = acdbSampleAcisEllipseArc(ellipse, 0, Math.PI * 2, DEFAULT_ELLIPSE_SAMPLES)
      for (let i = 1; i < arc.length; i++) {
        pushSegment(segments, arc[i - 1]!, arc[i]!)
      }
    }
  }

  return new Float32Array(segments)
}
