import { AcCmLoader } from './AcCmLoader'

/**
 * This function will be called when loading starts. The arguments are:
 * - url: The url of the item just loaded.
 * - itemsLoaded: the number of items already loaded so far.
 * - itemsTotal: the total amount of items to be loaded.
 */
export type AcCmOnStartCallback = (
  url: string,
  itemsLoaded: number,
  itemsTotal: number
) => void

/**
 * This function will be called when all loading is completed.
 */
export type AcCmOnLoadCallback = () => void

/**
 * This function will be called when an item is complete. The arguments are:
 * - url: The url of the item just loaded.
 * - itemsLoaded: the number of items already loaded so far.
 * - itemsTotal: the total amount of items to be loaded.
 */
export type AcCmOnProgressCallback = (
  url: string,
  itemsLoaded: number,
  itemsTotal: number
) => void

/**
 * This function will be called when any item errors, with the argument:
 * - url: The url of the item that errored.
 */
export type AcCmOnErrorCallback = (url: string) => void

/**
 * The callback called before a request is sent. It may return the original URL, or a new URL to override
 * loading behavior.
 */
export type AcCmUrlModifier = (url: string) => string

/**
 * Handles and keeps track of loaded and pending data. A default global instance of this class is
 * created and used by loaders if not supplied manually. In general that should be sufficient,
 * however there are times when it can be useful to have separate loaders - for example if you want
 * to show separate loading bars for objects and textures.
 */
export class AcCmLoadingManager {
  /**
   * This function will be called when loading starts.
   */
  public onStart?: AcCmOnStartCallback
  /**
   * This function will be called when all loading is completed. By default this is undefined, unless
   * passed in the constructor.
   */
  public onLoad?: AcCmOnLoadCallback
  /**
   * This function will be called when an item is complete.
   */
  public onProgress?: AcCmOnProgressCallback
  /**
   * This function will be called when any item errors.
   */
  public onError?: AcCmOnErrorCallback
  private isLoading: boolean
  private itemsLoaded: number
  private itemsTotal: number
  private handlers: (RegExp | AcCmLoader)[]
  private urlModifier?: AcCmUrlModifier

  /**
   * Create a new AcCmLoadingManager instance
   * @param onLoad this function will be called when all loaders are done.
   * @param onProgress this function will be called when an item is complete.
   * @param onError this function will be called a loader encounters errors.
   */
  constructor(
    onLoad?: AcCmOnLoadCallback,
    onProgress?: AcCmOnProgressCallback,
    onError?: AcCmOnErrorCallback
  ) {
    this.isLoading = false
    this.itemsLoaded = 0
    this.itemsTotal = 0
    this.urlModifier = undefined
    this.handlers = []

    // Refer to #5689 for the reason why we don't set .onStart
    // in the constructor

    this.onStart = undefined
    this.onLoad = onLoad
    this.onProgress = onProgress
    this.onError = onError
  }

  /**
   * This should be called by any loader using the manager when the loader starts loading an url.
   * @param url The loaded url
   */
  itemStart(url: string) {
    this.itemsTotal++

    if (this.isLoading === false) {
      if (this.onStart !== undefined) {
        this.onStart(url, this.itemsLoaded, this.itemsTotal)
      }
    }

    this.isLoading = true
  }

  /**
   * This should be called by any loader using the manager when the loader ended loading an url.
   * @param url The loaded url
   */
  itemEnd(url: string) {
    this.itemsLoaded++

    if (this.onProgress !== undefined) {
      this.onProgress(url, this.itemsLoaded, this.itemsTotal)
    }

    if (this.itemsLoaded === this.itemsTotal) {
      this.isLoading = false

      if (this.onLoad !== undefined) {
        this.onLoad()
      }
    }
  }

  /**
   * This should be called by any loader using the manager when the loader errors loading an url.
   * @param url The loaded url
   */
  itemError(url: string) {
    if (this.onError !== undefined) {
      this.onError(url)
    }
  }

  /**
   * Given a URL, uses the URL modifier callback (if any) and returns a resolved URL. If no URL
   * modifier is set, returns the original URL.
   * @param url The url to load
   * @returns Return resolved URL
   */
  resolveURL(url: string) {
    if (this.urlModifier) {
      return this.urlModifier(url)
    }

    return url
  }

  /**
   * If provided, the callback will be passed each resource URL before a request is sent. The callback
   * may return the original URL, or a new URL to override loading behavior. This behavior can be used
   * to load assets from .ZIP files, drag-and-drop APIs, and Data URIs.
   * @param transform URL modifier callback. Called with url argument, and must return resolvedURL.
   * @returns Return this object
   */
  setURLModifier(transform: AcCmUrlModifier) {
    this.urlModifier = transform

    return this
  }

  /**
   * Register a loader with the given regular expression. Can be used to define what loader should
   * be used in order to load specific files. A typical use case is to overwrite the default loader
   * for textures.
   * @param regex A regular expression.
   * @param loader The loader.
   * @returns Return this object
   */
  addHandler(regex: RegExp, loader: AcCmLoader) {
    this.handlers.push(regex, loader)
    return this
  }

  /**
   * Remove the loader for the given regular expression.
   * @param regex A regular expression.
   * @returns Return this object
   */
  removeHandler(regex: RegExp) {
    const index = this.handlers.indexOf(regex)

    if (index !== -1) {
      this.handlers.splice(index, 2)
    }

    return this
  }

  /**
   * Retrieve the registered loader for the given file path.
   * @param file The file path.
   * @returns Return the registered loader for the given file path.
   */
  getHandler(file: string) {
    for (let i = 0, l = this.handlers.length; i < l; i += 2) {
      const regex = this.handlers[i] as RegExp
      const loader = this.handlers[i + 1]

      if (regex.global) regex.lastIndex = 0 // see #17920

      if (regex.test(file)) {
        return loader
      }
    }

    return null
  }
}

export const DefaultLoadingManager = /*@__PURE__*/ new AcCmLoadingManager()
