"use strict";

var _service = _interopRequireDefault(require("./service"));

var _mib = require("../mib");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

_service.default.start();

setTimeout(() => {
  const minihost = _mib.devices.create('::8D:A0'); // minihost.brightness = 75;


  minihost.on('connected', () => {
    minihost.read(2, 11).then(values => console.warn('RESULT', values), reason => console.error('error', reason)); // minihost.read().then(values => console.log(values));
  });
}, 3000);