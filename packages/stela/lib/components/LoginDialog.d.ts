/// <reference types="react" />
export interface LoginProps {
    username?: string;
    password: string;
}
export declare type LoginResult = [boolean, {
    message?: string;
    passport?: {
        user: string;
    };
}];
export interface LoginDialogProps extends Partial<LoginProps> {
    isOpen: boolean;
    onSubmit?: (values: LoginProps) => Promise<LoginResult>;
}
declare const LoginForm: ({ isOpen, onSubmit, username, password }: LoginDialogProps) => JSX.Element;
export default LoginForm;
//# sourceMappingURL=LoginDialog.d.ts.map