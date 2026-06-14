/**
 * Little-endian binary readers for AutoCAD proxy-entity graphics.
 *
 * Based on the proxy graphic format documented by ODA and implemented in ezdxf.
 */

export class AcDbProxyGraphicEndOfBufferError extends Error {
  constructor(message = 'Unexpected end of buffer.') {
    super(message)
    this.name = 'AcDbProxyGraphicEndOfBufferError'
  }
}

type Bytes = Uint8Array | ArrayBuffer

function toBufferView(buffer: Bytes): Uint8Array {
  return buffer instanceof ArrayBuffer ? new Uint8Array(buffer) : buffer
}

export class AcDbProxyGraphicByteStream {
  private readonly _buffer: Uint8Array
  private _index = 0
  private readonly _align: number

  constructor(buffer: Bytes, align = 4) {
    this._buffer = toBufferView(buffer)
    this._align = align
  }

  get index() {
    return this._index
  }

  get hasData() {
    return this._index < this._buffer.length
  }

  private alignIndex(index: number) {
    const modulo = index % this._align
    return modulo ? index + this._align - modulo : index
  }

  readStruct<T extends number[]>(sizes: number[]): T {
    if (!this.hasData) {
      throw new AcDbProxyGraphicEndOfBufferError()
    }
    const values: number[] = []
    let byteSize = 0
    for (const size of sizes) {
      const view = new DataView(
        this._buffer.buffer,
        this._buffer.byteOffset + this._index + byteSize,
        size
      )
      if (size === 8) {
        values.push(view.getFloat64(0, true))
      } else if (size === 4) {
        values.push(view.getUint32(0, true))
      } else {
        throw new Error(`Unsupported struct size: ${size}`)
      }
      byteSize += size
    }
    this._index = this.alignIndex(this._index + byteSize)
    return values as T
  }

  readFloat() {
    return this.readStruct<[number]>([8])[0]
  }

  readLong() {
    return this.readStruct<[number]>([4])[0]
  }

  readSignedLong() {
    if (!this.hasData) {
      throw new AcDbProxyGraphicEndOfBufferError()
    }
    const view = new DataView(
      this._buffer.buffer,
      this._buffer.byteOffset + this._index,
      4
    )
    const value = view.getInt32(0, true)
    this._index = this.alignIndex(this._index + 4)
    return value
  }

  readVertex(): [number, number, number] {
    return this.readStruct<[number, number, number]>([8, 8, 8])
  }

  readPaddedString(encoding = 'utf-8') {
    const buffer = this._buffer
    for (let endIndex = this._index; endIndex < buffer.length; endIndex++) {
      if (buffer[endIndex] === 0) {
        const startIndex = this._index
        this._index = this.alignIndex(endIndex + 1)
        const slice = buffer.subarray(startIndex, endIndex)
        return new TextDecoder(encoding).decode(slice)
      }
    }
    throw new AcDbProxyGraphicEndOfBufferError(
      'Did not detect terminating zero byte.'
    )
  }

  readPaddedUnicodeString() {
    const buffer = this._buffer
    for (let endIndex = this._index; endIndex < buffer.length; endIndex += 2) {
      if (
        endIndex + 1 < buffer.length &&
        buffer[endIndex] === 0 &&
        buffer[endIndex + 1] === 0
      ) {
        const startIndex = this._index
        this._index = this.alignIndex(endIndex + 2)
        const slice = buffer.subarray(startIndex, endIndex)
        return new TextDecoder('utf-16le').decode(slice)
      }
    }
    throw new AcDbProxyGraphicEndOfBufferError(
      'Did not detect terminating zero bytes.'
    )
  }
}

export class AcDbProxyGraphicBitStream {
  private readonly _buffer: Uint8Array
  private _bitIndex = 0
  readonly dxfversion: string
  readonly encoding: string

  constructor(
    buffer: Bytes,
    dxfversion = 'AC1015',
    encoding = 'cp1252'
  ) {
    this._buffer = toBufferView(buffer)
    this.dxfversion = dxfversion
    this.encoding = encoding
  }

  get hasData() {
    return this._bitIndex >> 3 < this._buffer.length
  }

  readBit() {
    const index = this._bitIndex
    this._bitIndex += 1
    const byteIndex = index >> 3
    if (byteIndex >= this._buffer.length) {
      throw new AcDbProxyGraphicEndOfBufferError()
    }
    return this._buffer[byteIndex] & (0x80 >> (index & 7)) ? 1 : 0
  }

  readBits(count: number) {
    const index = this._bitIndex
    const nextBitIndex = index + count
    if (((nextBitIndex - 1) >> 3) >= this._buffer.length) {
      throw new AcDbProxyGraphicEndOfBufferError()
    }
    this._bitIndex = nextBitIndex

    let testBit = 0x80 >> (index & 7)
    let testByteIndex = index >> 3
    let value = 0
    let testByte = this._buffer[testByteIndex]
    while (count > 0) {
      value <<= 1
      if (testByte & testBit) {
        value |= 1
      }
      count -= 1
      testBit >>= 1
      if (!testBit && count) {
        testBit = 0x80
        testByteIndex += 1
        testByte = this._buffer[testByteIndex]
      }
    }
    return value
  }

  readUnsignedByte() {
    return this.readBits(8)
  }

  readSignedByte() {
    const value = this.readBits(8)
    return value & 0x80 ? -((~value & 0xff) + 1) : value
  }

  readAlignedBytes(count: number) {
    const startIndex = this._bitIndex >> 3
    const endIndex = startIndex + count
    if (endIndex > this._buffer.length) {
      throw new AcDbProxyGraphicEndOfBufferError()
    }
    this._bitIndex += count << 3
    return this._buffer.subarray(startIndex, endIndex)
  }

  readUnsignedShort() {
    if (this._bitIndex & 7) {
      const s1 = this.readBits(8)
      const s2 = this.readBits(8)
      return (s2 << 8) + s1
    }
    const bytes = this.readAlignedBytes(2)
    return bytes[1] << 8 | bytes[0]
  }

  readSignedShort() {
    const value = this.readUnsignedShort()
    return value & 0x8000 ? -((~value & 0xffff) + 1) : value
  }

  readUnsignedLong() {
    if (this._bitIndex & 7) {
      const l1 = this.readBits(8)
      const l2 = this.readBits(8)
      const l3 = this.readBits(8)
      const l4 = this.readBits(8)
      return (l4 << 24) + (l3 << 16) + (l2 << 8) + l1
    }
    const bytes = this.readAlignedBytes(4)
    return (
      (bytes[3] << 24) +
      (bytes[2] << 16) +
      (bytes[1] << 8) +
      bytes[0]
    )
  }

  readSignedLong() {
    const value = this.readUnsignedLong()
    return value & 0x80000000
      ? -((~value & 0xffffffff) + 1)
      : value
  }

  readFloat() {
    if (this._bitIndex & 7) {
      const data = new Uint8Array(8)
      for (let i = 0; i < 8; i++) {
        data[i] = this.readBits(8)
      }
      return new DataView(data.buffer).getFloat64(0, true)
    }
    const bytes = this.readAlignedBytes(8)
    const copy = new Uint8Array(bytes)
    return new DataView(copy.buffer).getFloat64(0, true)
  }

  readRawDouble(count = 1): number | number[] {
    if (count === 1) {
      return this.readFloat()
    }
    return Array.from({ length: count }, () => this.readFloat())
  }

  readBitShort(count = 1): number | number[] {
    const readOne = () => {
      const bits = this.readBits(2)
      if (bits === 0) return this.readSignedShort()
      if (bits === 1) return this.readUnsignedByte()
      if (bits === 2) return 0
      return 256
    }
    if (count === 1) return readOne()
    return Array.from({ length: count }, () => readOne())
  }

  readBitLong(count = 1): number | number[] {
    const readOne = () => {
      const bits = this.readBits(2)
      if (bits === 0) return this.readSignedLong()
      if (bits === 1) return this.readUnsignedByte()
      if (bits === 2) return 0
      return 256
    }
    if (count === 1) return readOne()
    return Array.from({ length: count }, () => readOne())
  }

  readBitDouble(count = 1): number | number[] {
    const readOne = () => {
      const bits = this.readBits(2)
      if (bits === 0) return this.readFloat()
      if (bits === 1) return 1
      if (bits === 2) return 0
      return 0
    }
    if (count === 1) return readOne()
    return Array.from({ length: count }, () => readOne())
  }

  readBitDoubleDefault(
    count = 1,
    defaultValue = 0
  ): number | number[] {
    const defaultBytes = new Uint8Array(8)
    new DataView(defaultBytes.buffer).setFloat64(0, defaultValue, true)

    const readOne = () => {
      const bits = this.readBits(2)
      if (bits === 0) return defaultValue
      if (bits === 1) {
        const data = new Uint8Array(defaultBytes)
        data[0] = this.readUnsignedByte()
        data[1] = this.readUnsignedByte()
        data[2] = this.readUnsignedByte()
        data[3] = this.readUnsignedByte()
        return new DataView(data.buffer).getFloat64(0, true)
      }
      if (bits === 2) {
        const data = new Uint8Array(defaultBytes)
        data[4] = this.readUnsignedByte()
        data[5] = this.readUnsignedByte()
        data[0] = this.readUnsignedByte()
        data[1] = this.readUnsignedByte()
        data[2] = this.readUnsignedByte()
        data[3] = this.readUnsignedByte()
        return new DataView(data.buffer).getFloat64(0, true)
      }
      return this.readFloat()
    }

    if (count === 1) return readOne()
    return Array.from({ length: count }, () => readOne())
  }
}

export function bytesToHexString(data: Uint8Array): string {
  return Array.from(data, byte => byte.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase()
}

export function hexStringsToBytes(chunks: string[]): Uint8Array {
  const totalLength = chunks.reduce(
    (sum, chunk) => sum + Math.floor(chunk.length / 2),
    0
  )
  const result = new Uint8Array(totalLength)
  let offset = 0
  for (const chunk of chunks) {
    for (let i = 0; i < chunk.length; i += 2) {
      result[offset++] = parseInt(chunk.slice(i, i + 2), 16)
    }
  }
  return result
}
