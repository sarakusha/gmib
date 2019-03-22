"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const react_1 = __importDefault(require("react"));
const formik_material_ui_1 = require("formik-material-ui");
const material_ui_color_picker_1 = __importDefault(require("material-ui-color-picker"));
const ColorPickerField = (props) => {
    const { form: { setFieldValue }, field: { name, value } } = props;
    const changed = react_1.default.useCallback((color) => {
        setFieldValue(name, color || '#fff');
    }, [setFieldValue, name]);
    const textFieldProps = react_1.default.useMemo(() => ({
        autoComplete: 'off',
        InputProps: {
            disableUnderline: true,
            style: {
                backgroundColor: 'black',
                borderRadius: 8,
                color: value,
                paddingLeft: 5,
                width: '12ch',
            },
        },
    }), [value]);
    return (<material_ui_color_picker_1.default {...formik_material_ui_1.fieldToTextField(props)} TextFieldProps={textFieldProps} onChange={changed}/>);
};
exports.default = react_1.default.memo(ColorPickerField);
//# sourceMappingURL=ColorPickerField.jsx.map