import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'openstory:sequence-draft:v1';
const EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

type SequenceDraft = {
  script: string;
  styleId: string | null;
  selectedTalentIds: string[];
  selectedLocationIds: string[];
  savedAt: number;
};

const EMPTY_DRAFT: SequenceDraft = {
  script: '',
  styleId: null,
  selectedTalentIds: [],
  selectedLocationIds: [],
  savedAt: 0,
};

function loadDraft(): SequenceDraft | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;

    const parsed: unknown = JSON.parse(stored);
    if (
      !parsed ||
      typeof parsed !== 'object' ||
      !('script' in parsed) ||
      !('savedAt' in parsed)
    ) {
      return null;
    }

    const p = parsed as Record<string, unknown>;
    const draft: SequenceDraft = {
      script: typeof p.script === 'string' ? p.script : '',
      styleId: typeof p.styleId === 'string' ? p.styleId : null,
      selectedTalentIds: Array.isArray(p.selectedTalentIds)
        ? p.selectedTalentIds
        : [],
      selectedLocationIds: Array.isArray(p.selectedLocationIds)
        ? p.selectedLocationIds
        : [],
      savedAt: typeof p.savedAt === 'number' ? p.savedAt : 0,
    };

    // Check expiry
    if (Date.now() - draft.savedAt > EXPIRY_MS) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }

    return draft;
  } catch {
    return null;
  }
}

function persistDraft(draft: Omit<SequenceDraft, 'savedAt'>): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...draft, savedAt: Date.now() })
    );
  } catch {
    // localStorage full or unavailable
  }
}

export function useSequenceDraft() {
  const [draft, setDraft] = useState<SequenceDraft>(EMPTY_DRAFT);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const loaded = loadDraft();
    if (loaded) {
      setDraft(loaded);
    }
    setIsLoaded(true);
  }, []);

  const saveDraft = useCallback((data: Omit<SequenceDraft, 'savedAt'>) => {
    setDraft({ ...data, savedAt: Date.now() });
    persistDraft(data);
  }, []);

  const clearDraft = useCallback(() => {
    setDraft(EMPTY_DRAFT);
    if (typeof window !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  return { draft, isLoaded, saveDraft, clearDraft };
}
