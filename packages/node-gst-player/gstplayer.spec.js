const gstplayer = require('./index');
const GstPlayer = gstplayer.GstPlayer;
const util = require('util');

// console.log('xrandr.getOutputs()', util.inspect(gstplayer.xrandr.getOutputs(), {showHidden: true, depth: null}));

setTimeout(() => {
    const player = new GstPlayer();
    player.playlist = [
        'file:///Users/sarakusha/Movies/demo/1_number-count-backwards_-1spwfpgb__D.mp4',
        'file:///home/sarakusha/Video/demo/1_number-count-backwards_-1spwfpgb__D.mp4'
    ];
    console.log('player', util.inspect(player, null, false));
    console.log(
        Object
            .getOwnPropertyNames(Object.getPrototypeOf(player))
            .filter(name => typeof player[name] !== 'function')
            .forEach(name => console.log(`${name} = ${player[name]}`)));
    player.current = 0;
    player.show();
    player.play();
}, 500);
setTimeout(() => gstplayer.close(), 10000).unref();