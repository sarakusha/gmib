"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.mib2json = mib2json;
exports.convert = convert;
exports.convertDir = convertDir;
exports.getMibs = getMibs;
exports.getMibsSync = getMibsSync;

var _fs = _interopRequireDefault(require("fs"));

var _iconvLite = require("iconv-lite");

var path = _interopRequireWildcard(require("path"));

var _sax = _interopRequireDefault(require("sax"));

var _stream = require("stream");

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) { var desc = Object.defineProperty && Object.getOwnPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : {}; if (desc.get || desc.set) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } } newObj.default = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

class Utf8Converter extends _stream.Transform {
  constructor(encoding) {
    super();
    this.encoding = encoding;

    if (!(0, _iconvLite.encodingExists)(encoding)) {
      throw new Error(`encoding ${encoding} is not supported`);
    }
  } // tslint:disable-next-line


  _transform(chunk, encoding, callback) {
    callback(undefined, (0, _iconvLite.decode)(chunk, this.encoding));
  }

}

function getEncoding(mibpath) {
  return new Promise((resolve, reject) => {
    let encoding;

    const saxStream = _sax.default.createStream(true, {});

    saxStream.on('error', err => reject(err));
    saxStream.on('processinginstruction', pi => {
      if (!pi.body) {
        return;
      }

      const match = /encoding="(.*)"/g.exec(pi.body);

      if (match) {
        [, encoding] = match;
      }
    });
    saxStream.on('end', () => resolve(encoding));

    _fs.default.createReadStream(mibpath).pipe(saxStream);
  });
}

function mib2json(mibpath) {
  return new Promise((resolve, reject) => {
    const saxStream = _sax.default.createStream(true, {
      xmlns: true,
      trim: true,
      normalize: true
    });

    saxStream.on('error', err => reject(err));
    const root = {};
    let level = 0;
    let current;
    const types = {};
    let subroutines;
    const trail = [];
    let state;
    saxStream.on('opentag', tag => {
      //      logger.element(util.inspect(tag, {depth: null}));
      if (level < 5 || subroutines) {
        switch (tag.local) {
          case 'element':
            if (level === 1) {
              root[tag.attributes.name.value] = tag.attributes.type.value;
            } else if (subroutines) {
              current = subroutines[tag.attributes.name.value] = {};
            }

            break;

          case 'simpleType':
          case 'complexType':
            if (level === 1) {
              current = types[tag.attributes.name.value] = {};
              trail.length = 0;
            }

            break;

          case 'sequence':
            if (level === 2) {
              trail.push(current);
              current = false;
              root.subroutines = subroutines = {};
            }

            break;

          case 'annotation':
            state = 'annotation';
            break;

          case 'appinfo':
            current.appinfo = {};
            state = 'appinfo';
            break;

          case 'restriction':
            current.base = tag.attributes.base.value;
            break;

          case 'minInclusive':
          case 'maxInclusive':
          case 'minExclusive':
          case 'maxExclusive':
            current[tag.local] = tag.attributes.value.value;
            break;

          case 'enumeration':
            current.enumeration = current.enumeration || {};
            trail.push(current);
            current = current.enumeration[tag.attributes.value.value] = {};
            break;

          case 'attribute':
            current.properties = current.properties || {};
            trail.push(current);
            current = current.properties[tag.attributes.name.value] = {
              type: tag.attributes.type.value
            };
            break;
        }
      }

      level += 1;
    });
    saxStream.on('closetag', tagName => {
      level -= 1;

      if (tagName === 'xs:sequence') {
        subroutines = false;
        current = trail.pop();
      } else if (current) {
        if (tagName === 'xs:attribute' || tagName === 'xs:enumeration') {
          current = trail.pop();
        }
      }
    });

    const textHandler = function (text) {
      if (current) {
        if (state === 'appinfo') {
          const local = this._parser.tag.local;
          const appinfo = current.appinfo;

          if (appinfo[local]) {
            appinfo[local] += `
${text}`;
          } else {
            appinfo[local] = text;
          }
        }

        state === 'annotation' && (current.annotation = text);
      }
    };

    saxStream.on('text', textHandler);
    saxStream.on('end', () => {
      root.types = types;
      resolve(root);
    });
    getEncoding(mibpath).then(encoding => {
      let input = _fs.default.createReadStream(mibpath);

      if (encoding && (0, _iconvLite.encodingExists)(encoding)) {
        input = input.pipe(new Utf8Converter(encoding));
      }

      input.pipe(saxStream);
    }).catch(reject);
  });
}

async function convert(mibpath) {
  const json = await mib2json(mibpath);
  const jsonpath = `${mibpath.replace(/\.[^/.]+$/, '')}.json`;
  const data = JSON.stringify(json, null, 2);
  return new Promise((resolve, reject) => {
    _fs.default.writeFile(jsonpath, data, err => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

const xsdMibRe = /^\S+\.mib\.xsd$/i;
const jsonMibRe = /^(\S+)\.mib\.json$/i;

function convertDir(dir) {
  return new Promise((resolve, reject) => {
    _fs.default.readdir(dir, (err, files) => {
      if (err) {
        return reject(err);
      }

      const promises = files.filter(file => xsdMibRe.test(file)).map(file => convert(path.join(dir, file)).then(() => console.info(`${file}: success`)).catch(error => console.error(`${file}: ${error.message}`)));
      resolve(Promise.all(promises).then(() => void 0));
    });
  });
}

let mibs = [];
const mibsDir = path.resolve(__dirname, '../../mibs');

function filesToMibs(files) {
  return files.map(file => jsonMibRe.exec(file)).filter(matches => matches != null).map(matches => matches[1]);
}

function getMibs() {
  return new Promise((resolve, reject) => {
    _fs.default.readdir(mibsDir, (err, files) => {
      if (err) {
        mibs = [];
        return reject(err);
      }

      mibs = filesToMibs(files);
      resolve(mibs);
    });
  });
}

function getMibsSync() {
  if (!mibs || mibs.length === 0) {
    mibs = filesToMibs(_fs.default.readdirSync(mibsDir));
  }

  return mibs;
}