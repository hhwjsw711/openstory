import { useDefaultLayoutContext } from '@vidstack/react/player/layouts/default';
import { Tooltip } from '@vidstack/react';

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

  const downloadText = translations?.['Download'] ?? 'Download';

  if (!downloadUrl || !downloadFilename) {
    return null;
  }

  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>
        <a
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
