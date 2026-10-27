import { AcCmColor } from '@mlightcad/common'
import { AcGeLine2d, AcGeLoop2d } from '@mlightcad/geometry-engine'

import { AcDbBlockTableRecord } from '../database/AcDbBlockTableRecord.js'
import { AcDbDatabase } from '../database/AcDbDatabase.js'
import { AcDbDimStyleTableRecord } from '../database/AcDbDimStyleTableRecord.js'
import { AcDbLayerTableRecord } from '../database/AcDbLayerTableRecord.js'
import { AcDbLinetypeTableRecord } from '../database/AcDbLinetypeTableRecord.js'
import { AcDbTextStyleTableRecord } from '../database/AcDbTextStyleTableRecord.js'
import { AcDbHatch } from '../entity/AcDbHatch.js'
import { AcDbLine } from '../entity/AcDbLine.js'
import { AcDbLayout } from '../object/layout/AcDbLayout.js'
import { DEFAULT_TEXT_STYLE, HATCH_PATTERN_SOLID } from './AcDbConstants.js'

export class AcDbDataGenerator {
  readonly db: AcDbDatabase
  constructor(db: AcDbDatabase) {
    this.db = db
  }
  createDefaultLayer() {
    const defaultColor = new AcCmColor()
    defaultColor.colorIndex = 7 // white
    return this.db.tables.layerTable.add(
      new AcDbLayerTableRecord({
        name: '0',
        standardFlags: 0,
        linetype: 'Continuous',
        lineWeight: 0,
        isOff: false,
        color: defaultColor,
        isPlottable: true
      })
    )
  }

  createDefaultLineType() {
    this.db.tables.linetypeTable.add(
      new AcDbLinetypeTableRecord({
        name: 'ByBlock',
        standardFlag: 0,
        description: '',
        totalPatternLength: 0
      })
    )
    this.db.tables.linetypeTable.add(
      new AcDbLinetypeTableRecord({
        name: 'ByLayer',
        standardFlag: 0,
        description: '',
        totalPatternLength: 0
      })
    )
    this.db.tables.linetypeTable.add(
      new AcDbLinetypeTableRecord({
        name: 'Continuous',
        standardFlag: 0,
        description: 'Solid line',
        totalPatternLength: 0
      })
    )
  }

  createDefaultTextStyle() {
    this.db.tables.textStyleTable.add(
      new AcDbTextStyleTableRecord({
        name: DEFAULT_TEXT_STYLE,
        standardFlag: 0,
        fixedTextHeight: 0,
        widthFactor: 1,
        obliqueAngle: 0,
        textGenerationFlag: 0,
        lastHeight: 0.2,
        font: 'SimKai',
        bigFont: '',
        extendedFont: 'SimKai'
      })
    )
  }

  createDefaultDimStyle() {
    this.db.tables.dimStyleTable.add(
      new AcDbDimStyleTableRecord({
        name: DEFAULT_TEXT_STYLE,
        dimtxsty: DEFAULT_TEXT_STYLE
      })
    )
  }

  createDefaultLayout() {
    const modelSpace = this.db.tables.blockTable.modelSpace
    const layout = new AcDbLayout()
    layout.layoutName = 'Model'
    layout.tabOrder = 0
    layout.blockTableRecordId = modelSpace.objectId
    layout.limits.min.copy({ x: 0, y: 0 })
    layout.limits.max.copy({ x: 1000000, y: 1000000 })
    layout.extents.min.copy({ x: 0, y: 0, z: 0 })
    layout.extents.max.copy({ x: 1000000, y: 1000000, z: 0 })
    this.db.objects.layout.setAt(layout.layoutName, layout)
    modelSpace.layoutId = layout.objectId

    // AutoCAD expects at least one paper-space block/layout pair.
    if (
      !this.db.tables.blockTable.getAt(
        AcDbBlockTableRecord.PAPER_SPACE_NAME_PREFIX
      )
    ) {
      const paperSpace = new AcDbBlockTableRecord()
      paperSpace.name = AcDbBlockTableRecord.PAPER_SPACE_NAME_PREFIX
      this.db.tables.blockTable.add(paperSpace)

      const paperLayout = new AcDbLayout()
      paperLayout.layoutName = 'Layout1'
      paperLayout.tabOrder = 1
      paperLayout.blockTableRecordId = paperSpace.objectId
      // Use non-420 extents so DXF dumps do not false-positive on true-color
      // group code 420 in version-dialect tests.
      paperLayout.limits.min.copy({ x: 0, y: 0 })
      paperLayout.limits.max.copy({ x: 12, y: 9 })
      paperLayout.extents.min.copy({ x: 0, y: 0, z: 0 })
      paperLayout.extents.max.copy({ x: 12, y: 9, z: 0 })
      this.db.objects.layout.setAt(paperLayout.layoutName, paperLayout)
      paperSpace.layoutId = paperLayout.objectId
    }
  }

  createArrowBlock() {
    // Legacy alias kept for drawings that already reference _CAXARROW
    this.ensureArrowBlock('_CAXARROW')
    this.ensureArrowBlock('_CLOSEDFILLED')
  }

  /**
   * Ensure a standard AutoCAD-style arrowhead block exists in the block table.
   * Arrow geometry is authored in unit size with tip at the origin pointing +X
   * when rotated 0; inserts typically rotate so the tip points along the
   * dimension line toward the outside.
   */
  ensureArrowBlock(blockName: string) {
    if (!blockName) return
    if (this.db.tables.blockTable.getAt(blockName)) return

    const name = blockName.toUpperCase()
    const block = new AcDbBlockTableRecord()
    block.name = blockName

    const addFilledTriangle = (halfWidth = 0.125) => {
      const hatch = new AcDbHatch()
      hatch.patternName = HATCH_PATTERN_SOLID
      const loop = new AcGeLoop2d()
      loop.add(new AcGeLine2d({ x: 0, y: 0 }, { x: -1, y: halfWidth }))
      loop.add(new AcGeLine2d({ x: -1, y: halfWidth }, { x: -1, y: -halfWidth }))
      loop.add(new AcGeLine2d({ x: -1, y: -halfWidth }, { x: 0, y: 0 }))
      hatch.add(loop)
      block.appendEntity(hatch)
    }

    const addOpenTriangle = (halfWidth = 0.125) => {
      block.appendEntity(
        this.lineEntity({ x: 0, y: 0, z: 0 }, { x: -1, y: halfWidth, z: 0 })
      )
      block.appendEntity(
        this.lineEntity({ x: 0, y: 0, z: 0 }, { x: -1, y: -halfWidth, z: 0 })
      )
    }

    const addCircle = (radius: number, filled: boolean) => {
      if (filled) {
        const hatch = new AcDbHatch()
        hatch.patternName = HATCH_PATTERN_SOLID
        // Approximate filled dot with a small diamond loop around origin
        const loop = new AcGeLoop2d()
        const r = radius
        loop.add(new AcGeLine2d({ x: r, y: 0 }, { x: 0, y: r }))
        loop.add(new AcGeLine2d({ x: 0, y: r }, { x: -r, y: 0 }))
        loop.add(new AcGeLine2d({ x: -r, y: 0 }, { x: 0, y: -r }))
        loop.add(new AcGeLine2d({ x: 0, y: -r }, { x: r, y: 0 }))
        hatch.add(loop)
        block.appendEntity(hatch)
      } else {
        // Cross-hair circle approximation with two diameters
        block.appendEntity(
          this.lineEntity({ x: -radius, y: 0, z: 0 }, { x: radius, y: 0, z: 0 })
        )
        block.appendEntity(
          this.lineEntity({ x: 0, y: -radius, z: 0 }, { x: 0, y: radius, z: 0 })
        )
      }
    }

    switch (name) {
      case '_CAXARROW':
      case '_CLOSEDFILLED':
      case '':
        addFilledTriangle()
        break
      case '_CLOSED':
        addOpenTriangle()
        block.appendEntity(
          this.lineEntity({ x: -1, y: 0.125, z: 0 }, { x: -1, y: -0.125, z: 0 })
        )
        break
      case '_CLOSEDBLANK':
        addOpenTriangle()
        block.appendEntity(
          this.lineEntity({ x: -1, y: 0.125, z: 0 }, { x: -1, y: -0.125, z: 0 })
        )
        break
      case '_OPEN':
        addOpenTriangle(0.1667)
        break
      case '_OPEN30':
        addOpenTriangle(0.2679)
        break
      case '_OPEN90':
        block.appendEntity(
          this.lineEntity({ x: 0, y: 0, z: 0 }, { x: -0.5, y: 0.5, z: 0 })
        )
        block.appendEntity(
          this.lineEntity({ x: 0, y: 0, z: 0 }, { x: -0.5, y: -0.5, z: 0 })
        )
        break
      case '_OBLIQUE':
      case '_ARCHTICK':
        block.appendEntity(
          this.lineEntity({ x: -0.5, y: -0.5, z: 0 }, { x: 0.5, y: 0.5, z: 0 })
        )
        break
      case '_DOT':
        addCircle(0.25, true)
        break
      case '_DOTSMALL':
      case '_SMALL':
        addCircle(0.125, true)
        break
      case '_DOTBLANK':
        addCircle(0.25, false)
        break
      case '_BOXFILLED':
        {
          const hatch = new AcDbHatch()
          hatch.patternName = HATCH_PATTERN_SOLID
          const loop = new AcGeLoop2d()
          loop.add(new AcGeLine2d({ x: -1, y: -0.5 }, { x: 0, y: -0.5 }))
          loop.add(new AcGeLine2d({ x: 0, y: -0.5 }, { x: 0, y: 0.5 }))
          loop.add(new AcGeLine2d({ x: 0, y: 0.5 }, { x: -1, y: 0.5 }))
          loop.add(new AcGeLine2d({ x: -1, y: 0.5 }, { x: -1, y: -0.5 }))
          hatch.add(loop)
          block.appendEntity(hatch)
        }
        break
      case '_BOXBLANK':
        block.appendEntity(
          this.lineEntity({ x: -1, y: -0.5, z: 0 }, { x: 0, y: -0.5, z: 0 })
        )
        block.appendEntity(
          this.lineEntity({ x: 0, y: -0.5, z: 0 }, { x: 0, y: 0.5, z: 0 })
        )
        block.appendEntity(
          this.lineEntity({ x: 0, y: 0.5, z: 0 }, { x: -1, y: 0.5, z: 0 })
        )
        block.appendEntity(
          this.lineEntity({ x: -1, y: 0.5, z: 0 }, { x: -1, y: -0.5, z: 0 })
        )
        break
      case '_DATUMFILLED':
        addFilledTriangle(0.5)
        break
      case '_DATUMBLANK':
        addOpenTriangle(0.5)
        block.appendEntity(
          this.lineEntity({ x: -1, y: 0.5, z: 0 }, { x: -1, y: -0.5, z: 0 })
        )
        break
      case '_ORIGIN':
      case '_ORIGIN2':
        addCircle(0.5, false)
        addCircle(0.125, true)
        break
      case '_INTEGRAL':
        block.appendEntity(
          this.lineEntity({ x: 0, y: -0.5, z: 0 }, { x: 0, y: 0.5, z: 0 })
        )
        break
      case '_NONE':
        // empty block
        break
      default:
        addFilledTriangle()
        break
    }

    this.db.tables.blockTable.add(block)
  }

  private lineEntity(
    start: { x: number; y: number; z: number },
    end: { x: number; y: number; z: number }
  ) {
    return new AcDbLine(start, end)
  }
}
