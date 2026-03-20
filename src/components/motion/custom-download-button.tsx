import { Tooltip } from '@vidstack/react';
import { useDefaultLayoutContext } from '@vidstack/react/player/layouts/default';
import type { DefaultLayoutTranslations } from '@vidstack/react/player/layouts/default';

type CustomDownloadButtonProps = {
  downloadUrl: string;
  downloadFilename: string;
};

/**
 * Custom download button that uses signed URLs directly without modification.
 * Unlike vidstack's DefaultDownloadButton, this does NOT add query parameters
 * to the download URL, which would break AWS signed URLs.
 */
export const CustomDownloadButton: React.FC<CustomDownloadButtonProps> = ({
  downloadUrl,
  downloadFilename,
}) => {
  const { icons: Icons, translations } = useDefaultLayoutContext();

  // Helper to get translation (simplified version of useDefaultLayoutWord)
  const getWord = (word: keyof DefaultLayoutTranslations) => {
    return translations?.[word] ?? word;
  };

  const downloadText = getWord('Download');

  if (!downloadUrl || !downloadFilename) {
    return null;
  }

  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>
        <a
          role="button"
          className="vds-download-button vds-button"
          aria-label={downloadText}
          href={downloadUrl}
          download={downloadFilename}
          target="_blank"
          rel="noopener noreferrer"
        >
          {Icons.DownloadButton ? (
            <Icons.DownloadButton.Default className="vds-icon" />
          ) : null}
        </a>
      </Tooltip.Trigger>
      <Tooltip.Content className="vds-tooltip-content" placement="top">
        {downloadText}
      </Tooltip.Content>
    </Tooltip.Root>
  );
};
