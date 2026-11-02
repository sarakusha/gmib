import { supportsFeature } from '/@common/capabilities';
import { isRemoteSession, version } from '/@common/remote';

export const canDownloadMedia = (): boolean =>
  supportsFeature('mediaFileDownload', version, isRemoteSession);

export const downloadMedia = async (filename: string): Promise<boolean> => {
  if (!canDownloadMedia()) throw new Error('Скачивание не поддерживается этой версией GMIB');
  // Always invoke the local preload: the destination belongs to the managing computer.
  return window.dialogs.downloadMedia(filename);
};
