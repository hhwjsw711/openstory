import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import type * as React from 'react';
import { useCallback } from 'react';

interface ScriptEditorProps {
  value: string;
  onValueChange: (value: string) => void;
  error?: string;
  maxLength?: number;
  placeholder?: string;
  disabled?: boolean;
  showCharacterCount?: boolean;
  loading?: boolean;
  autoFocus?: boolean;
  fillHeight?: boolean;
}

export const ScriptEditor: React.FC<ScriptEditorProps> = ({
  value,
  onValueChange,
  error,
  maxLength = 5000,
  placeholder = 'Enter your script here...',
  disabled = false,
  showCharacterCount = true,
  loading = false,
  autoFocus = false,
  fillHeight = false,
}) => {
  const handleChange = useCallback(
    (event: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newValue = event.target.value;
      if (maxLength && newValue.length <= maxLength) {
        onValueChange(newValue);
      }
    },
    [onValueChange, maxLength]
  );

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // Cmd/Ctrl+Enter submits the form (per CLAUDE.md guidelines)
      if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        // Find the closest form and submit it
        const form = event.currentTarget.closest('form');
        if (form) {
          form.requestSubmit();
        }
      }
    },
    []
  );

  const isOverLimit = maxLength && value.length > maxLength;
  const hasError = Boolean(error) || isOverLimit;

  return (
    <div
      className={cn(
        'flex flex-col gap-2 w-full',
        fillHeight && 'flex-1 min-h-0'
      )}
    >
      <div
        className={cn('relative', fillHeight && 'flex-1 flex flex-col min-h-0')}
      >
        <Textarea
          value={loading ? 'Loading...' : value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          autoFocus={autoFocus}
          aria-invalid={hasError ? 'true' : 'false'}
          className={cn(
            'min-h-32 resize-none overflow-y-auto bg-transparent dark:bg-transparent border-none shadow-none focus-visible:ring-0',
            !fillHeight && 'max-h-[50vh]',
            fillHeight && 'flex-1 min-h-0',
            hasError && 'border-destructive focus-visible:ring-destructive/20'
          )}
          data-testid="script-editor-textarea"
        />
      </div>

      <div className="flex items-center justify-between">
        {showCharacterCount && (
          <div className="text-sm text-muted-foreground">
            <span
              className={cn(isOverLimit && 'text-destructive font-medium')}
              data-testid="character-count"
            >
              {value.length.toLocaleString()}
            </span>
            {maxLength && (
              <>
                {' / '}
                <span>{maxLength.toLocaleString()}</span>
                <span> characters</span>
              </>
            )}
          </div>
        )}

        {error && (
          <div
            className="text-sm text-destructive font-medium"
            data-testid="error-message"
            role="alert"
            aria-live="polite"
          >
            {error}
          </div>
        )}
      </div>
    </div>
  );
};
