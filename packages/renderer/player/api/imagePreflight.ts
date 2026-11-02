import { supportsFeature } from '/@common/capabilities';
import { isRemoteSession, version } from '/@common/remote';

import { IMAGE_HEADER_BYTES, readImageDimensions } from '/@common/imageDimensions';
import { getImageImportError } from '/@common/imageImportLimits';

const checkAborted = (signal?: AbortSignal) => {
  if (signal?.aborted) throw new DOMException('Загрузка отменена', 'AbortError');
};

export const preflightImage = async (
  file: Blob & { name?: string },
  signal?: AbortSignal,
): Promise<void> => {
  checkAborted(signal);
  const buffer = await file.slice(0, IMAGE_HEADER_BYTES).arrayBuffer();
  checkAborted(signal);
  const dimensions = readImageDimensions(new Uint8Array(buffer));
  if (!dimensions) {
    const isImage =
      file.type.startsWith('image/') ||
      /\.(?:jpe?g|png|gif|webp|bmp|tiff?|avif|heic|heif|svg|ico)$/i.test(file.name ?? '');
    if (isImage && !supportsFeature('safeImageImport', version, isRemoteSession)) {
      throw new Error(
        'Не удалось безопасно определить размер изображения. Обновите GMIB на удалённом компьютере или сохраните изображение в JPEG/PNG и повторите загрузку.',
      );
    }
    return;
  }
  const error = getImageImportError(dimensions.width, dimensions.height);
  if (error) throw new Error(error);
};
