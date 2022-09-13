const half = (value: number) => Math.round(value / 2);
const round2 = (value: number) => 2 * half(value);

const prepareDrawArgs = (
  frame: VideoFrame,
  width: number,
  height: number,
  letterboxing = false,
): Parameters<OffscreenCanvasRenderingContext2D['drawImage']> => {
  const { displayWidth, displayHeight } = frame;
  const tall = displayWidth / width < displayHeight / height;
  let sWidth = displayWidth;
  let sHeight = displayHeight;
  let sx = 0;
  let sy = 0;
  let dWidth = width;
  let dHeight = height;
  let dx = 0;
  let dy = 0;
  if (!letterboxing) {
    if (tall) {
      sHeight = round2((sWidth * height) / width);
      sy = half(displayHeight - sHeight);
    } else {
      sWidth = round2((sHeight * width) / height);
      sx = half(displayWidth - sWidth);
    }
  } else if (tall) {
    dWidth = round2((dHeight * displayWidth) / displayHeight);
    dx = half(width - dWidth);
  } else {
    dHeight = round2((dWidth * displayHeight) / displayWidth);
    dy = half(height - dHeight);
  }

  return [frame as unknown as CanvasImageSource, sx, sy, sWidth, sHeight, dx, dy, dWidth, dHeight];
};

export default prepareDrawArgs;
