/**
 * Iterator used for iterating over database objects in a map.
 */
export class AcDbObjectIterator<ResultType>
  implements IterableIterator<ResultType>
{
  private i = 0
  private _records: Map<string, ResultType>
  private _keys: string[]

  constructor(records: Map<string, ResultType>) {
    this._records = records
    this._keys = Array.from(records.keys())
  }

  [Symbol.iterator](): IterableIterator<ResultType> {
    return this
  }

  /**
   * Increment the iterator to the next entry.
   * @returns Return the next entry
   */
  next(): IteratorResult<ResultType, null> {
    while (this.i < this._keys.length) {
      const value = this._records.get(this._keys[this.i]) as ResultType
      this.i += 1
      return { value: value, done: false }
    }
    return { value: null, done: true }
  }
}
