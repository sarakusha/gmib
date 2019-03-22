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
const FormGroup_1 = __importDefault(require("@material-ui/core/FormGroup"));
const Avatar_1 = __importDefault(require("@material-ui/core/Avatar"));
const IconButton_1 = __importDefault(require("@material-ui/core/IconButton"));
const Clear_1 = __importDefault(require("@material-ui/icons/Clear"));
const classnames_1 = __importDefault(require("classnames"));
const formik_1 = require("formik");
const formik_material_ui_1 = require("formik-material-ui");
const CurrencyField_1 = __importDefault(require("./CurrencyField"));
const FormFieldSet_1 = __importDefault(require("./FormFieldSet"));
const StelaFormRow = ({ item: { id }, index, handleProps, classes, errors = {}, locked, isDragging, remove, }) => {
    const lockedInput = react_1.useMemo(() => (locked
        ? {
            readOnly: true,
            inputProps: {
                tabIndex: -1,
                readOnly: true,
            },
        }
        : {}), [locked]);
    return (<FormFieldSet_1.default margin={'dense'} fullWidth={true} key={id || index}>
      <FormGroup_1.default row={true}>
        <Avatar_1.default {...handleProps} className={classnames_1.default(classes.dragHandle, { [classes.dragHandleDragging]: isDragging }, { [classes.dragHandleLocked]: locked })} tabIndex={locked ? -1 : 0}>
          {index + 1}
        </Avatar_1.default>
        <formik_1.Field name={`items[${index}].isVisible`} component={formik_material_ui_1.Checkbox} title="Вывести на экран" disabled={locked}/>
        <formik_1.Field name={`items[${index}].name`} type="text" label="Марка" component={formik_material_ui_1.TextField} className={classes.textField} InputProps={lockedInput}/>
        <formik_1.Field name={`items[${index}].subName`} type="text" label="Бренд" component={formik_material_ui_1.TextField} className={classes.textField} InputProps={lockedInput}/>
        <formik_1.Field error={errors.price} name={`items[${index}].price`} type="text" label="Цена" component={CurrencyField_1.default} className={classes.numberField}/>
        <IconButton_1.default disabled={locked} onClick={remove}>
          <Clear_1.default fontSize="small"/>
        </IconButton_1.default>
      </FormGroup_1.default>
    </FormFieldSet_1.default>);
};
exports.default = react_1.default.memo(StelaFormRow);
//# sourceMappingURL=StelaFormRow.jsx.map