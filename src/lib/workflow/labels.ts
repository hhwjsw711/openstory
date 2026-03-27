/**
 * Build a human-readable label for workflow runs.
 * Labels appear in the QStash dashboard and can be used for filtering.
 *
 * Format: "Title (id-prefix)" or just "id-prefix" if no title.
 */
export function buildWorkflowLabel(
  title?: string,
  id?: string
): string | undefined {
  if (!title && !id) return undefined;

  const shortId = id ? id.slice(0, 8) : '';

  if (!title) return shortId;

  const truncated = title.length > 50 ? `${title.slice(0, 47)}...` : title;

  return shortId ? `${truncated} (${shortId})` : truncated;
}
