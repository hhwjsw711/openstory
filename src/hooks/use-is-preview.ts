import { isPreviewHost } from '@/lib/utils/environment';
import { useEffect, useState } from 'react';

/**
 * SSR-safe hook to check if we're on a preview deployment.
 * Returns false during SSR and initial render to avoid hydration mismatch,
 * then updates to true after mount if on a preview branch.
 */
export function useIsPreview(): boolean {
  const [isPreview, setIsPreview] = useState(false);

  useEffect(() => {
    setIsPreview(isPreviewHost(window.location.host));
  }, []);

  return isPreview;
}
