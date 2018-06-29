// import './detector';
// import nms from './nms/servicetype';
process.on('uncaughtException', (err) => {
  console.error('ERROR:', err);
  process.exit(1);
});

import('./sarp').catch((err) => {
  console.error('ERROR while load', err);
  process.exit(1);
});
// console.log(nms);
