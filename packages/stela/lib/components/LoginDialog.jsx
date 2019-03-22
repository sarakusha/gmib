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
const Button_1 = __importDefault(require("@material-ui/core/Button"));
const Dialog_1 = __importDefault(require("@material-ui/core/Dialog"));
const DialogActions_1 = __importDefault(require("@material-ui/core/DialogActions"));
const DialogContent_1 = __importDefault(require("@material-ui/core/DialogContent"));
const DialogTitle_1 = __importDefault(require("@material-ui/core/DialogTitle"));
const formik_1 = require("formik");
const formik_material_ui_1 = require("formik-material-ui");
const LoginForm = ({ isOpen, onSubmit, username, password }) => {
    const formRef = react_1.useRef(null);
    const submitForm = react_1.useCallback((e) => {
        if (formRef.current)
            formRef.current.submitForm();
        e.stopPropagation();
    }, []);
    const onSubmitForm = react_1.useCallback((values, formikActions) => {
        onSubmit &&
            Promise
                .resolve(onSubmit(values))
                .then(([isOk, { message }]) => {
                formikActions.setSubmitting(false);
                if (!isOk) {
                    formikActions.setFieldError('password', message || 'invalid password');
                }
            });
    }, [onSubmit]);
    return (<Dialog_1.default open={isOpen} aria-labelledby="form-login-title" onClose={submitForm}>
      <DialogTitle_1.default id="form-login-title">Стела</DialogTitle_1.default>
      <DialogContent_1.default>
        <formik_1.Formik initialValues={{
        username: username || 'admin',
        password: password || '',
    }} onSubmit={onSubmitForm} ref={formRef} enableReinitialize={true}>
          {({ errors }) => (<formik_1.Form>
              
                
                
                
                
                
                
                
              
              <formik_1.Field margin="dense" name="password" label="Пароль" type="password" fullWidth component={formik_material_ui_1.TextField} errors={errors.password}/>
            </formik_1.Form>)}
        </formik_1.Formik>
      </DialogContent_1.default>
      <DialogActions_1.default>
        <Button_1.default onClick={submitForm} color="primary" fullWidth variant="contained" type="submit">
          Войти
        </Button_1.default>
      </DialogActions_1.default>
    </Dialog_1.default>);
};
exports.default = LoginForm;
//# sourceMappingURL=LoginDialog.jsx.map