/**
 * Evaluation status of an associative action or dependency
 * (ObjectARX `AcDbAssocStatus`). Values match AutoCAD and are persisted as-is
 * in DXF/DWG.
 */
export enum AcDbAssocStatus {
  /** Up to date; no evaluation needed. */
  IsUpToDateAssocStatus = 0,
  /** Needs evaluation because an input changed. */
  ChangedDirectlyAssocStatus = 1,
  /** Needs evaluation because a transitive dependency changed. */
  ChangedTransitivelyAssocStatus = 2,
  /** Changed, but the change produced no difference. */
  ChangedNoDifferenceAssocStatus = 3,
  /** Evaluation failed. */
  FailedToEvaluateAssocStatus = 4,
  /** Erased / invalid. */
  ErasedAssocStatus = 5,
  /** Evaluation suppressed. */
  SuppressedAssocStatus = 6,
  /** Unresolved (e.g. missing xref data). */
  UnresolvedAssocStatus = 7
}

/**
 * Returns true when the status means the action/dependency should be evaluated.
 */
export function acdbAssocStatusNeedsEvaluation(
  status: AcDbAssocStatus
): boolean {
  return (
    status === AcDbAssocStatus.ChangedDirectlyAssocStatus ||
    status === AcDbAssocStatus.ChangedTransitivelyAssocStatus ||
    status === AcDbAssocStatus.ChangedNoDifferenceAssocStatus
  )
}
