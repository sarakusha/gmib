export const MAX_IMAGE_PIXELS = 16_777_216;
export const MAX_IMAGE_DIMENSION = 8192;

/** Check metadata only: decoding an oversized image just to validate it is unsafe. */
export const getImageImportError = (
  width: number | undefined,
  height: number | undefined,
): string | undefined => {
  if (
    width === undefined ||
    height === undefined ||
    !Number.isSafeInteger(width) ||
    !Number.isSafeInteger(height) ||
    width < 2 ||
    height < 2
  ) {
    return 'Не удалось безопасно определить размер изображения. Сохраните его в JPEG, PNG или WebP и повторите загрузку.';
  }
  const pixels = width * height;
  if (width > MAX_IMAGE_DIMENSION || height > MAX_IMAGE_DIMENSION || pixels > MAX_IMAGE_PIXELS) {
    const memoryMiB = Math.ceil((pixels * 4) / 1024 ** 2);
    return `Изображение ${width}×${height} слишком большое: один кадр занимает около ${memoryMiB} МиБ памяти, а обработке нужно ещё больше. Допускается не более 16,8 млн пикселей и 8192 пикселей по каждой стороне. Уменьшите изображение до разрешения экрана и повторите загрузку.`;
  }
  return undefined;
};
