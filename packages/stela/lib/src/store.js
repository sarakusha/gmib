"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const configstore_1 = __importDefault(require("configstore"));
exports.pkgName = 'stela';
const store = new configstore_1.default(exports.pkgName);
exports.default = store;
//# sourceMappingURL=store.js.map