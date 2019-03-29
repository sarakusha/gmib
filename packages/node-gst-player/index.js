const gstplayer = require('bindings')('node_gst_player');;
const inherits = require('util').inherits;
const EventEmitter = require('events').EventEmitter;

process.on('SIGINT', gstplayer.close);
process.on('SIGTERM', gstplayer.close);
process.on('uncaughtException', (err) => {
    console.error("Unhandled exception", err.stack);
    gstplayer.close();
});

inherits(gstplayer.Player, EventEmitter);

// const emitter = new EventEmitter();
// gstplayer.on = emitter.on.bind(emitter);
// gstplayer.emit = emitter.emit.bind(emitter);

gstplayer.init(() => {
    console.log('GContext was closed');
    setTimeout(() => process.exit(0), 100).unref();
});

module.exports = gstplayer;
