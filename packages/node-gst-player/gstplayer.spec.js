const gstplayer = require('./index');
const Player = gstplayer.Player;
const util = require('util');
const path = require('path');
let repeat = 3;

// console.log('xrandr.getOutputs()', util.inspect(gstplayer.xrandr.getOutputs(), {showHidden: true, depth: null}));

function printPlayer(player) {
    console.log(
        Object
            .getOwnPropertyNames(Object.getPrototypeOf(player))
            .filter(name => typeof player[name] !== 'function')
            .reduce((result, name) => {
                result[name] = player[name];
                return result
            }, {}));
}

function bootstrap() {
    const movies = [
        '../test.mp4',
        '../pict.jpg',
        '../test2.mp4',
        '../video_test.mp4'
    ];
    Player.discover(movies, (err, result) => {
        console.log('RESULT', result);
        // gstplayer.close();
    }).then((r) => console.log('PROMISE', r));
    const player = new Player();
    player.width = 192 * 2;
    player.height = 108;
    player.playlist = movies;
    player.show();
    player.audioEnabled = false;
    player.current = 0;
    player.play();
//     setTimeout(() => {
//         // player.current = 0;
//         // player.play();
//     }, 1000);
//     setTimeout(() => {
//         player.width = 192 * 2;
//         player.height = 108;
//     }, 2000);
//     setTimeout(() => {
//         player.top = 100;
//     }, 3000);
//     setTimeout(() => {
//         player.top = 200;
//     }, 4000);
//     setTimeout(() => {
//         player.top = 300;
//     }, 5000);
//     setTimeout(() => {
//         player.top = 400;
//         printPlayer(player);
//     }, 6000);
    player.on('changed', (prop) => {
        console.log(`changed ${prop} = ${player[prop]}`);
    });
    player.on('EOS', () => {
        console.info('EOS');
        --repeat || gstplayer.close();
    });
    player.on('position', (pos, percent) => console.info('position', pos, percent));
    player.on('warning', (msg) => {
        console.warn('Warning:', msg);
    });
    player.on('bus-error', (msg) => {
        console.error('Error:', msg);
        // player.current = (player.current + 1) % movies.length;
        // player.play();
    });
    player.on('state-changed', (state) => {
        console.info('state-changed:', state);
    });
    player.on('uri-loaded', (file) => {
        console.log('loaded', file);
    });
    player.on('seek-done', (pos) => {
        console.info('seek-done', pos);
    });
//     setTimeout(() => {
//         player.seek(8.3);
//     }, 3000);
//     setTimeout(() => {
//         player.left = 0;
//         player.top = 0;
//         player.width = 1920;
//         player.height = 1080;
//     }, 20000);
    // setTimeout(()=> {
    //     player.current = 0;
    // }, 25000);
}

bootstrap();
// setTimeout(() => gstplayer.close(), 13000).unref();

