const search = new URLSearchParams(window.location.search);
// const sourceId = +search.get('source_id');
// const outputId = +search.get('output_id');
const width = +search.get('width');
const height = +search.get('height');
const left = +search.get('left');
const top = +search.get('top');
const kiosk = !!+search.get('kiosk');
const objectFit = search.get('objectFit');
const shader = search.get('shader')?.trim();
const HIDE_CURSOR_DELAY = 1000;
const allowedObjectFits = new Set(['fill', 'contain', 'cover', 'none', 'scale-down']);

// document.body.requestPointerLock();

let port;
let cursorTimer = 0;
let shaderRenderer;

const hideCursor = () => {
  document.documentElement.classList.add('cursor-hidden');
};

const showCursor = () => {
  document.documentElement.classList.remove('cursor-hidden');
  clearTimeout(cursorTimer);
  cursorTimer = window.setTimeout(hideCursor, HIDE_CURSOR_DELAY);
};

const getOutputBounds = () => ({
  left: kiosk && Number.isFinite(left) ? left : 0,
  top: kiosk && Number.isFinite(top) ? top : 0,
  width: width || window.innerWidth,
  height: height || window.innerHeight,
});

const applyOutputBounds = element => {
  if (!element) return;
  const bounds = getOutputBounds();
  element.style.left = `${bounds.left}px`;
  element.style.top = `${bounds.top}px`;
  element.style.width = `${bounds.width}px`;
  element.style.height = `${bounds.height}px`;
};

const vertexShaderSource = `
attribute vec2 a_position;
void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

const defaultFragmentHeader = `
precision mediump float;
uniform sampler2D u_texture;
uniform vec2 u_resolution;
uniform vec2 u_sourceResolution;
uniform vec4 u_drawRect;
uniform float u_time;

vec4 sampleSource(vec2 uv) {
  return texture2D(u_texture, uv);
}
`;

const defaultFragmentMain = `
void main() {
  vec2 point = vec2(gl_FragCoord.x, u_resolution.y - gl_FragCoord.y);
  vec2 uv = (point - u_drawRect.xy) / u_drawRect.zw;
  if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) {
    gl_FragColor = vec4(0.0);
    return;
  }
  vec4 color = sampleSource(uv);
  gl_FragColor = shader(uv, color);
}
`;

const createFragmentShaderSource = source => {
  if (source.includes('void main')) return source;
  return `${defaultFragmentHeader}
vec4 shader(vec2 uv, vec4 color) {
${source}
}
${defaultFragmentMain}`;
};

const createShader = (gl, type, source) => {
  const shaderObject = gl.createShader(type);
  gl.shaderSource(shaderObject, source);
  gl.compileShader(shaderObject);
  if (!gl.getShaderParameter(shaderObject, gl.COMPILE_STATUS)) {
    const message = gl.getShaderInfoLog(shaderObject) || 'Unknown shader compile error';
    gl.deleteShader(shaderObject);
    throw new Error(message);
  }
  return shaderObject;
};

const createProgram = (gl, fragmentSource) => {
  const program = gl.createProgram();
  const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
  const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, createFragmentShaderSource(fragmentSource));
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  gl.deleteShader(vertexShader);
  gl.deleteShader(fragmentShader);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const message = gl.getProgramInfoLog(program) || 'Unknown shader link error';
    gl.deleteProgram(program);
    throw new Error(message);
  }
  return program;
};

const getVideoSize = video => ({
  width: video.videoWidth || width || window.innerWidth,
  height: video.videoHeight || height || window.innerHeight,
});

const resolveSizeToken = (token, sourceSize) => {
  if (token === 'width') return sourceSize.width;
  if (token === 'height') return sourceSize.height;
  if (token === 'half-width') return sourceSize.width / 2;
  if (token === 'half-height') return sourceSize.height / 2;
  if (token === 'double-width') return sourceSize.width * 2;
  if (token === 'double-height') return sourceSize.height * 2;

  const numericValue = Number(token);
  return Number.isFinite(numericValue) && numericValue > 0 ? numericValue : undefined;
};

const getShaderOutputSize = (fragmentSource, sourceSize) => {
  const sizeMatch = fragmentSource.match(
    /gmib:output-size\s+([a-z-]+|\d+(?:\.\d+)?)\s+([a-z-]+|\d+(?:\.\d+)?)/i,
  );
  if (sizeMatch) {
    const shaderWidth = resolveSizeToken(sizeMatch[1], sourceSize);
    const shaderHeight = resolveSizeToken(sizeMatch[2], sourceSize);
    if (shaderWidth && shaderHeight) return { width: shaderWidth, height: shaderHeight };
  }

  const aspectMatch = fragmentSource.match(/gmib:output-aspect\s+(\d+(?:\.\d+)?)/i);
  if (aspectMatch) {
    const aspect = Number(aspectMatch[1]);
    if (Number.isFinite(aspect) && aspect > 0) return { width: aspect, height: 1 };
  }

  return sourceSize;
};

const getDrawRect = (fit, outputSize, sourceSize) => {
  const outputWidth = outputSize.width;
  const outputHeight = outputSize.height;
  const sourceWidth = sourceSize.width || outputWidth;
  const sourceHeight = sourceSize.height || outputHeight;
  if (fit === 'fill') return [0, 0, outputWidth, outputHeight];

  let scale = 1;
  if (fit === 'contain') {
    scale = Math.min(outputWidth / sourceWidth, outputHeight / sourceHeight);
  } else if (fit === 'cover') {
    scale = Math.max(outputWidth / sourceWidth, outputHeight / sourceHeight);
  } else if (fit === 'scale-down') {
    scale = Math.min(1, outputWidth / sourceWidth, outputHeight / sourceHeight);
  }

  const drawWidth = sourceWidth * scale;
  const drawHeight = sourceHeight * scale;
  return [(outputWidth - drawWidth) / 2, (outputHeight - drawHeight) / 2, drawWidth, drawHeight];
};

const createShaderRenderer = (video, canvas, fragmentSource, fit) => {
  if (!canvas) throw new Error('Shader canvas is not available');
  const gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: false });
  if (!gl) throw new Error('WebGL is not available');

  const program = createProgram(gl, fragmentSource);
  const positionLocation = gl.getAttribLocation(program, 'a_position');
  const resolutionLocation = gl.getUniformLocation(program, 'u_resolution');
  const sourceResolutionLocation = gl.getUniformLocation(program, 'u_sourceResolution');
  const drawRectLocation = gl.getUniformLocation(program, 'u_drawRect');
  const timeLocation = gl.getUniformLocation(program, 'u_time');
  const textureLocation = gl.getUniformLocation(program, 'u_texture');

  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
    gl.STATIC_DRAW,
  );

  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

  const started = performance.now();
  let frameId = 0;

  const resize = () => {
    applyOutputBounds(canvas);
    const { width: nextWidth, height: nextHeight } = getOutputBounds();
    if (canvas.width !== nextWidth) canvas.width = nextWidth;
    if (canvas.height !== nextHeight) canvas.height = nextHeight;
    gl.viewport(0, 0, canvas.width, canvas.height);
  };

  const render = () => {
    frameId = window.requestAnimationFrame(render);
    if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;

    resize();
    const sourceSize = getVideoSize(video);
    const shaderOutputSize = getShaderOutputSize(fragmentSource, sourceSize);
    const drawRect = getDrawRect(fit, { width: canvas.width, height: canvas.height }, shaderOutputSize);

    gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);

    gl.uniform1i(textureLocation, 0);
    gl.uniform2f(resolutionLocation, canvas.width, canvas.height);
    gl.uniform2f(sourceResolutionLocation, sourceSize.width, sourceSize.height);
    gl.uniform4f(drawRectLocation, drawRect[0], drawRect[1], drawRect[2], drawRect[3]);
    gl.uniform1f(timeLocation, (performance.now() - started) / 1000);

    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  };

  window.addEventListener('resize', resize);
  render();

  return {
    destroy() {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener('resize', resize);
      gl.deleteTexture(texture);
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
    },
  };
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
    applyOutputBounds(videoElement);
    videoElement.style.setProperty(
      '--object-fit',
      allowedObjectFits.has(objectFit) ? objectFit : 'cover',
    );
    if (shader) {
      const canvasElement = document.querySelector('canvas');
      try {
        applyOutputBounds(canvasElement);
        shaderRenderer = createShaderRenderer(
          videoElement,
          canvasElement,
          shader,
          allowedObjectFits.has(objectFit) ? objectFit : 'cover',
        );
        document.documentElement.classList.add('shader-enabled');
      } catch (err) {
        console.error(`Shader output disabled: ${err.message}`);
        shaderRenderer?.destroy();
        shaderRenderer = undefined;
        document.documentElement.classList.remove('shader-enabled');
      }
    }
    // window.setInterval(() => {
    //   const { droppedVideoFrames, totalVideoFrames, creationTime } = videoElement.getVideoPlaybackQuality();
    //   console.log(!!port, droppedVideoFrames, totalVideoFrames);
    //   port?.postMessage({ quality: { droppedVideoFrames, totalVideoFrames, creationTime }, sourceId, outputId });
    // }, 1000);
  }
};
