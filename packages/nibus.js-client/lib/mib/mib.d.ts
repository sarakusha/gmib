import { IMibType } from './devices';
export declare function validJsName(name: string): string;
export declare const withValue: (value: any, writable?: boolean, configurable?: boolean) => PropertyDescriptor;
export declare const toInt: (value?: string | number | boolean) => number;
declare type ResultType = string | number | boolean | undefined;
declare type PresentType = string | number | boolean | undefined;
export interface IConverter {
    from: (value: PresentType) => ResultType;
    to: (value: ResultType) => PresentType;
}
export declare function unitConverter(unit: string): IConverter;
export declare function precisionConverter(precision: string): IConverter;
export declare function enumerationConverter(enumerationValues: IMibType['enumeration']): IConverter;
export declare const booleanConverter: IConverter;
export declare const percentConverter: IConverter;
export declare function representationConverter(format: string, size: number): IConverter;
export declare function packed8floatConverter(subtype: IMibType): IConverter;
export declare const fixedPointNumber4Converter: IConverter;
export declare const versionTypeConverter: IConverter;
export declare function getIntSize(type: string): 1 | 2 | 4 | 8 | undefined;
export declare function minInclusiveConverter(min: number): IConverter;
export declare function maxInclusiveConverter(max: number): IConverter;
export declare const convertTo: (converters: IConverter[]) => (value: string | number | boolean | undefined) => string | number | boolean | undefined;
export declare const convertFrom: (converters: IConverter[]) => (value: string | number | boolean | undefined) => string | number | boolean | undefined;
export {};
//# sourceMappingURL=mib.d.ts.map