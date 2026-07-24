import { AcGePoint3d } from '@mlightcad/geometry-engine'

import type { AcDbDxfFiler } from '../base/AcDbDxfFiler'
import type { AcDbDatabase } from '../database/AcDbDatabase'
import { AcDbSystemVariables } from '../database/AcDbSystemVariables'
import { AcDbSysVarManager } from '../database/AcDbSysVarManager'
import {
  ByLayer,
  DEFAULT_MLEADER_STYLE,
  DEFAULT_MLINE_STYLE,
  DEFAULT_TEXT_STYLE
} from '../misc/AcDbConstants'

/**
 * Stream HEADER section variables into {@link AcDbDatabase}.
 * Expects the filer to be positioned after `(0,SECTION)/(2,HEADER)`.
 * Stops at `(0,ENDSEC)` without consuming pairs belonging to the next section.
 */
export function acdbDxfInHeader(filer: AcDbDxfFiler, db: AcDbDatabase): void {
  while (!filer.atEof) {
    const item = filer.peekItem()
    if (!item) break
    if (Number(item.code) === 0) {
      const name = String(item.value).toUpperCase()
      if (name === 'ENDSEC') {
        filer.readItem()
        break
      }
      // Unexpected object start inside HEADER — stop.
      break
    }

    filer.readItem()
    if (Number(item.code) !== 9) continue

    const varName = String(item.value).toUpperCase()
    applyHeaderVar(filer, db, varName)
  }
}

function applyHeaderVar(
  filer: AcDbDxfFiler,
  db: AcDbDatabase,
  varName: string
): void {
  switch (varName) {
    case '$ACADVER': {
      const v = readHeaderString(filer)
      if (v) db.version = v
      break
    }
    case '$CECOLOR': {
      const n = readHeaderNumber(filer)
      db.cecolor.colorIndex = n ?? 256
      break
    }
    case '$ANGBASE':
      db.angbase = readHeaderNumber(filer) ?? 0
      break
    case '$ANGDIR':
      db.angdir = readHeaderNumber(filer) ?? 0
      break
    case '$AUNITS': {
      const n = readHeaderNumber(filer)
      if (n != null) db.aunits = n
      break
    }
    case '$AUPREC': {
      const n = readHeaderNumber(filer)
      if (n != null) db.auprec = n
      break
    }
    case '$LUNITS': {
      const n = readHeaderNumber(filer)
      if (n != null) db.lunits = n
      break
    }
    case '$LUPREC': {
      const n = readHeaderNumber(filer)
      if (n != null) db.luprec = n
      break
    }
    case '$UNITMODE': {
      const n = readHeaderNumber(filer)
      if (n != null) db.unitmode = n
      break
    }
    case '$MEASUREMENT': {
      const n = readHeaderNumber(filer)
      if (n != null) db.measurement = n
      break
    }
    case '$CELTYPE':
      db.celtype = readHeaderString(filer) || ByLayer
      break
    case '$CETRANSPARENCY': {
      const v = readHeaderString(filer) || 'ByLayer'
      AcDbSysVarManager.instance().setVar(
        AcDbSystemVariables.CETRANSPARENCY,
        v,
        db
      )
      break
    }
    case '$CELTSCALE':
      db.celtscale = readHeaderNumber(filer) ?? 1
      break
    case '$CELWEIGHT': {
      const n = readHeaderNumber(filer)
      if (n != null) db.celweight = n
      break
    }
    case '$LWDISPLAY':
      db.lwdisplay = (readHeaderNumber(filer) ?? 0) !== 0
      break
    case '$TILEMODE':
      db.tilemode = (readHeaderNumber(filer) ?? 1) !== 0
      break
    case '$PSLTSCALE':
      db.psltscale = (readHeaderNumber(filer) ?? 1) !== 0
      break
    case '$CMLSTYLE':
    case 'CMLSTYLE':
      db.cmlstyle = readHeaderString(filer) || DEFAULT_MLINE_STYLE
      break
    case '$CMLSCALE':
    case 'CMLSCALE': {
      const n = readHeaderNumber(filer)
      if (n != null && Number.isFinite(n)) db.cmlscale = n
      break
    }
    case '$CMLEADERSTYLE':
    case 'CMLEADERSTYLE':
      db.cmleaderstyle = readHeaderString(filer) || DEFAULT_MLEADER_STYLE
      break
    case '$HPLAYER':
    case 'HPLAYER':
      db.hplayer = readHeaderString(filer) || '.'
      break
    case '$LTSCALE':
      db.ltscale = readHeaderNumber(filer) ?? 1
      break
    case '$EXTMAX': {
      const p = readHeaderPoint3d(filer)
      if (p) db.extmax = p
      break
    }
    case '$EXTMIN': {
      const p = readHeaderPoint3d(filer)
      if (p) db.extmin = p
      break
    }
    case '$INSUNITS': {
      const n = readHeaderNumber(filer)
      if (n != null) db.insunits = n
      break
    }
    case '$OSMODE':
      db.osmode = readHeaderNumber(filer) ?? 0
      break
    case '$ORTHOMODE':
      db.orthomode = readHeaderNumber(filer) ?? 0
      break
    case '$PDMODE':
      db.pdmode = readHeaderNumber(filer) ?? 0
      break
    case '$PDSIZE':
      db.pdsize = readHeaderNumber(filer) ?? 0
      break
    case '$TEXTSTYLE':
      db.textstyle = readHeaderString(filer) || DEFAULT_TEXT_STYLE
      break
    case '$DIMSTYLE':
      db.dimstyle = readHeaderString(filer) || DEFAULT_TEXT_STYLE
      break
    case '$CLAYER':
      db.clayer = readHeaderString(filer) || '0'
      break
    case '$HANDSEED': {
      const v = readHeaderString(filer)
      if (v) db.initializeHandleSeed(v)
      break
    }
    default:
      // Skip unknown header value pair(s). Point vars may span multiple codes;
      // consume until the next code 9 or 0.
      skipHeaderValue(filer)
      break
  }
}

function readHeaderString(filer: AcDbDxfFiler): string | undefined {
  const item = filer.readItem()
  if (!item) return undefined
  if (Number(item.code) === 9 || Number(item.code) === 0) {
    filer.pushBackItem(item)
    return undefined
  }
  return String(item.value)
}

function readHeaderNumber(filer: AcDbDxfFiler): number | undefined {
  const item = filer.readItem()
  if (!item) return undefined
  if (Number(item.code) === 9 || Number(item.code) === 0) {
    filer.pushBackItem(item)
    return undefined
  }
  const n = Number(item.value)
  return Number.isFinite(n) ? n : undefined
}

function readHeaderPoint3d(filer: AcDbDxfFiler): AcGePoint3d | undefined {
  let x = 0
  let y = 0
  let z = 0
  let got = false
  while (!filer.atEof) {
    const item = filer.peekItem()
    if (!item) break
    const code = Number(item.code)
    if (code === 9 || code === 0) break
    filer.readItem()
    const n = Number(item.value)
    if (code === 10) {
      x = n
      got = true
    } else if (code === 20) {
      y = n
      got = true
    } else if (code === 30) {
      z = n
      got = true
    }
  }
  return got ? new AcGePoint3d(x, y, z) : undefined
}

function skipHeaderValue(filer: AcDbDxfFiler): void {
  while (!filer.atEof) {
    const item = filer.peekItem()
    if (!item) break
    const code = Number(item.code)
    if (code === 9 || code === 0) break
    filer.readItem()
  }
}
