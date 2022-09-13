const search = new URLSearchParams(window.location.search);
const sourceId = +search.get('source_id');
const outputId = +search.get('output_id');
const width = +search.get('width');
const height = +search.get('height');

// document.body.requestPointerLock();

let port;

window.onmessage = ev => {
  console.log(ev.data);
  if (ev.data === 'provide-channel') {
    [port] = ev.ports;
    port.postMessage('hello');
  }
};

window.onload = () => {
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
