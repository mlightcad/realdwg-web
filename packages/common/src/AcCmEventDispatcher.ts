/**
 * The minimal basic Event that can be dispatched by a {@link AcCmEventDispatcher<>}.
 */
export interface AcCmBaseEvent<TEventType extends string = string> {
  readonly type: TEventType
}

/**
 * The minimal expected contract of a fired Event that was dispatched by a {@link AcCmEventDispatcher<>}.
 */
export interface AcCmEvent<
  TEventType extends string = string,
  TTarget = unknown
> {
  readonly type: TEventType
  readonly target: TTarget
}

export type AcCmEventListener<
  TEventData,
  TEventType extends string,
  TTarget
> = (event: TEventData & AcCmEvent<TEventType, TTarget>) => void

// eslint-disable-next-line
export class AcCmEventDispatcher<TEventMap extends {} = {}> {
  /**
   * Index a record of all callback functions
   */
  private _listeners: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [index: string]: any[]
  }

  /**
   * Creates {@link AcCmEventDispatcher} object.
   */
  constructor() {
    this._listeners = {}
  }

  /**
   * Add a listener to an event type.
   * @param type The type of event to listen to.
   * @param listener The function that gets called when the event is fired.
   */
  addEventListener<T extends Extract<keyof TEventMap, string>>(
    type: T,
    listener: AcCmEventListener<TEventMap[T], T, this>
  ): void
  addEventListener<T extends string>(
    type: T,
    listener: AcCmEventListener<object, T, this>
  ): void {
    if (this._listeners === undefined) this._listeners = {}

    const listeners = this._listeners

    if (listeners[type] === undefined) {
      listeners[type] = []
    }

    if (listeners[type].indexOf(listener) === -1) {
      listeners[type].push(listener)
    }
  }

  /**
   * Check if listener is added to an event type.
   * @param type The type of event to listen to.
   * @param listener The function that gets called when the event is fired.
   */
  hasEventListener<T extends Extract<keyof TEventMap, string>>(
    type: T,
    listener: AcCmEventListener<TEventMap[T], T, this>
  ): boolean
  hasEventListener<T extends string>(
    type: T,
    listener: AcCmEventListener<object, T, this>
  ): boolean {
    if (this._listeners === undefined) return false

    const listeners = this._listeners

    return (
      listeners[type] !== undefined && listeners[type].indexOf(listener) !== -1
    )
  }

  /**
   * Remove a listener from an event type.
   * @param type The type of the listener that gets removed.
   * @param listener The listener function that gets removed.
   */
  removeEventListener<T extends Extract<keyof TEventMap, string>>(
    type: T,
    listener: AcCmEventListener<TEventMap[T], T, this>
  ): void
  removeEventListener<T extends string>(
    type: T,
    listener: AcCmEventListener<object, T, this>
  ): void {
    if (this._listeners === undefined) return

    const listeners = this._listeners
    const listenerArray = listeners[type]

    if (listenerArray !== undefined) {
      const index = listenerArray.indexOf(listener)

      if (index !== -1) {
        listenerArray.splice(index, 1)
      }
    }
  }

  /**
   * Fire an event type.
   * @param event The event that gets fired.
   */
  dispatchEvent<T extends Extract<keyof TEventMap, string>>(
    event: AcCmBaseEvent<T> & TEventMap[T]
  ): void {
    if (this._listeners === undefined) return

    const listeners = this._listeners
    const listenerArray = listeners[event.type]

    if (listenerArray !== undefined) {
      // @ts-expect-error add target property
      event.target = this

      // Make a copy, in case listeners are removed while iterating.
      const array = listenerArray.slice(0)

      for (let i = 0, l = array.length; i < l; i++) {
        array[i].call(this, event)
      }
    }
  }
}
