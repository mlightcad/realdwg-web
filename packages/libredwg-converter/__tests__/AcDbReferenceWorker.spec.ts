import { AcDbLibreDwgConverter } from '../src/AcDbLibreDwgConverter'

/** Transport substitute only: converter and native worker manager remain real. */
class ParserWorker {
  private events = new EventTarget()
  addEventListener = this.events.addEventListener.bind(this.events)
  removeEventListener = this.events.removeEventListener.bind(this.events)
  static instances: ParserWorker[] = []
  request?: { id: string; input: ArrayBuffer }
  terminate = jest.fn()

  constructor() {
    ParserWorker.instances.push(this)
  }

  postMessage(request: { id: string; input: ArrayBuffer }) {
    this.request = request
  }

  reply(result: object) {
    this.events.dispatchEvent(
      new MessageEvent('message', {
        data: { id: this.request!.id, ...result }
      })
    )
  }
}

class ReferenceConverter extends AcDbLibreDwgConverter {
  parseReference(signal?: AbortSignal) {
    return this.parse(new ArrayBuffer(1), 1000, signal)
  }
}

describe('native reference parser worker ownership', () => {
  const originalWorker = globalThis.Worker

  beforeEach(() => {
    ParserWorker.instances = []
    globalThis.Worker = ParserWorker as unknown as typeof Worker
  })

  afterEach(() => {
    if (originalWorker) globalThis.Worker = originalWorker
    else delete (globalThis as { Worker?: typeof Worker }).Worker
  })

  it('terminates the owning parser on abort and reports AbortError', async () => {
    const controller = new AbortController()
    const reading = new ReferenceConverter().parseReference(controller.signal)
    const worker = ParserWorker.instances[0]
    controller.abort()
    await expect(reading).rejects.toMatchObject({ name: 'AbortError' })
    expect(worker.terminate).toHaveBeenCalledTimes(1)
  })

  it('does not start a worker for a request already cancelled', async () => {
    const controller = new AbortController()
    controller.abort()
    await expect(
      new ReferenceConverter().parseReference(controller.signal)
    ).rejects.toMatchObject({ name: 'AbortError' })
    expect(ParserWorker.instances).toHaveLength(0)
  })

  it('keeps concurrent parser lifetimes independent', async () => {
    const converter = new ReferenceConverter()
    const controller = new AbortController()
    const cancelled = converter.parseReference(controller.signal)
    const retained = converter.parseReference()
    const [a, b] = ParserWorker.instances
    controller.abort()
    await expect(cancelled).rejects.toMatchObject({ name: 'AbortError' })
    expect(b.terminate).not.toHaveBeenCalled()
    const result = {
      model: { marker: 'retained' },
      data: { unknownEntityCount: 0 }
    }
    b.reply({ success: true, data: result })
    await expect(retained).resolves.toEqual(result)
    expect(a.terminate).toHaveBeenCalledTimes(1)
    expect(b.terminate).toHaveBeenCalledTimes(1)
  })

  it('terminates the parser after parse failure', async () => {
    const reading = new ReferenceConverter().parseReference()
    const worker = ParserWorker.instances[0]
    worker.reply({ success: false, error: 'invalid drawing' })
    await expect(reading).rejects.toThrow()
    expect(worker.terminate).toHaveBeenCalledTimes(1)
  })
})
