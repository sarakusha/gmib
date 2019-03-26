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
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const FormGroup_1 = __importDefault(require("@material-ui/core/FormGroup"));
const MenuItem_1 = __importDefault(require("@material-ui/core/MenuItem"));
const styles_1 = require("@material-ui/core/styles");
const classnames_1 = __importDefault(require("classnames"));
const formik_1 = require("formik");
const formik_material_ui_1 = require("formik-material-ui");
const set_1 = __importDefault(require("lodash/set"));
const react_1 = __importStar(require("react"));
const react_beautiful_dnd_1 = require("react-beautiful-dnd");
const recompose_1 = require("recompose");
const timeid_1 = __importDefault(require("../src/timeid"));
const ColorPickerField_1 = __importDefault(require("./ColorPickerField"));
const FormFieldSet_1 = __importDefault(require("./FormFieldSet"));
const LockToolbar_1 = __importDefault(require("./LockToolbar"));
const Section_1 = __importDefault(require("./Section"));
const StelaFormRow_1 = __importDefault(require("./StelaFormRow"));
const styles = (theme) => styles_1.createStyles({
    form: {
        maxWidth: 800,
        [theme.breakpoints.up('sm')]: {
            marginRight: theme.spacing.unit * 3,
        },
    },
    textField: {
        marginLeft: theme.spacing.unit,
        flex: 2,
    },
    props: {
        display: 'flex',
        flexDirection: 'column',
        [theme.breakpoints.down('xs')]: {
            paddingLeft: theme.spacing.unit,
            paddingRight: theme.spacing.unit,
        },
    },
    numberField: {
        marginLeft: theme.spacing.unit,
        flex: '0 0 5ch',
        [theme.breakpoints.up('sm')]: {
            flex: '0 0 8ch',
        },
    },
    dragHandle: {
        cursor: 'unset',
        backgroundColor: theme.palette.primary.main,
    },
    dragHandleDragging: {
        backgroundColor: theme.palette.primary.light,
    },
    dragHandleLocked: {
        backgroundColor: theme.palette.primary.light,
    },
    draggingRow: {
        backgroundColor: theme.palette.background.default,
        userSelect: 'none',
    },
    fontName: {
        maxWidth: '20ch',
    },
});
const rightAlign = {
    textAlign: 'right',
};
const sizeProps = {
    min: 6,
    style: rightAlign,
};
const dimensionProps = {
    min: 20,
    step: 4,
    style: rightAlign,
};
const lineHeightProps = {
    min: 1,
    step: 0.1,
    style: rightAlign,
};
const paddingProps = {
    min: 0,
    step: 1,
    style: rightAlign,
};
const InnerForm = (props) => {
    const { values: { items }, classes, submitForm, errors, bindSubmitForm, bindResetForm, submittingChanged, isSubmitting, resetForm, } = props;
    react_1.useEffect(() => {
        bindSubmitForm && bindSubmitForm(submitForm);
        return () => {
            bindSubmitForm && bindSubmitForm(() => { });
        };
    }, [submitForm, bindSubmitForm]);
    react_1.useEffect(() => {
        submittingChanged && submittingChanged(isSubmitting);
    }, [submittingChanged, isSubmitting]);
    react_1.useEffect(() => {
        bindResetForm && bindResetForm(resetForm);
        return () => {
            bindResetForm && bindResetForm(() => { });
        };
    }, [resetForm, bindResetForm]);
    const arrayHelpersRef = react_1.useRef(null);
    const dragEndMemo = react_1.useCallback((result) => {
        if (!result.destination || !arrayHelpersRef.current)
            return;
        arrayHelpersRef.current.move(result.source.index, result.destination.index);
    }, [arrayHelpersRef]);
    const addClick = react_1.useCallback(() => {
        const item = {
            id: timeid_1.default(),
            name: '',
            subName: '',
            price: '',
            isVisible: true,
        };
        arrayHelpersRef.current && arrayHelpersRef.current.push(item);
    }, [arrayHelpersRef]);
    const [locked, setLocked] = react_1.useState(true);
    const [settingsExpanded, setSettingsExpanded] = react_1.useState(false);
    function handleChange(e, isLocked) {
        setLocked(isLocked);
    }
    function handleSettingsChange(e, expanded) {
        setSettingsExpanded(expanded);
    }
    return (<formik_1.Form noValidate className={classes.form} autoComplete="off">
      <Section_1.default title={(<LockToolbar_1.default title={'Прайс-лист'} onChange={handleChange} checked={locked} onAdd={addClick}/>)} defaultExpanded={true} className={classes.props}>
        <FormFieldSet_1.default fullWidth={true}>
          <formik_1.FieldArray name="items">
            {(arrayHelpers) => {
        arrayHelpersRef.current = arrayHelpers;
        return (<react_beautiful_dnd_1.DragDropContext onDragEnd={dragEndMemo}>
                  <react_beautiful_dnd_1.Droppable droppableId="droppable">
                    {provided => (<div ref={provided.innerRef}>
                        {items.map((item, index) => (<react_beautiful_dnd_1.Draggable draggableId={item.id || `${index}`} index={index} key={item.id} isDragDisabled={locked}>
                            {(provided, snapshot) => (<div ref={provided.innerRef} {...provided.draggableProps} className={classnames_1.default({ [classes.draggingRow]: snapshot.isDragging })}>
                                <StelaFormRow_1.default item={item} index={index} classes={classes} handleProps={provided.dragHandleProps} errors={errors.items && errors.items[index]} locked={locked} isDragging={snapshot.isDragging} remove={arrayHelpers.handleRemove(index)}/>
                              </div>)}
                          </react_beautiful_dnd_1.Draggable>))}
                        {provided.placeholder}
                      </div>)}
                  </react_beautiful_dnd_1.Droppable>
                </react_beautiful_dnd_1.DragDropContext>);
    }}
          </formik_1.FieldArray>
        </FormFieldSet_1.default>
      </Section_1.default>
      <Section_1.default title={'Настройки'} className={classes.props} disabled={locked} onChange={handleSettingsChange} expanded={settingsExpanded && !locked}>
        <FormFieldSet_1.default margin="none" legend={'Шрифт'}>
          <FormGroup_1.default row={true}>
            <formik_1.Field name="isBold" Label={{
        label: 'Жирный',
        className: classes.textField,
    }} component={formik_material_ui_1.CheckboxWithLabel}/>
            <formik_1.Field name="isCondensed" Label={{
        label: 'Уплотненный',
        className: classes.textField,
    }} component={formik_material_ui_1.CheckboxWithLabel}/>
            <formik_1.Field name="lineHeight" type="number" label="Высота" component={formik_material_ui_1.TextField} className={classes.numberField} inputProps={lineHeightProps}/>
          </FormGroup_1.default>
          <formik_1.Field name="fontName" type="text" label="Имя" select title="Гарнитура" component={formik_material_ui_1.TextField} className={classes.fontName} InputLabelProps={{ shrink: true }}>
            <MenuItem_1.default value="Ubuntu">Ubuntu</MenuItem_1.default>
            <MenuItem_1.default value="LCDnova">LCD</MenuItem_1.default>
          </formik_1.Field>
        </FormFieldSet_1.default>
        <FormFieldSet_1.default margin="normal" legend={'Заголовок'} fullWidth={false}>
          <FormGroup_1.default row={true}>
            <formik_1.Field name="titleColor" label="Цвет" component={ColorPickerField_1.default}/>
            <formik_1.Field name="titleSize" type="number" label="Размер" component={formik_material_ui_1.TextField} className={classes.numberField} inputProps={sizeProps}/>
            <formik_1.Field name="title" type="text" label="Имя" component={formik_material_ui_1.TextField} className={classes.textField}/>
          </FormGroup_1.default>
        </FormFieldSet_1.default>
        <FormFieldSet_1.default margin="normal" legend={'Марка'} fullWidth={false}>
          <FormGroup_1.default row={true}>
            <formik_1.Field name="nameColor" type="text" label="Цвет" component={ColorPickerField_1.default}/>
            <formik_1.Field name="nameSize" type="number" label="Размер" component={formik_material_ui_1.TextField} className={classes.numberField} inputProps={sizeProps}/>
          </FormGroup_1.default>
        </FormFieldSet_1.default>
        <FormFieldSet_1.default margin="normal" legend={'Бренд'}>
          <FormGroup_1.default row={true}>
            <formik_1.Field name="subColor" type="text" label="Цвет" component={ColorPickerField_1.default}/>
            <formik_1.Field name="subSize" type="number" label="Размер" component={formik_material_ui_1.TextField} className={classes.numberField} inputProps={sizeProps}/>
          </FormGroup_1.default>
        </FormFieldSet_1.default>
        <FormFieldSet_1.default margin="normal" legend={'Цена'}>
          <FormGroup_1.default row={true}>
            <formik_1.Field name="priceColor" type="text" label="Цвет" component={ColorPickerField_1.default}/>
            <formik_1.Field name="priceSize" type="number" label="Размер" component={formik_material_ui_1.TextField} className={classes.numberField} inputProps={sizeProps}/>
          </FormGroup_1.default>
        </FormFieldSet_1.default>
        <FormFieldSet_1.default legend={'Размер'}>
          <FormGroup_1.default row>
            <formik_1.Field name="width" type="number" label="Ширина" component={formik_material_ui_1.TextField} className={classes.numberField} inputProps={dimensionProps}/>
            <formik_1.Field name="height" type="number" label="Высота" component={formik_material_ui_1.TextField} className={classes.numberField} inputProps={dimensionProps}/>
            <formik_1.Field name="paddingTop" type="number" label="Отступ" title="Отступ сверху" component={formik_material_ui_1.TextField} className={classes.numberField} inputProps={paddingProps}/>
          </FormGroup_1.default>
        </FormFieldSet_1.default>
      </Section_1.default>
    </formik_1.Form>);
};
exports.default = recompose_1.compose(styles_1.withStyles(styles), formik_1.withFormik({
    validateOnChange: true,
    enableReinitialize: true,
    mapPropsToValues: (_a) => {
        var { update, classes, items } = _a, props = __rest(_a, ["update", "classes", "items"]);
        return (Object.assign({}, props, { items: items.map((_a) => {
                var { name, subName, price } = _a, other = __rest(_a, ["name", "subName", "price"]);
                return (Object.assign({ name: name || '', subName: subName || '', price: typeof price === 'number' ? price.toFixed(2) : price || '' }, other));
            }) }));
    },
    handleSubmit: (values, { props: { update }, setSubmitting }) => {
        update(values);
        setSubmitting(false);
    },
    validate: (values) => {
        const errors = {};
        const { items } = values;
        items.forEach(({ name, price }, index) => {
            if (name.trim().length === 0) {
                set_1.default(errors, `items[${index}].name`, `required${index}`);
            }
            const num = Number(price);
            if (price !== '' && (Number.isNaN(num) || num === 0)) {
                set_1.default(errors, `items[${index}].price`, 'must be a number');
            }
        });
        return errors;
    },
}))(InnerForm);
//# sourceMappingURL=StelaForm.jsx.map