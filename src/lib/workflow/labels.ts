/**
 * Build a label for workflow runs.
 * Labels appear in the QStash dashboard and can be used for filtering.
 * Returns the sequence ID as-is (ULIDs are already QStash-safe).
 */
export function buildWorkflowLabel(id?: string): string | undefined {
  return id || undefined;
}
