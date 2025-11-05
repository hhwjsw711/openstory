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

  const isOverLimit = maxLength && value.length > maxLength;
  const hasError = Boolean(error) || isOverLimit;

  return (
    <div className="flex flex-col gap-2 w-full">
      <div className="relative">
        <Textarea
          value={loading ? 'Loading...' : value}
          onChange={handleChange}
          placeholder={placeholder}
          disabled={disabled}
          aria-invalid={hasError ? 'true' : 'false'}
          className={cn(
            'min-h-32 max-h-[50vh] resize-none overflow-y-auto',
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
