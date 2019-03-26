"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const passport_1 = __importDefault(require("passport"));
exports.passport = passport_1.default;
const passport_local_1 = require("passport-local");
const users_1 = __importDefault(require("./users"));
passport_1.default.use(new passport_local_1.Strategy({
    usernameField: 'username',
    passwordField: 'password',
}, (name, password, done) => {
    const user = users_1.default.getUser(name);
    if (!user || !user.checkPassword(password)) {
        return done(null, false, { message: 'Неверный пароль' });
    }
    done(null, user);
}));
passport_1.default.serializeUser((user, done) => {
    done(null, user.name);
});
passport_1.default.deserializeUser((name, done) => {
    const user = users_1.default.getUser(name);
    done(user ? null : 'Неизвестный пользователь', user);
});
//# sourceMappingURL=auth.js.map