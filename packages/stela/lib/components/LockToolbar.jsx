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
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const react_1 = __importStar(require("react"));
const Typography_1 = __importDefault(require("@material-ui/core/Typography"));
const styles_1 = require("@material-ui/core/styles");
const IconButton_1 = __importDefault(require("@material-ui/core/IconButton"));
const Lock_1 = __importDefault(require("@material-ui/icons/Lock"));
const LockOpen_1 = __importDefault(require("@material-ui/icons/LockOpen"));
const Fab_1 = __importDefault(require("@material-ui/core/Fab"));
const Add_1 = __importDefault(require("@material-ui/icons/Add"));
const recompose_1 = require("recompose");
const styles = (theme) => styles_1.createStyles({
    heading: {
        flexGrow: 1,
    },
    root: {
        display: 'flex',
        width: '100%',
        alignItems: 'center',
    },
    margin: {
        marginLeft: theme.spacing.unit,
        marginRight: theme.spacing.unit,
    },
});
const LockToolbar = (_a) => {
    var { title, classes, checked, onChange, onAdd } = _a, props = __rest(_a, ["title", "classes", "checked", "onChange", "onAdd"]);
    const handleChange = react_1.useCallback((e) => {
        onChange && onChange(e.target, !checked);
        e.stopPropagation();
    }, [onChange]);
    const handleAdd = react_1.useCallback((e) => {
        onAdd && onAdd();
        e.stopPropagation();
    }, [onAdd]);
    return (<div className={classes.root}>
      <Typography_1.default variant={'h6'} className={classes.heading}>{title}</Typography_1.default>
      <IconButton_1.default onClick={handleChange} title="Изменить настройки" {...props} className={classes.margin} color="primary">
        {checked ? <Lock_1.default /> : <LockOpen_1.default />}
      </IconButton_1.default>
      <Fab_1.default color={'secondary'} aria-label={'Add'} size={'medium'} disabled={checked} className={classes.margin} onClick={handleAdd} title="Добавить позицию">
        <Add_1.default />
      </Fab_1.default>
    </div>);
};
exports.default = recompose_1.compose(react_1.default.memo, styles_1.withStyles(styles))(LockToolbar);
//# sourceMappingURL=LockToolbar.jsx.map