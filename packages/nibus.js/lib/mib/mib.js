"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.validJsName = validJsName;
exports.unitConverter = unitConverter;
exports.precisionConverter = precisionConverter;
exports.enumerationConverter = enumerationConverter;
exports.representationConverter = representationConverter;
exports.packed8floatConverter = packed8floatConverter;
exports.getIntSize = getIntSize;
exports.minInclusiveConverter = minInclusiveConverter;
exports.maxInclusiveConverter = maxInclusiveConverter;
exports.convertFrom = exports.convertTo = exports.versionTypeConverter = exports.fixedPointNumber4Converter = exports.percentConverter = exports.booleanConverter = exports.toInt = exports.withValue = void 0;

var _printf = _interopRequireDefault(require("printf"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function validJsName(name) {
  return name.replace(/(_\w)/g, (_, s) => s[1].toUpperCase());
}

const withValue = (value, writable = false) => ({
  value,
  writable,
  configurable: false,
  enumerable: true
});

exports.withValue = withValue;
const hex = /^0X[0-9A-F]+$/i;

const isHex = str => hex.test(str) || parseInt(str, 10).toString(10) !== str.toLowerCase().replace(/^[0 ]+/, '');

const toInt = (value = 0) => typeof value === 'number' ? value : parseInt(value, isHex(value) ? 16 : 10);

exports.toInt = toInt;

function unitConverter(unit) {
  const fromRe = new RegExp(`(\\s*${unit}\\s*)$`, 'i');
  return {
    from: value => typeof value === 'string' ? value.replace(fromRe, '') : value,
    to: value => value != null ? `${value}${unit}` : value
  };
}

function precisionConverter(precision) {
  const format = `%.${precision}f`;
  return {
    from: value => typeof value === 'string' ? parseFloat(value) : value,
    to: value => typeof value === 'number' ? (0, _printf.default)(format, value) : value
  };
}

function enumerationConverter(enumerationValues) {
  const from = {};
  const to = {};
  const keys = Reflect.ownKeys(enumerationValues);
  keys.forEach(key => {
    const value = enumerationValues[key];
    const index = toInt(key);
    from[value.annotation] = index;
    to[index] = value.annotation;
  });
  return {
    from: value => typeof value === 'string' && Reflect.has(from, value) ? from[value] : undefined,
    to: value => (typeof value === 'number' || typeof value === 'string') && Reflect.has(to, value) ? to[value] : value
  };
}

const yes = /^\s*(yes|on|true|1|да)\s*$/i;
const no = /^\s*(no|off|false|0|нет)\s*$/i;
const booleanConverter = {
  from: value => {
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
  to: value => {
    if (typeof value === 'boolean') {
      return value ? 'Да' : 'Нет';
    }

    return value;
  }
};
exports.booleanConverter = booleanConverter;
const percentConverter = {
  from: value => typeof value === 'number' ? Math.max(Math.min(Math.round(value * 255 / 100), 255), 0) : value,
  to: value => typeof value === 'number' ? Math.max(Math.min(Math.round(value * 100 / 255), 100), 0) : value
};
exports.percentConverter = percentConverter;

function representationConverter(format, size) {
  let from;
  let to;
  let fmt; // fromFn = toFn = function (value) { return value; };

  switch (format) {
    case '%b':
    case '%B':
      fmt = `%0${size * 8}s`;

      from = value => typeof value === 'string' ? parseInt(value, 2) : value;

      to = value => typeof value === 'number' ? (0, _printf.default)(fmt, value.toString(2)) : value;

      break;

    case '%x':
    case '%X':
      fmt = `%0${size}s`;

      from = value => typeof value === 'string' ? parseInt(value, 16) : value;

      to = value => typeof value === 'number' ? (0, _printf.default)(fmt, value.toString(16)) : value;

      break;

    default:
      from = value => value;

      to = from;
  }

  return {
    from,
    to
  };
}

function packed8floatConverter(subtype) {
  let delta = 0;

  if (subtype.appinfo && subtype.appinfo.zero) {
    delta = parseFloat(subtype.appinfo.zero) || 0;
  }

  return {
    from: value => {
      const val = typeof value === 'string' ? parseFloat(value) : value;
      return typeof val === 'number' ? Math.floor((val - delta) * 100) & 0xFF : val;
    },
    to: value => typeof value === 'number' ? value / 100 + delta : value
  };
}

const fixedPointNumber4Converter = {
  from: value => {
    const val = typeof value === 'string' ? parseFloat(value) : value;

    if (typeof val !== 'number') {
      return val;
    }

    const dec = Math.round(val * 1000) % 1000;
    const hi = (Math.floor(val) << 4) + Math.floor(dec / 100) & 0xFF;
    const low = dec % 10 + (Math.floor(dec / 10) % 10 << 4) & 0xFF;
    return hi << 8 | low;
  },
  to: value => {
    if (typeof value !== 'number') {
      return value;
    }

    const hi = value >> 8 & 0xFF;
    const low = value & 0xFF;
    const dec = (hi & 0xF) * 100 + (low >> 4) * 10 + (low & 0xF);
    return (hi >> 4) + dec / 1000;
  }
};
exports.fixedPointNumber4Converter = fixedPointNumber4Converter;
const versionTypeConverter = {
  from: () => {
    throw new Error('versionType is readonly property');
  },
  to: value => typeof value === 'number' ? `${value >> 8 & 0xFF}.${value & 0xFF} [0x${(value >>> 16).toString(16)}]` : value
};
exports.versionTypeConverter = versionTypeConverter;

function getIntSize(type) {
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

function minInclusiveConverter(min) {
  const minIncl = parseFloat(min);
  return {
    from: value => Math.max(value, minIncl),
    to: value => value
  };
}

function maxInclusiveConverter(max) {
  const maxIncl = parseFloat(max);
  return {
    from: value => Math.min(value, maxIncl),
    to: value => value
  };
}

const convertTo = converters => value => converters.reduceRight((result, converter) => result !== undefined && converter.to(result), value);

exports.convertTo = convertTo;

const convertFrom = converters => value => converters.reduce((present, converter) => converter.from(present), value);

exports.convertFrom = convertFrom;