/// <reference types="react" />
import { FormControlProps } from '@material-ui/core/FormControl';
import { FormLabelProps } from '@material-ui/core/FormLabel';
export interface FormFieldSetProps extends FormControlProps {
    legend?: string;
    form?: string;
    title?: string;
}
export declare const FormLegend: (props: FormLabelProps) => JSX.Element;
declare const FormFieldSet: ({ legend, children, title, ...props }: FormFieldSetProps) => JSX.Element;
export default FormFieldSet;
//# sourceMappingURL=FormFieldSet.d.ts.map