"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const crypto_1 = require("crypto");
const lodash_1 = require("lodash");
const store_1 = __importDefault(require("./store"));
const usersKey = 'users';
class User {
    constructor(name, passwordHash, salt) {
        this.name = name;
        this.passwordHash = passwordHash;
        this.salt = salt;
    }
    toJSON() {
        return {
            name: this.name,
            passwordHash: this.passwordHash.toString('base64'),
            salt: this.salt.toString('base64'),
        };
    }
    checkPassword(password) {
        return Buffer.compare(User.getHash(password, this.salt), this.passwordHash) === 0;
    }
    static fromJSON(name, passwordHash, salt) {
        return Object.freeze(new User(name, Buffer.from(passwordHash, 'base64'), Buffer.from(salt, 'base64')));
    }
    static getHash(password, salt) {
        return crypto_1.pbkdf2Sync(password, salt, 1, 128, 'sha1');
    }
    static getSalt() {
        return crypto_1.randomBytes(128);
    }
}
exports.User = User;
class UserStore {
    constructor() {
        this.users = {};
    }
    reload() {
        const users = store_1.default.get(usersKey);
        if (!users || Object.keys(users).length === 0) {
            this.createUser('admin', 'admin');
            console.log('create default user admin:admin');
            return;
        }
        this.users = lodash_1.transform(users, (result, { name, passwordHash, salt }) => {
            result[name] = User.fromJSON(name, passwordHash, salt);
        }, {});
    }
    save() {
        const users = lodash_1.transform(this.users, (result, user, name) => {
            result[name] = user.toJSON();
        }, {});
        store_1.default.set(usersKey, users);
    }
    createUser(name, password) {
        if (this.users[name])
            return [null, `Unknown user "${name}"`];
        const salt = User.getSalt();
        const passwordHash = User.getHash(password, salt);
        const user = Object.freeze(new User(name, passwordHash, salt));
        this.users[name] = user;
        this.save();
        return [user, undefined];
    }
    changeUserPassword(name, newPassword, oldPassword) {
        const user = this.users[name];
        if (!user) {
            return [null, `Unknown user "${name}"`];
        }
        if (!user.checkPassword(oldPassword)) {
            return [null, 'Invalid password'];
        }
        delete this.users[name];
        return this.createUser(name, newPassword);
    }
    removeUser(name) {
        if (!this.users[name])
            return false;
        delete this.users[name];
        this.save();
    }
    getUser(name) {
        return this.users[name];
    }
    hasUser(name) {
        if (!name)
            return false;
        const user = this.users[name];
        return !!(user && user.name);
    }
}
const users = new UserStore();
users.reload();
exports.default = users;
//# sourceMappingURL=users.js.map