import { Tooltip } from '@videojs/react';
import { Download } from 'lucide-react';

type DownloadButtonProps = {
  downloadUrl: string;
  downloadFilename: string;
};

/**
 * Download button that uses signed URLs directly without modification.
 * Uses a plain anchor tag to avoid adding query parameters that would
 * break AWS signed URLs.
 */
export const DownloadButton: React.FC<DownloadButtonProps> = ({
  downloadUrl,
  downloadFilename,
}) => {
  if (!downloadUrl || !downloadFilename) {
    return null;
  }

  return (
    <Tooltip.Root side="top">
      <Tooltip.Trigger
        render={
          <a
            className="media-button media-button--icon"
            aria-label="Download"
            href={downloadUrl}
            download={downloadFilename}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Download className="media-icon" />
          </a>
        }
      />
      <Tooltip.Popup className="media-tooltip">Download</Tooltip.Popup>
    </Tooltip.Root>
  );
};
