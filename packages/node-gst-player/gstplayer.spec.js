const gstplayer = require('./index');
const GstPlayer = gstplayer.GstPlayer;
const util = require('util');
const path = require('path');
console.log('xrandr.getOutputs()', util.inspect(gstplayer.xrandr.getOutputs(), {showHidden: true, depth: null}));

function printPlayer(player) {
    console.log(
        Object
            .getOwnPropertyNames(Object.getPrototypeOf(player))
            .filter(name => typeof player[name] !== 'function')
            .reduce((result, name) => {result[name] = player[name]; return result}, {}));
}

function bootstrap() {
    const player = new GstPlayer();
    const movie = path.resolve('../test.mp4');
    player.playlist = [
        `file:///${movie}`
    ];
    player.current = 0;
    player.show();
    player.play();
    setTimeout(() => {
        player.width = 600;
        player.height = 400;
    }, 1000);
    setTimeout(() => {
        player.left = 600;
        player.top = 400;
        printPlayer(player);
    }, 2000);
    player.on("changed", (prop) => {
        console.log(`changed ${prop} =  ${player[prop]}`);
    });
    player.on("EOS", () => {
        gstplayer.close();
    });
}

bootstrap();
// setTimeout(() => gstplayer.close(), 10000).unref();

