export class AcTrStringUtil {
  /**
   * Converts a byte count to a human-readable string using KB, MB, or GB.
   *
   * @param bytes - The number of bytes.
   * @param decimals - Number of decimal places to include (default is 2).
   * @returns A formatted string with the appropriate unit.
   */
  static formatBytes(bytes: number, decimals = 2): string {
    if (bytes === 0) return '0 B'

    const k = 1024
    const dm = Math.max(0, decimals)
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']

    const i = Math.floor(Math.log(bytes) / Math.log(k))
    const value = bytes / Math.pow(k, i)

    return `${parseFloat(value.toFixed(dm))} ${sizes[i]}`
  }
}
