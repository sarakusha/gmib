const search = new URLSearchParams(window.location.search);
// const sourceId = +search.get('source_id');
// const outputId = +search.get('output_id');
const width = +search.get('width');
const height = +search.get('height');
const HIDE_CURSOR_DELAY = 1000;

// document.body.requestPointerLock();

let port;
let cursorTimer = 0;

const hideCursor = () => {
  document.documentElement.classList.add('cursor-hidden');
};

const showCursor = () => {
  document.documentElement.classList.remove('cursor-hidden');
  clearTimeout(cursorTimer);
  cursorTimer = window.setTimeout(hideCursor, HIDE_CURSOR_DELAY);
};

window.onmessage = ev => {
  console.log(ev.data);
  if (ev.data === 'provide-channel') {
    [port] = ev.ports;
    port.postMessage('hello');
  }
};

window.onload = () => {
  document.addEventListener('mousemove', showCursor);
  document.addEventListener('mouseleave', hideCursor);
  showCursor();

  const videoElement = document.querySelector('video');
  if (videoElement) {
    // videoElement.style=`width: ${width}px; height: ${height}px;`;
    videoElement.width = width;
    videoElement.height = height;
    // window.setInterval(() => {
    //   const { droppedVideoFrames, totalVideoFrames, creationTime } = videoElement.getVideoPlaybackQuality();
    //   console.log(!!port, droppedVideoFrames, totalVideoFrames);
    //   port?.postMessage({ quality: { droppedVideoFrames, totalVideoFrames, creationTime }, sourceId, outputId });
    // }, 1000);
  }
};
