/**
 * The class representing one event manager
 */
export class AcCmEventManager<T = unknown> {
  private listeners: ((payload: T) => void)[] = []

  /**
   * Add the event listener
   * @param listener Input listener to be added
   */
  public addEventListener(listener: (payload: T) => void) {
    this.listeners.push(listener)
  }

  /**
   * Remove the listener
   * @param listener Input listener to be removed
   */
  public removeEventListener(listener: (payload: T) => void) {
    this.listeners = this.listeners.filter(s => s !== listener)
  }

  /**
   * Remove all listeners bound to the target and add one new listener
   * @param listener Input listener to be added
   */
  public replaceEventListener(listener: (payload: T) => void) {
    this.removeEventListener(listener)
    this.addEventListener(listener)
  }

  /**
   * Notify all listeners
   * @param payload Input payload passed to listener
   */
  public dispatch(payload?: T, ...args: unknown[]) {
    for (const item of this.listeners) {
      const listener = item as (...args: unknown[]) => void
      listener.call(null, payload, ...args)
    }
  }
}
