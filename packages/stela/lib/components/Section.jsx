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
const Divider_1 = __importDefault(require("@material-ui/core/Divider"));
const react_1 = __importDefault(require("react"));
const ExpansionPanel_1 = __importDefault(require("@material-ui/core/ExpansionPanel"));
const ExpansionPanelDetails_1 = __importDefault(require("@material-ui/core/ExpansionPanelDetails"));
const ExpansionPanelSummary_1 = __importDefault(require("@material-ui/core/ExpansionPanelSummary"));
const ExpansionPanelActions_1 = __importDefault(require("@material-ui/core/ExpansionPanelActions"));
const Typography_1 = __importDefault(require("@material-ui/core/Typography"));
const ExpandMore_1 = __importDefault(require("@material-ui/icons/ExpandMore"));
const styles_1 = require("@material-ui/core/styles");
const styles = (theme) => styles_1.createStyles({
    title: {
        paddingTop: theme.spacing.unit,
        paddingBottom: theme.spacing.unit,
    },
});
const Section = (_a) => {
    var { title, classes, className, children, actions } = _a, props = __rest(_a, ["title", "classes", "className", "children", "actions"]);
    return (<ExpansionPanel_1.default {...props}>
    <ExpansionPanelSummary_1.default expandIcon={<ExpandMore_1.default />}>
      {typeof title === 'string'
        ? <Typography_1.default variant={'h6'} className={classes.title}>{title}</Typography_1.default>
        : title}
    </ExpansionPanelSummary_1.default>
    <Divider_1.default />
    <ExpansionPanelDetails_1.default className={className}>
      {children}
    </ExpansionPanelDetails_1.default>
    {actions && <Divider_1.default />}
    {actions && (<ExpansionPanelActions_1.default>
        {actions}
      </ExpansionPanelActions_1.default>)}
  </ExpansionPanel_1.default>);
};
exports.default = styles_1.withStyles(styles)(Section);
//# sourceMappingURL=Section.jsx.map