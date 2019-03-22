"use strict";
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) if (e.indexOf(p[i]) < 0)
            t[p[i]] = s[p[i]];
    return t;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const react_1 = __importDefault(require("react"));
const FormControl_1 = __importDefault(require("@material-ui/core/FormControl"));
const FormLabel_1 = __importDefault(require("@material-ui/core/FormLabel"));
exports.FormLegend = (props) => <FormLabel_1.default {...props} component={'legend'}/>;
const FormFieldSet = (_a) => {
    var { legend, children, title } = _a, props = __rest(_a, ["legend", "children", "title"]);
    return (<FormControl_1.default component={'fieldset'} {...props} title={title || legend}>
    {legend && <exports.FormLegend>{legend}</exports.FormLegend>}
    {children}
  </FormControl_1.default>);
};
exports.default = FormFieldSet;
//# sourceMappingURL=FormFieldSet.jsx.map