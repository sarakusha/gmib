export declare enum Effect {
    none = 0,
    neon = 2
}
export interface PriceItem {
    id?: string;
    name: string;
    subName: string;
    price: number | string;
    isVisible: boolean;
    effect?: Effect;
}
export interface StelaProps {
    width: number;
    height: number;
    backgroundColor: string;
    isCondensed: boolean;
    isBold: boolean;
    title: string;
    titleColor: string;
    titleSize: number;
    nameColor: string;
    nameSize: number;
    subColor: string;
    subSize: string;
    priceColor: string;
    priceSize: string;
    lineHeight: number;
    items: PriceItem[];
    paddingTop: number;
    fontName: string;
}
export declare const PROPS: string[];
export interface BindFormik {
    bindSubmitForm?: (submitForm: () => void) => void;
    submittingChanged?: (isSubmitting: boolean) => void;
    bindResetForm?: (resetForm: () => void) => void;
}
//# sourceMappingURL=stela.d.ts.map