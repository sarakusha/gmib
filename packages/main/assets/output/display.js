onmessage = ({ data }) => {
  if (typeof data !== 'object') return;
  if ('close' in data && data.close) {
    window.close();
  }
}