const gstplayer = require('bindings')('node_gst_player');;
const inherits = require('util').inherits;
const EventEmmitter = require('events').EventEmitter;

process.on('SIGINT', gstplayer.close);
process.on('SIGTERM', gstplayer.close);

inherits(gstplayer.GstPlayer, EventEmmitter);

// process.on('uncaughtException', gstplayer.close);

gstplayer.init(() => {
    console.log('GContext was closed');
});




module.exports = gstplayer;
