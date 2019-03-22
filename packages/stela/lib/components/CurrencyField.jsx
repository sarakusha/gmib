"use strict";
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
const TextField_1 = __importDefault(require("@material-ui/core/TextField"));
const formik_material_ui_1 = require("formik-material-ui");
const inputProps = {
    step: 0.1,
    min: 0.1,
    style: {
        textAlign: 'right',
    },
};
const CurrencyField = (props) => {
    const { form: { setFieldValue }, field: { name }, error } = props;
    const format = react_1.useCallback(({ target: { value } }) => {
        const numValue = Number(value);
        setFieldValue(name, Number.isNaN(numValue) || value.trim().length === 0
            ? value
            : numValue.toFixed(2));
    }, [setFieldValue, name]);
    return (<TextField_1.default {...formik_material_ui_1.fieldToTextField(props)} onBlur={format} type={'number'} error={!!error} helperText={error} inputProps={inputProps}/>);
};
exports.default = react_1.default.memo(CurrencyField);
//# sourceMappingURL=CurrencyField.jsx.map