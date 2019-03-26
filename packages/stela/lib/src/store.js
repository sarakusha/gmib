"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const configstore_1 = __importDefault(require("configstore"));
const lodash_1 = require("lodash");
exports.pkgName = 'stela';
const store = new configstore_1.default(exports.pkgName);
function getSafeStore() {
    return lodash_1.omit(store.all, ['users']);
}
exports.getSafeStore = getSafeStore;
exports.default = store;
//# sourceMappingURL=store.js.map