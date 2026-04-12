import { AcDbDxfParser } from '../src/converter/AcDbDxfParser'

describe('AcDbDxfParser', () => {
  it('parses minimal valid dxf content', () => {
    const parser = new AcDbDxfParser()
    const content = [
      '0',
      'SECTION',
      '2',
      'HEADER',
      '9',
      '$ACADVER',
      '1',
      'AC1032',
      '0',
      'ENDSEC',
      '0',
      'SECTION',
      '2',
      'ENTITIES',
      '0',
      'ENDSEC',
      '0',
      'EOF'
    ].join('\n')

    const data = new TextEncoder().encode(content).buffer
    const parsed = parser.parse(data as ArrayBuffer)
    expect(parsed).toBeTruthy()
    expect(parsed.header.$ACADVER).toBe('AC1032')
  })
})
