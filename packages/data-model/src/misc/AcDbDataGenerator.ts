import { AcCmColor } from '@mlightcad/common'
import { AcGeLine2d, AcGeLoop2d } from '@mlightcad/geometry-engine'

import { AcDbBlockTableRecord } from '../database/AcDbBlockTableRecord.js'
import { AcDbDatabase } from '../database/AcDbDatabase.js'
import { AcDbDimStyleTableRecord } from '../database/AcDbDimStyleTableRecord.js'
import { AcDbLayerTableRecord } from '../database/AcDbLayerTableRecord.js'
import { AcDbLinetypeTableRecord } from '../database/AcDbLinetypeTableRecord.js'
import { AcDbTextStyleTableRecord } from '../database/AcDbTextStyleTableRecord.js'
import { AcDbHatch } from '../entity/AcDbHatch.js'
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
    const blockName = '_CAXARROW'
    if (!this.db.tables.blockTable.getAt(blockName)) {
      // Create arrow
      const hatch = new AcDbHatch()
      hatch.patternName = HATCH_PATTERN_SOLID
      const loop = new AcGeLoop2d()
      loop.add(new AcGeLine2d({ x: 0, y: 0 }, { x: -1, y: 0.125 }))
      loop.add(new AcGeLine2d({ x: -1, y: 0.125 }, { x: -1, y: -0.125 }))
      loop.add(new AcGeLine2d({ x: -1, y: -0.125 }, { x: 0, y: 0 }))
      hatch.add(loop)

      // Create block and add the hatch entity in this block
      const block = new AcDbBlockTableRecord()
      block.name = '_CAXARROW'
      block.appendEntity(hatch)
      this.db.tables.blockTable.add(block)
    }
  }
}
