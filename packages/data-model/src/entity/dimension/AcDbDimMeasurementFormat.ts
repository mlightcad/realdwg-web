import {
  AcDbDimStyleTableRecord,
  AcDbDimZeroSuppression,
  AcDbDimZeroSuppressionAngular
} from '../../database/AcDbDimStyleTableRecord.js'

/**
 * Format a linear measurement using DIMSTYLE primary-unit settings.
 */
export function acdbFormatLinearMeasurement(
  raw: number,
  style: AcDbDimStyleTableRecord
): string {
  let value = raw * style.dimlfac
  if (style.dimrnd > 0) {
    value = Math.round(value / style.dimrnd) * style.dimrnd
  }

  // dimlunit: 1 scientific, 2 decimal, 3 engineering, 4 architectural, 5 fractional
  let body: string
  switch (style.dimlunit) {
    case 1:
      body = value.toExponential(Math.max(0, style.dimdec))
      break
    case 4:
    case 5:
      body = formatFractional(value, style.dimdec)
      break
    case 3:
      body = formatEngineering(value, style.dimdec)
      break
    case 2:
    default:
      body = formatDecimal(value, style.dimdec, style.dimdsep, style.dimzin)
      break
  }

  body = applyZeroSuppression(body, style.dimzin)
  return applyDimPost(body, style.dimpost)
}

/**
 * Format an angular measurement (radians) using DIMSTYLE angular settings.
 * dimaunit: 0 decimal degrees, 1 deg/min/sec, 2 gradians, 3 radians
 */
export function acdbFormatAngularMeasurement(
  radians: number,
  style: AcDbDimStyleTableRecord
): string {
  const abs = Math.abs(radians)
  let body: string
  switch (style.dimaunit) {
    case 1: {
      const degTotal = (abs * 180) / Math.PI
      const deg = Math.floor(degTotal)
      const minFloat = (degTotal - deg) * 60
      const min = Math.floor(minFloat)
      const sec = (minFloat - min) * 60
      const secStr =
        style.dimadec > 0
          ? sec.toFixed(style.dimadec)
          : String(Math.round(sec))
      body = `${deg}d${String(min).padStart(2, '0')}'${secStr}"`
      break
    }
    case 2:
      body = formatDecimal(
        (abs * 200) / Math.PI,
        style.dimadec,
        style.dimdsep,
        style.dimazin as number
      )
      body = `${body}g`
      break
    case 3:
      body = formatDecimal(
        abs,
        style.dimadec,
        style.dimdsep,
        style.dimazin as number
      )
      body = `${body}r`
      break
    case 0:
    default: {
      const degrees = (abs * 180) / Math.PI
      body = formatDecimal(
        degrees,
        style.dimadec,
        style.dimdsep,
        style.dimazin as number
      )
      // Trailing degree symbol for decimal degrees (AutoCAD convention)
      body = `${body}%%d`
      break
    }
  }

  body = applyAngularZeroSuppression(body, style.dimazin)
  return applyDimPost(body, style.dimpost)
}

/**
 * Resolve the final dimension annotation string, including <> placeholder,
 * alternate units, and tolerances when enabled.
 */
export function acdbResolveDimensionAnnotation(
  measuredRaw: number,
  dimensionText: string | null | undefined,
  style: AcDbDimStyleTableRecord,
  kind: 'linear' | 'angular' | 'radial' | 'diametric' = 'linear'
): string {
  if (dimensionText === '.') return ''

  let primary =
    kind === 'angular'
      ? acdbFormatAngularMeasurement(measuredRaw, style)
      : acdbFormatLinearMeasurement(measuredRaw, style)

  if (kind === 'radial' && !primary.startsWith('R')) {
    primary = `R${primary}`
  } else if (kind === 'diametric' && !primary.includes('%%c')) {
    primary = `%%c${primary}`
  }

  if (style.dimtol === 1 && kind !== 'angular') {
    const plus = style.dimtp.toFixed(Math.max(0, style.dimtdec))
    const minus = style.dimtm.toFixed(Math.max(0, style.dimtdec))
    // Approximate AutoCAD stacked tolerance with MTEXT codes
    primary = `${primary}{\\H0.7x;\\S+${plus}^-${minus};}`
  }

  if (style.dimalt === 1 && kind !== 'angular') {
    const altValue = measuredRaw * style.dimlfac * (style.dimaltf || 25.4)
    const altDec = style.dimaltd
    const altBody = formatDecimal(altValue, altDec, style.dimdsep, style.dimaltz)
    const altWithPost = applyDimPost(altBody, style.dimapost || '')
    primary = `${primary} [${altWithPost}]`
  }

  if (dimensionText == null || dimensionText === '') {
    return primary
  }
  if (dimensionText.includes('<>')) {
    return dimensionText.split('<>').join(primary)
  }
  return dimensionText
}

function formatDecimal(
  value: number,
  decimals: number,
  separator: string = '.',
  _zin: number = 0
): string {
  const fixed = value.toFixed(Math.max(0, decimals))
  if (separator && separator !== '.') {
    return fixed.replace('.', separator)
  }
  return fixed
}

function formatFractional(value: number, precision: number): string {
  const whole = Math.trunc(value)
  const frac = Math.abs(value - whole)
  const denom = Math.max(1, Math.pow(2, Math.min(6, Math.max(0, precision))))
  const num = Math.round(frac * denom)
  if (num === 0) return String(whole)
  if (num === denom) return String(whole + (value < 0 ? -1 : 1))
  // Reduce fraction
  const g = gcd(num, denom)
  const n = num / g
  const d = denom / g
  if (whole === 0) return `${value < 0 ? '-' : ''}${n}/${d}`
  return `${whole} ${n}/${d}`
}

function formatEngineering(value: number, decimals: number): string {
  const feet = Math.trunc(value / 12)
  const inches = value - feet * 12
  return `${feet}'-${inches.toFixed(Math.max(0, decimals))}"`
}

function applyDimPost(body: string, dimpost: string): string {
  if (!dimpost) return body
  if (dimpost.includes('<>')) {
    return dimpost.split('<>').join(body)
  }
  return `${body}${dimpost}`
}

function applyZeroSuppression(body: string, zin: number): string {
  // Leading / trailing zero suppression for decimal strings
  if (
    (zin & AcDbDimZeroSuppression.Leading) !== 0 &&
    body.startsWith('0.')
  ) {
    body = body.slice(1)
  }
  if ((zin & AcDbDimZeroSuppression.Trailing) !== 0 && body.includes('.')) {
    body = body.replace(/\.?0+$/, '')
  }
  return body
}

function applyAngularZeroSuppression(
  body: string,
  azin: AcDbDimZeroSuppressionAngular | number
): string {
  if (
    (azin === AcDbDimZeroSuppressionAngular.Leading ||
      azin === AcDbDimZeroSuppressionAngular.LeadingAndTrailing) &&
    body.startsWith('0.')
  ) {
    body = body.slice(1)
  }
  if (
    (azin === AcDbDimZeroSuppressionAngular.Trailing ||
      azin === AcDbDimZeroSuppressionAngular.LeadingAndTrailing) &&
    body.includes('.')
  ) {
    body = body
      .replace(/(\.\d*?)0+(%%d|g|r|"|')?$/, '$1$2')
      .replace(/\.(%%d|g|r)/, '$1')
  }
  return body
}

function gcd(a: number, b: number): number {
  let x = Math.abs(a)
  let y = Math.abs(b)
  while (y) {
    const t = y
    y = x % y
    x = t
  }
  return x || 1
}
