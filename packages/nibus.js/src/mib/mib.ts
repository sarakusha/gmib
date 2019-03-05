import printf from 'printf';
import { IMibType } from './devices';

export function validJsName(name: string) {
  return name.replace(/(_\w)/g, (_, s) => s[1].toUpperCase());
}

export const withValue = (value: any, writable = false): PropertyDescriptor => ({
  value,
  writable,
  configurable: false,
  enumerable: true,
});
const hex = /^0X[0-9A-F]+$/i;
const isHex = (str: string) => hex.test(str)
  || parseInt(str, 10).toString(10) !== str.toLowerCase().replace(/^[0 ]+/, '');
export const toInt = (value: string | number = 0) => typeof value === 'number'
  ? value
  : parseInt(value, isHex(value) ? 16 : 10);

type ResultType = string | number | boolean | undefined;
type PresentType = string | number | boolean | undefined;

export interface IConverter {
  from: (value: PresentType) => ResultType;
  to: (value: ResultType) => PresentType;
}

export function unitConverter(unit: string): IConverter {
  const fromRe = new RegExp(`(\\s*${unit}\\s*)$`, 'i');
  return {
    from: value => typeof value === 'string' ? value.replace(fromRe, '') : value,
    to: value => value != null ? `${value}${unit}` : value,
  };
}

export function precisionConverter(precision: string): IConverter {
  const format = `%.${precision}f`;
  return {
    from: value => typeof value === 'string' ? parseFloat(value) : value,
    to: value => typeof value === 'number' ? printf(format, value) : value,
  };
}

export function enumerationConverter(enumerationValues: IMibType['enumeration']): IConverter {
  const from: any = {};
  const to: any = {};
  const keys = Reflect.ownKeys(enumerationValues!) as string[];
  keys.forEach((key) => {
    const value = enumerationValues![key];
    const index = toInt(key);
    from[value.annotation] = index;
    to[index] = value.annotation;
  });
  return {
    from: value => typeof value === 'string' && Reflect.has(from, value) ? from[value] : undefined,
    to: value => (typeof value === 'number' || typeof value === 'string')
    && Reflect.has(to, value) ? to[value] : value,
  };
}

const yes = /^\s*(yes|on|true|1|да)\s*$/i;
const no = /^\s*(no|off|false|0|нет)\s*$/i;
export const booleanConverter: IConverter = {
  from: (value) => {
    if (typeof value === 'string') {
      if (yes.test(value)) {
        return true;
      }
      if (no.test(value)) {
        return false;
      }
    }
    return value;
  },
  to: (value) => {
    if (typeof value === 'boolean') {
      return value ? 'Да' : 'Нет';
    }
    return value;
  },
};

export const percentConverter: IConverter = {
  from: value => typeof value === 'number' ? Math.max(Math.min(
    Math.round(value * 255 / 100),
    255,
  ), 0) : value,
  to: value => typeof value === 'number' ? Math.max(
    Math.min(Math.round(value * 100 / 255), 100),
    0,
  ) : value,
};

export function representationConverter(format: string, size: number): IConverter {
  let from: IConverter['from'];
  let to: IConverter['to'];
  let fmt: string;
  // fromFn = toFn = function (value) { return value; };

  switch (format) {
    case '%b':
    case '%B':
      fmt = `%0${size * 8}s`;
      from = value => typeof value === 'string' ? parseInt(value, 2) : value;
      to = value => typeof value === 'number' ? printf(fmt, value.toString(2)) : value;
      break;
    case '%x':
    case '%X':
      fmt = `%0${size}s`;
      from = value => typeof value === 'string' ? parseInt(value, 16) : value;
      to = value => typeof value === 'number' ? printf(fmt, value.toString(16)) : value;
      break;
    default:
      from = value => value;
      to = from;
  }

  return {
    from,
    to,
  };
}

export function packed8floatConverter(subtype: IMibType): IConverter {
  let delta = 0;
  if (subtype.appinfo && subtype.appinfo.zero) {
    delta = parseFloat(subtype.appinfo.zero) || 0;
  }
  return {
    from: (value) => {
      const val = typeof value === 'string' ? parseFloat(value) : value;
      return typeof val === 'number' ? Math.floor((val - delta) * 100) & 0xFF : val;
    },
    to: value => typeof value === 'number' ? value / 100 + delta : value,
  };
}

export const fixedPointNumber4Converter: IConverter = {
  from: (value) => {
    const val = typeof value === 'string' ? parseFloat(value) : value;
    if (typeof val !== 'number') {
      return val;
    }
    const dec = Math.round(val * 1000) % 1000;
    const hi = ((Math.floor(val) << 4) + Math.floor(dec / 100)) & 0xFF;
    const low = (dec % 10 + ((Math.floor(dec / 10) % 10) << 4)) & 0xFF;
    return (hi << 8) | low;
  },
  to: (value) => {
    if (typeof value !== 'number') {
      return value;
    }
    const hi = (value >> 8) & 0xFF;
    const low = value & 0xFF;
    const dec = (hi & 0xF) * 100 + (low >> 4) * 10 + (low & 0xF);
    return (hi >> 4) + dec / 1000;
  },
};

export const versionTypeConverter: IConverter = {
  from: () => {
    throw new Error('versionType is readonly property');
  },
  to: value => typeof value === 'number'
    ? `${(value >> 8) & 0xFF}.${value & 0xFF} [0x${(value >>> 16).toString(16)}]`
    : value,
};

export function getIntSize(type: string) {
  switch (type) {
    case 'xs:NMTOKEN':
    case 'xs:unsignedByte':
    case 'xs:byte':
      return 1;
    case 'xs:short':
    case 'xs:unsignedShort':
      return 2;
    case 'xs:int':
    case 'xs:unsignedInt':
      return 4;
    case 'xs:long':
    case 'xs:unsignedLong':
      return 8;
  }
}

export function minInclusiveConverter(min: string) : IConverter {
  const minIncl = parseFloat(min);
  return {
    from: value => Math.max(value as number, minIncl),
    to: value => value,
  };
}

export function maxInclusiveConverter(max: string) : IConverter {
  const maxIncl = parseFloat(max);
  return {
    from: value => Math.min(value as number, maxIncl),
    to: value => value,
  };
}
export const convertTo = (converters: IConverter[]) => (value: ResultType) =>
  converters.reduceRight(
    (result, converter) => result !== undefined && converter.to(result),
    value,
  );

export const convertFrom = (converters: IConverter[]) => (value: PresentType) =>
  converters.reduce((present, converter) => converter.from(present), value);
