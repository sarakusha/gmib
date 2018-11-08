const gstplayer = require('bindings')('node_gst_player');;
const inherits = require('util').inherits;
const EventEmmitter = require('events').EventEmitter;

process.on('SIGINT', gstplayer.close);
process.on('SIGTERM', gstplayer.close);
process.on('uncaughtException', (err) => {
    console.error("Unhandled exception", err.stack);
    gstplayer.close();
});

inherits(gstplayer.GstPlayer, EventEmmitter);


gstplayer.init(() => {
    console.log('GContext was closed');
});




module.exports = gstplayer;
