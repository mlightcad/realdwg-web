/**
 * Evaluation status of an associative action or dependency
 * (ObjectARX `AcDbAssocStatus`).
 */
export enum AcDbAssocStatus {
  /** Up to date; no evaluation needed. */
  IsUpToDateAssocStatus = 0,
  /** Needs evaluation because an input changed. */
  ChangedDirectlyAssocStatus = 1,
  /** Needs evaluation because a transitive dependency changed. */
  ChangedTransitivelyAssocStatus = 2,
  /** Evaluation failed. */
  FailedToEvaluateAssocStatus = 3,
  /** Evaluation suppressed. */
  SuppressedAssocStatus = 4,
  /** Erased / invalid. */
  ErasedAssocStatus = 5
}

/**
 * Returns true when the status means the action/dependency should be evaluated.
 */
export function acdbAssocStatusNeedsEvaluation(status: AcDbAssocStatus): boolean {
  return (
    status === AcDbAssocStatus.ChangedDirectlyAssocStatus ||
    status === AcDbAssocStatus.ChangedTransitivelyAssocStatus
  )
}
