"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const http_1 = require("http");
const express_1 = __importDefault(require("express"));
const next_1 = __importDefault(require("next"));
const socket_io_1 = __importDefault(require("socket.io"));
const debug_1 = __importDefault(require("debug"));
const lodash_1 = require("lodash");
const body_parser_1 = __importDefault(require("body-parser"));
const express_session_1 = __importDefault(require("express-session"));
const memorystore_1 = __importDefault(require("memorystore"));
const compression_1 = __importDefault(require("compression"));
const users_1 = __importDefault(require("../src/users"));
const auth_1 = require("../src/auth");
const stela_1 = require("../src/stela");
const timeid_1 = __importDefault(require("../src/timeid"));
const store_1 = __importStar(require("../src/store"));
const dev = process.env.NODE_ENV !== 'production';
const nextApp = next_1.default({ dev });
const debug = debug_1.default(store_1.pkgName);
const app = express_1.default();
const server = new http_1.Server(app);
const io = socket_io_1.default(server);
const port = parseInt(process.env.PORT || '3000', 10);
const nextHandler = nextApp.getRequestHandler();
const MemoryStore = memorystore_1.default(express_session_1.default);
const maxAge = 60000 * 60 / 2;
const sessionMiddleware = express_session_1.default({
    secret: 'secret',
    store: new MemoryStore({
        checkPeriod: maxAge,
    }),
    resave: true,
    saveUninitialized: true,
    cookie: {
        maxAge,
        httpOnly: true,
        secure: 'auto',
    },
});
function checkAndUpdateID() {
    const items = store_1.default.get('items') || [];
    const ids = {};
    store_1.default.set('items', items.map((item) => {
        while (!item.id || ids[item.id]) {
            item.id = timeid_1.default();
        }
        try {
            item.price = parseFloat(item.price);
        }
        catch (e) {
            item.price = 0;
            console.error('invalid value in item.price', e.message);
        }
        ids[item.id] = true;
        return item;
    }));
}
checkAndUpdateID();
console.log(`configuration file is ${store_1.default.path}`);
io.use(({ request }, next) => {
    sessionMiddleware(request, request.res, next);
});
io.on('connection', (socket) => {
    debug('socket has connected');
    socket.emit('initial', store_1.default.all);
    socket.on('disconnected', () => {
        debug('socket has disconnected');
    });
    socket.on('reload', () => {
        socket.request.session.reload(() => { });
    });
    socket.on('update', (props) => {
        const session = socket.request.session;
        const username = session && session.passport && session.passport.user;
        if (!users_1.default.hasUser(username)) {
            socket.emit('logout');
            return;
        }
        const update = lodash_1.pick(props, stela_1.PROPS);
        store_1.default.set(update);
        checkAndUpdateID();
        io.emit('changed', lodash_1.pick(store_1.default.all, Object.keys(update)));
        debug(`update by ${username}`, JSON.stringify(props));
    });
});
nextApp.prepare().then(() => {
    app.use(compression_1.default());
    app.all('/_next/*', (req, res) => nextHandler(req, res));
    app.use(body_parser_1.default.json());
    app.use(sessionMiddleware);
    app.use(auth_1.passport.initialize());
    app.use(auth_1.passport.session());
    app.get('/', (req, res) => {
        return nextApp.render(req, res, '/', store_1.default.all);
    });
    app.get('/dashboard', (res, req) => {
        return nextApp.render(res, req, '/dashboard', store_1.default.all);
    });
    app.post('/login', auth_1.passport.authenticate('local'), (req, res) => {
        const session = req.session;
        res.send(session);
    });
    app.get('/logout', (req, res) => {
        req.logout();
        res.end();
    });
    app.get('*', (req, res) => nextHandler(req, res));
    server.listen(port, (err) => {
        if (err)
            throw err;
        console.log(`> Ready on http://localhost:${port}`);
    });
});
//# sourceMappingURL=index.js.map