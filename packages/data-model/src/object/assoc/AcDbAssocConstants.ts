/**
 * Named-object dictionary key for the top-level associative network
 * (ObjectARX / AutoCAD `ACAD_ASSOCNETWORK`).
 */
export const ACDB_ASSOC_NETWORK_DICT = 'ACAD_ASSOCNETWORK'

/**
 * Extension-dictionary key that links an associative-array INSERT to its
 * {@link AcDbAssocArrayActionBody} object id (soft pointer stored as an
 * {@link AcDbDictionaryVar} or xrecord-like string value).
 *
 * AutoCAD uses a richer assoc graph; this key is the stable entry point for
 * {@link AcDbAssocArrayActionBody.isAssociativeArray} / getAssociativeArray.
 */
export const ACDB_ASSOC_ARRAY_ACTION_BODY = 'ACAD_ASSOARRAYACTIONBODY'
