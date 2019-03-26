module.exports =
/******/ (function(modules) { // webpackBootstrap
/******/ 	// The module cache
/******/ 	var installedModules = require('../../../ssr-module-cache.js');
/******/
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/
/******/ 		// Check if module is in cache
/******/ 		if(installedModules[moduleId]) {
/******/ 			return installedModules[moduleId].exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = installedModules[moduleId] = {
/******/ 			i: moduleId,
/******/ 			l: false,
/******/ 			exports: {}
/******/ 		};
/******/
/******/ 		// Execute the module function
/******/ 		var threw = true;
/******/ 		try {
/******/ 			modules[moduleId].call(module.exports, module, module.exports, __webpack_require__);
/******/ 			threw = false;
/******/ 		} finally {
/******/ 			if(threw) delete installedModules[moduleId];
/******/ 		}
/******/
/******/ 		// Flag the module as loaded
/******/ 		module.l = true;
/******/
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/
/******/
/******/ 	// expose the modules object (__webpack_modules__)
/******/ 	__webpack_require__.m = modules;
/******/
/******/ 	// expose the module cache
/******/ 	__webpack_require__.c = installedModules;
/******/
/******/ 	// define getter function for harmony exports
/******/ 	__webpack_require__.d = function(exports, name, getter) {
/******/ 		if(!__webpack_require__.o(exports, name)) {
/******/ 			Object.defineProperty(exports, name, { enumerable: true, get: getter });
/******/ 		}
/******/ 	};
/******/
/******/ 	// define __esModule on exports
/******/ 	__webpack_require__.r = function(exports) {
/******/ 		if(typeof Symbol !== 'undefined' && Symbol.toStringTag) {
/******/ 			Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
/******/ 		}
/******/ 		Object.defineProperty(exports, '__esModule', { value: true });
/******/ 	};
/******/
/******/ 	// create a fake namespace object
/******/ 	// mode & 1: value is a module id, require it
/******/ 	// mode & 2: merge all properties of value into the ns
/******/ 	// mode & 4: return value when already ns object
/******/ 	// mode & 8|1: behave like require
/******/ 	__webpack_require__.t = function(value, mode) {
/******/ 		if(mode & 1) value = __webpack_require__(value);
/******/ 		if(mode & 8) return value;
/******/ 		if((mode & 4) && typeof value === 'object' && value && value.__esModule) return value;
/******/ 		var ns = Object.create(null);
/******/ 		__webpack_require__.r(ns);
/******/ 		Object.defineProperty(ns, 'default', { enumerable: true, value: value });
/******/ 		if(mode & 2 && typeof value != 'string') for(var key in value) __webpack_require__.d(ns, key, function(key) { return value[key]; }.bind(null, key));
/******/ 		return ns;
/******/ 	};
/******/
/******/ 	// getDefaultExport function for compatibility with non-harmony modules
/******/ 	__webpack_require__.n = function(module) {
/******/ 		var getter = module && module.__esModule ?
/******/ 			function getDefault() { return module['default']; } :
/******/ 			function getModuleExports() { return module; };
/******/ 		__webpack_require__.d(getter, 'a', getter);
/******/ 		return getter;
/******/ 	};
/******/
/******/ 	// Object.prototype.hasOwnProperty.call
/******/ 	__webpack_require__.o = function(object, property) { return Object.prototype.hasOwnProperty.call(object, property); };
/******/
/******/ 	// __webpack_public_path__
/******/ 	__webpack_require__.p = "";
/******/
/******/
/******/ 	// Load entry module and return exports
/******/ 	return __webpack_require__(__webpack_require__.s = 4);
/******/ })
/************************************************************************/
/******/ ({

/***/ "../../node_modules/@babel/runtime-corejs2/core-js/array/is-array.js":
/*!*************************************************************************************************************!*\
  !*** /Users/sarakusha/WebstormProjects/@nata/node_modules/@babel/runtime-corejs2/core-js/array/is-array.js ***!
  \*************************************************************************************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

module.exports = __webpack_require__(/*! core-js/library/fn/array/is-array */ "core-js/library/fn/array/is-array");

/***/ }),

/***/ "../../node_modules/@babel/runtime-corejs2/core-js/date/now.js":
/*!*******************************************************************************************************!*\
  !*** /Users/sarakusha/WebstormProjects/@nata/node_modules/@babel/runtime-corejs2/core-js/date/now.js ***!
  \*******************************************************************************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

module.exports = __webpack_require__(/*! core-js/library/fn/date/now */ "core-js/library/fn/date/now");

/***/ }),

/***/ "../../node_modules/@babel/runtime-corejs2/core-js/get-iterator.js":
/*!***********************************************************************************************************!*\
  !*** /Users/sarakusha/WebstormProjects/@nata/node_modules/@babel/runtime-corejs2/core-js/get-iterator.js ***!
  \***********************************************************************************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

module.exports = __webpack_require__(/*! core-js/library/fn/get-iterator */ "core-js/library/fn/get-iterator");

/***/ }),

/***/ "../../node_modules/@babel/runtime-corejs2/core-js/number/is-nan.js":
/*!************************************************************************************************************!*\
  !*** /Users/sarakusha/WebstormProjects/@nata/node_modules/@babel/runtime-corejs2/core-js/number/is-nan.js ***!
  \************************************************************************************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

module.exports = __webpack_require__(/*! core-js/library/fn/number/is-nan */ "core-js/library/fn/number/is-nan");

/***/ }),

/***/ "../../node_modules/@babel/runtime-corejs2/core-js/object/assign.js":
/*!************************************************************************************************************!*\
  !*** /Users/sarakusha/WebstormProjects/@nata/node_modules/@babel/runtime-corejs2/core-js/object/assign.js ***!
  \************************************************************************************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

module.exports = __webpack_require__(/*! core-js/library/fn/object/assign */ "core-js/library/fn/object/assign");

/***/ }),

/***/ "../../node_modules/@babel/runtime-corejs2/core-js/object/create.js":
/*!************************************************************************************************************!*\
  !*** /Users/sarakusha/WebstormProjects/@nata/node_modules/@babel/runtime-corejs2/core-js/object/create.js ***!
  \************************************************************************************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

module.exports = __webpack_require__(/*! core-js/library/fn/object/create */ "core-js/library/fn/object/create");

/***/ }),

/***/ "../../node_modules/@babel/runtime-corejs2/core-js/object/define-property.js":
/*!*********************************************************************************************************************!*\
  !*** /Users/sarakusha/WebstormProjects/@nata/node_modules/@babel/runtime-corejs2/core-js/object/define-property.js ***!
  \*********************************************************************************************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

module.exports = __webpack_require__(/*! core-js/library/fn/object/define-property */ "core-js/library/fn/object/define-property");

/***/ }),

/***/ "../../node_modules/@babel/runtime-corejs2/core-js/object/get-own-property-descriptor.js":
/*!*********************************************************************************************************************************!*\
  !*** /Users/sarakusha/WebstormProjects/@nata/node_modules/@babel/runtime-corejs2/core-js/object/get-own-property-descriptor.js ***!
  \*********************************************************************************************************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

module.exports = __webpack_require__(/*! core-js/library/fn/object/get-own-property-descriptor */ "core-js/library/fn/object/get-own-property-descriptor");

/***/ }),

/***/ "../../node_modules/@babel/runtime-corejs2/core-js/object/get-own-property-symbols.js":
/*!******************************************************************************************************************************!*\
  !*** /Users/sarakusha/WebstormProjects/@nata/node_modules/@babel/runtime-corejs2/core-js/object/get-own-property-symbols.js ***!
  \******************************************************************************************************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

module.exports = __webpack_require__(/*! core-js/library/fn/object/get-own-property-symbols */ "core-js/library/fn/object/get-own-property-symbols");

/***/ }),

/***/ "../../node_modules/@babel/runtime-corejs2/core-js/object/get-prototype-of.js":
/*!**********************************************************************************************************************!*\
  !*** /Users/sarakusha/WebstormProjects/@nata/node_modules/@babel/runtime-corejs2/core-js/object/get-prototype-of.js ***!
  \**********************************************************************************************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

module.exports = __webpack_require__(/*! core-js/library/fn/object/get-prototype-of */ "core-js/library/fn/object/get-prototype-of");

/***/ }),

/***/ "../../node_modules/@babel/runtime-corejs2/core-js/object/keys.js":
/*!**********************************************************************************************************!*\
  !*** /Users/sarakusha/WebstormProjects/@nata/node_modules/@babel/runtime-corejs2/core-js/object/keys.js ***!
  \**********************************************************************************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

module.exports = __webpack_require__(/*! core-js/library/fn/object/keys */ "core-js/library/fn/object/keys");

/***/ }),

/***/ "../../node_modules/@babel/runtime-corejs2/core-js/object/set-prototype-of.js":
/*!**********************************************************************************************************************!*\
  !*** /Users/sarakusha/WebstormProjects/@nata/node_modules/@babel/runtime-corejs2/core-js/object/set-prototype-of.js ***!
  \**********************************************************************************************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

module.exports = __webpack_require__(/*! core-js/library/fn/object/set-prototype-of */ "core-js/library/fn/object/set-prototype-of");

/***/ }),

/***/ "../../node_modules/@babel/runtime-corejs2/core-js/symbol.js":
/*!*****************************************************************************************************!*\
  !*** /Users/sarakusha/WebstormProjects/@nata/node_modules/@babel/runtime-corejs2/core-js/symbol.js ***!
  \*****************************************************************************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

module.exports = __webpack_require__(/*! core-js/library/fn/symbol */ "core-js/library/fn/symbol");

/***/ }),

/***/ "../../node_modules/@babel/runtime-corejs2/core-js/symbol/iterator.js":
/*!**************************************************************************************************************!*\
  !*** /Users/sarakusha/WebstormProjects/@nata/node_modules/@babel/runtime-corejs2/core-js/symbol/iterator.js ***!
  \**************************************************************************************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

module.exports = __webpack_require__(/*! core-js/library/fn/symbol/iterator */ "core-js/library/fn/symbol/iterator");

/***/ }),

/***/ "../../node_modules/@babel/runtime-corejs2/helpers/esm/arrayWithHoles.js":
/*!*****************************************************************************************************************!*\
  !*** /Users/sarakusha/WebstormProjects/@nata/node_modules/@babel/runtime-corejs2/helpers/esm/arrayWithHoles.js ***!
  \*****************************************************************************************************************/
/*! exports provided: default */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "default", function() { return _arrayWithHoles; });
/* harmony import */ var _core_js_array_is_array__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../../core-js/array/is-array */ "../../node_modules/@babel/runtime-corejs2/core-js/array/is-array.js");
/* harmony import */ var _core_js_array_is_array__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(_core_js_array_is_array__WEBPACK_IMPORTED_MODULE_0__);

function _arrayWithHoles(arr) {
  if (_core_js_array_is_array__WEBPACK_IMPORTED_MODULE_0___default()(arr)) return arr;
}

/***/ }),

/***/ "../../node_modules/@babel/runtime-corejs2/helpers/esm/assertThisInitialized.js":
/*!************************************************************************************************************************!*\
  !*** /Users/sarakusha/WebstormProjects/@nata/node_modules/@babel/runtime-corejs2/helpers/esm/assertThisInitialized.js ***!
  \************************************************************************************************************************/
/*! exports provided: default */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "default", function() { return _assertThisInitialized; });
function _assertThisInitialized(self) {
  if (self === void 0) {
    throw new ReferenceError("this hasn't been initialised - super() hasn't been called");
  }

  return self;
}

/***/ }),

/***/ "../../node_modules/@babel/runtime-corejs2/helpers/esm/classCallCheck.js":
/*!*****************************************************************************************************************!*\
  !*** /Users/sarakusha/WebstormProjects/@nata/node_modules/@babel/runtime-corejs2/helpers/esm/classCallCheck.js ***!
  \*****************************************************************************************************************/
/*! exports provided: default */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "default", function() { return _classCallCheck; });
function _classCallCheck(instance, Constructor) {
  if (!(instance instanceof Constructor)) {
    throw new TypeError("Cannot call a class as a function");
  }
}

/***/ }),

/***/ "../../node_modules/@babel/runtime-corejs2/helpers/esm/createClass.js":
/*!**************************************************************************************************************!*\
  !*** /Users/sarakusha/WebstormProjects/@nata/node_modules/@babel/runtime-corejs2/helpers/esm/createClass.js ***!
  \**************************************************************************************************************/
/*! exports provided: default */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "default", function() { return _createClass; });
/* harmony import */ var _core_js_object_define_property__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../../core-js/object/define-property */ "../../node_modules/@babel/runtime-corejs2/core-js/object/define-property.js");
/* harmony import */ var _core_js_object_define_property__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(_core_js_object_define_property__WEBPACK_IMPORTED_MODULE_0__);


function _defineProperties(target, props) {
  for (var i = 0; i < props.length; i++) {
    var descriptor = props[i];
    descriptor.enumerable = descriptor.enumerable || false;
    descriptor.configurable = true;
    if ("value" in descriptor) descriptor.writable = true;

    _core_js_object_define_property__WEBPACK_IMPORTED_MODULE_0___default()(target, descriptor.key, descriptor);
  }
}

function _createClass(Constructor, protoProps, staticProps) {
  if (protoProps) _defineProperties(Constructor.prototype, protoProps);
  if (staticProps) _defineProperties(Constructor, staticProps);
  return Constructor;
}

/***/ }),

/***/ "../../node_modules/@babel/runtime-corejs2/helpers/esm/defineProperty.js":
/*!*****************************************************************************************************************!*\
  !*** /Users/sarakusha/WebstormProjects/@nata/node_modules/@babel/runtime-corejs2/helpers/esm/defineProperty.js ***!
  \*****************************************************************************************************************/
/*! exports provided: default */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "default", function() { return _defineProperty; });
/* harmony import */ var _core_js_object_define_property__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../../core-js/object/define-property */ "../../node_modules/@babel/runtime-corejs2/core-js/object/define-property.js");
/* harmony import */ var _core_js_object_define_property__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(_core_js_object_define_property__WEBPACK_IMPORTED_MODULE_0__);

function _defineProperty(obj, key, value) {
  if (key in obj) {
    _core_js_object_define_property__WEBPACK_IMPORTED_MODULE_0___default()(obj, key, {
      value: value,
      enumerable: true,
      configurable: true,
      writable: true
    });
  } else {
    obj[key] = value;
  }

  return obj;
}

/***/ }),

/***/ "../../node_modules/@babel/runtime-corejs2/helpers/esm/extends.js":
/*!**********************************************************************************************************!*\
  !*** /Users/sarakusha/WebstormProjects/@nata/node_modules/@babel/runtime-corejs2/helpers/esm/extends.js ***!
  \**********************************************************************************************************/
/*! exports provided: default */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "default", function() { return _extends; });
/* harmony import */ var _core_js_object_assign__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../../core-js/object/assign */ "../../node_modules/@babel/runtime-corejs2/core-js/object/assign.js");
/* harmony import */ var _core_js_object_assign__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(_core_js_object_assign__WEBPACK_IMPORTED_MODULE_0__);

function _extends() {
  _extends = _core_js_object_assign__WEBPACK_IMPORTED_MODULE_0___default.a || function (target) {
    for (var i = 1; i < arguments.length; i++) {
      var source = arguments[i];

      for (var key in source) {
        if (Object.prototype.hasOwnProperty.call(source, key)) {
          target[key] = source[key];
        }
      }
    }

    return target;
  };

  return _extends.apply(this, arguments);
}

/***/ }),

/***/ "../../node_modules/@babel/runtime-corejs2/helpers/esm/getPrototypeOf.js":
/*!*****************************************************************************************************************!*\
  !*** /Users/sarakusha/WebstormProjects/@nata/node_modules/@babel/runtime-corejs2/helpers/esm/getPrototypeOf.js ***!
  \*****************************************************************************************************************/
/*! exports provided: default */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "default", function() { return _getPrototypeOf; });
/* harmony import */ var _core_js_object_get_prototype_of__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../../core-js/object/get-prototype-of */ "../../node_modules/@babel/runtime-corejs2/core-js/object/get-prototype-of.js");
/* harmony import */ var _core_js_object_get_prototype_of__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(_core_js_object_get_prototype_of__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _core_js_object_set_prototype_of__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../../core-js/object/set-prototype-of */ "../../node_modules/@babel/runtime-corejs2/core-js/object/set-prototype-of.js");
/* harmony import */ var _core_js_object_set_prototype_of__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(_core_js_object_set_prototype_of__WEBPACK_IMPORTED_MODULE_1__);


function _getPrototypeOf(o) {
  _getPrototypeOf = _core_js_object_set_prototype_of__WEBPACK_IMPORTED_MODULE_1___default.a ? _core_js_object_get_prototype_of__WEBPACK_IMPORTED_MODULE_0___default.a : function _getPrototypeOf(o) {
    return o.__proto__ || _core_js_object_get_prototype_of__WEBPACK_IMPORTED_MODULE_0___default()(o);
  };
  return _getPrototypeOf(o);
}

/***/ }),

/***/ "../../node_modules/@babel/runtime-corejs2/helpers/esm/inherits.js":
/*!***********************************************************************************************************!*\
  !*** /Users/sarakusha/WebstormProjects/@nata/node_modules/@babel/runtime-corejs2/helpers/esm/inherits.js ***!
  \***********************************************************************************************************/
/*! exports provided: default */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "default", function() { return _inherits; });
/* harmony import */ var _core_js_object_create__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../../core-js/object/create */ "../../node_modules/@babel/runtime-corejs2/core-js/object/create.js");
/* harmony import */ var _core_js_object_create__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(_core_js_object_create__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _setPrototypeOf__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./setPrototypeOf */ "../../node_modules/@babel/runtime-corejs2/helpers/esm/setPrototypeOf.js");


function _inherits(subClass, superClass) {
  if (typeof superClass !== "function" && superClass !== null) {
    throw new TypeError("Super expression must either be null or a function");
  }

  subClass.prototype = _core_js_object_create__WEBPACK_IMPORTED_MODULE_0___default()(superClass && superClass.prototype, {
    constructor: {
      value: subClass,
      writable: true,
      configurable: true
    }
  });
  if (superClass) Object(_setPrototypeOf__WEBPACK_IMPORTED_MODULE_1__["default"])(subClass, superClass);
}

/***/ }),

/***/ "../../node_modules/@babel/runtime-corejs2/helpers/esm/iterableToArrayLimit.js":
/*!***********************************************************************************************************************!*\
  !*** /Users/sarakusha/WebstormProjects/@nata/node_modules/@babel/runtime-corejs2/helpers/esm/iterableToArrayLimit.js ***!
  \***********************************************************************************************************************/
/*! exports provided: default */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "default", function() { return _iterableToArrayLimit; });
/* harmony import */ var _core_js_get_iterator__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../../core-js/get-iterator */ "../../node_modules/@babel/runtime-corejs2/core-js/get-iterator.js");
/* harmony import */ var _core_js_get_iterator__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(_core_js_get_iterator__WEBPACK_IMPORTED_MODULE_0__);

function _iterableToArrayLimit(arr, i) {
  var _arr = [];
  var _n = true;
  var _d = false;
  var _e = undefined;

  try {
    for (var _i = _core_js_get_iterator__WEBPACK_IMPORTED_MODULE_0___default()(arr), _s; !(_n = (_s = _i.next()).done); _n = true) {
      _arr.push(_s.value);

      if (i && _arr.length === i) break;
    }
  } catch (err) {
    _d = true;
    _e = err;
  } finally {
    try {
      if (!_n && _i["return"] != null) _i["return"]();
    } finally {
      if (_d) throw _e;
    }
  }

  return _arr;
}

/***/ }),

/***/ "../../node_modules/@babel/runtime-corejs2/helpers/esm/nonIterableRest.js":
/*!******************************************************************************************************************!*\
  !*** /Users/sarakusha/WebstormProjects/@nata/node_modules/@babel/runtime-corejs2/helpers/esm/nonIterableRest.js ***!
  \******************************************************************************************************************/
/*! exports provided: default */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "default", function() { return _nonIterableRest; });
function _nonIterableRest() {
  throw new TypeError("Invalid attempt to destructure non-iterable instance");
}

/***/ }),

/***/ "../../node_modules/@babel/runtime-corejs2/helpers/esm/objectSpread.js":
/*!***************************************************************************************************************!*\
  !*** /Users/sarakusha/WebstormProjects/@nata/node_modules/@babel/runtime-corejs2/helpers/esm/objectSpread.js ***!
  \***************************************************************************************************************/
/*! exports provided: default */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "default", function() { return _objectSpread; });
/* harmony import */ var _core_js_object_get_own_property_descriptor__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../../core-js/object/get-own-property-descriptor */ "../../node_modules/@babel/runtime-corejs2/core-js/object/get-own-property-descriptor.js");
/* harmony import */ var _core_js_object_get_own_property_descriptor__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(_core_js_object_get_own_property_descriptor__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _core_js_object_get_own_property_symbols__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../../core-js/object/get-own-property-symbols */ "../../node_modules/@babel/runtime-corejs2/core-js/object/get-own-property-symbols.js");
/* harmony import */ var _core_js_object_get_own_property_symbols__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(_core_js_object_get_own_property_symbols__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var _core_js_object_keys__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../../core-js/object/keys */ "../../node_modules/@babel/runtime-corejs2/core-js/object/keys.js");
/* harmony import */ var _core_js_object_keys__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(_core_js_object_keys__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var _defineProperty__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./defineProperty */ "../../node_modules/@babel/runtime-corejs2/helpers/esm/defineProperty.js");




function _objectSpread(target) {
  for (var i = 1; i < arguments.length; i++) {
    var source = arguments[i] != null ? arguments[i] : {};

    var ownKeys = _core_js_object_keys__WEBPACK_IMPORTED_MODULE_2___default()(source);

    if (typeof _core_js_object_get_own_property_symbols__WEBPACK_IMPORTED_MODULE_1___default.a === 'function') {
      ownKeys = ownKeys.concat(_core_js_object_get_own_property_symbols__WEBPACK_IMPORTED_MODULE_1___default()(source).filter(function (sym) {
        return _core_js_object_get_own_property_descriptor__WEBPACK_IMPORTED_MODULE_0___default()(source, sym).enumerable;
      }));
    }

    ownKeys.forEach(function (key) {
      Object(_defineProperty__WEBPACK_IMPORTED_MODULE_3__["default"])(target, key, source[key]);
    });
  }

  return target;
}

/***/ }),

/***/ "../../node_modules/@babel/runtime-corejs2/helpers/esm/objectWithoutProperties.js":
/*!**************************************************************************************************************************!*\
  !*** /Users/sarakusha/WebstormProjects/@nata/node_modules/@babel/runtime-corejs2/helpers/esm/objectWithoutProperties.js ***!
  \**************************************************************************************************************************/
/*! exports provided: default */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "default", function() { return _objectWithoutProperties; });
/* harmony import */ var _core_js_object_get_own_property_symbols__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../../core-js/object/get-own-property-symbols */ "../../node_modules/@babel/runtime-corejs2/core-js/object/get-own-property-symbols.js");
/* harmony import */ var _core_js_object_get_own_property_symbols__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(_core_js_object_get_own_property_symbols__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _objectWithoutPropertiesLoose__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./objectWithoutPropertiesLoose */ "../../node_modules/@babel/runtime-corejs2/helpers/esm/objectWithoutPropertiesLoose.js");


function _objectWithoutProperties(source, excluded) {
  if (source == null) return {};
  var target = Object(_objectWithoutPropertiesLoose__WEBPACK_IMPORTED_MODULE_1__["default"])(source, excluded);
  var key, i;

  if (_core_js_object_get_own_property_symbols__WEBPACK_IMPORTED_MODULE_0___default.a) {
    var sourceSymbolKeys = _core_js_object_get_own_property_symbols__WEBPACK_IMPORTED_MODULE_0___default()(source);

    for (i = 0; i < sourceSymbolKeys.length; i++) {
      key = sourceSymbolKeys[i];
      if (excluded.indexOf(key) >= 0) continue;
      if (!Object.prototype.propertyIsEnumerable.call(source, key)) continue;
      target[key] = source[key];
    }
  }

  return target;
}

/***/ }),

/***/ "../../node_modules/@babel/runtime-corejs2/helpers/esm/objectWithoutPropertiesLoose.js":
/*!*******************************************************************************************************************************!*\
  !*** /Users/sarakusha/WebstormProjects/@nata/node_modules/@babel/runtime-corejs2/helpers/esm/objectWithoutPropertiesLoose.js ***!
  \*******************************************************************************************************************************/
/*! exports provided: default */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "default", function() { return _objectWithoutPropertiesLoose; });
/* harmony import */ var _core_js_object_keys__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../../core-js/object/keys */ "../../node_modules/@babel/runtime-corejs2/core-js/object/keys.js");
/* harmony import */ var _core_js_object_keys__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(_core_js_object_keys__WEBPACK_IMPORTED_MODULE_0__);

function _objectWithoutPropertiesLoose(source, excluded) {
  if (source == null) return {};
  var target = {};

  var sourceKeys = _core_js_object_keys__WEBPACK_IMPORTED_MODULE_0___default()(source);

  var key, i;

  for (i = 0; i < sourceKeys.length; i++) {
    key = sourceKeys[i];
    if (excluded.indexOf(key) >= 0) continue;
    target[key] = source[key];
  }

  return target;
}

/***/ }),

/***/ "../../node_modules/@babel/runtime-corejs2/helpers/esm/possibleConstructorReturn.js":
/*!****************************************************************************************************************************!*\
  !*** /Users/sarakusha/WebstormProjects/@nata/node_modules/@babel/runtime-corejs2/helpers/esm/possibleConstructorReturn.js ***!
  \****************************************************************************************************************************/
/*! exports provided: default */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "default", function() { return _possibleConstructorReturn; });
/* harmony import */ var _helpers_esm_typeof__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../../helpers/esm/typeof */ "../../node_modules/@babel/runtime-corejs2/helpers/esm/typeof.js");
/* harmony import */ var _assertThisInitialized__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./assertThisInitialized */ "../../node_modules/@babel/runtime-corejs2/helpers/esm/assertThisInitialized.js");


function _possibleConstructorReturn(self, call) {
  if (call && (Object(_helpers_esm_typeof__WEBPACK_IMPORTED_MODULE_0__["default"])(call) === "object" || typeof call === "function")) {
    return call;
  }

  return Object(_assertThisInitialized__WEBPACK_IMPORTED_MODULE_1__["default"])(self);
}

/***/ }),

/***/ "../../node_modules/@babel/runtime-corejs2/helpers/esm/setPrototypeOf.js":
/*!*****************************************************************************************************************!*\
  !*** /Users/sarakusha/WebstormProjects/@nata/node_modules/@babel/runtime-corejs2/helpers/esm/setPrototypeOf.js ***!
  \*****************************************************************************************************************/
/*! exports provided: default */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "default", function() { return _setPrototypeOf; });
/* harmony import */ var _core_js_object_set_prototype_of__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../../core-js/object/set-prototype-of */ "../../node_modules/@babel/runtime-corejs2/core-js/object/set-prototype-of.js");
/* harmony import */ var _core_js_object_set_prototype_of__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(_core_js_object_set_prototype_of__WEBPACK_IMPORTED_MODULE_0__);

function _setPrototypeOf(o, p) {
  _setPrototypeOf = _core_js_object_set_prototype_of__WEBPACK_IMPORTED_MODULE_0___default.a || function _setPrototypeOf(o, p) {
    o.__proto__ = p;
    return o;
  };

  return _setPrototypeOf(o, p);
}

/***/ }),

/***/ "../../node_modules/@babel/runtime-corejs2/helpers/esm/slicedToArray.js":
/*!****************************************************************************************************************!*\
  !*** /Users/sarakusha/WebstormProjects/@nata/node_modules/@babel/runtime-corejs2/helpers/esm/slicedToArray.js ***!
  \****************************************************************************************************************/
/*! exports provided: default */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "default", function() { return _slicedToArray; });
/* harmony import */ var _arrayWithHoles__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./arrayWithHoles */ "../../node_modules/@babel/runtime-corejs2/helpers/esm/arrayWithHoles.js");
/* harmony import */ var _iterableToArrayLimit__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./iterableToArrayLimit */ "../../node_modules/@babel/runtime-corejs2/helpers/esm/iterableToArrayLimit.js");
/* harmony import */ var _nonIterableRest__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./nonIterableRest */ "../../node_modules/@babel/runtime-corejs2/helpers/esm/nonIterableRest.js");



function _slicedToArray(arr, i) {
  return Object(_arrayWithHoles__WEBPACK_IMPORTED_MODULE_0__["default"])(arr) || Object(_iterableToArrayLimit__WEBPACK_IMPORTED_MODULE_1__["default"])(arr, i) || Object(_nonIterableRest__WEBPACK_IMPORTED_MODULE_2__["default"])();
}

/***/ }),

/***/ "../../node_modules/@babel/runtime-corejs2/helpers/esm/typeof.js":
/*!*********************************************************************************************************!*\
  !*** /Users/sarakusha/WebstormProjects/@nata/node_modules/@babel/runtime-corejs2/helpers/esm/typeof.js ***!
  \*********************************************************************************************************/
/*! exports provided: default */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "default", function() { return _typeof; });
/* harmony import */ var _core_js_symbol_iterator__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../../core-js/symbol/iterator */ "../../node_modules/@babel/runtime-corejs2/core-js/symbol/iterator.js");
/* harmony import */ var _core_js_symbol_iterator__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(_core_js_symbol_iterator__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _core_js_symbol__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../../core-js/symbol */ "../../node_modules/@babel/runtime-corejs2/core-js/symbol.js");
/* harmony import */ var _core_js_symbol__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(_core_js_symbol__WEBPACK_IMPORTED_MODULE_1__);



function _typeof2(obj) { if (typeof _core_js_symbol__WEBPACK_IMPORTED_MODULE_1___default.a === "function" && typeof _core_js_symbol_iterator__WEBPACK_IMPORTED_MODULE_0___default.a === "symbol") { _typeof2 = function _typeof2(obj) { return typeof obj; }; } else { _typeof2 = function _typeof2(obj) { return obj && typeof _core_js_symbol__WEBPACK_IMPORTED_MODULE_1___default.a === "function" && obj.constructor === _core_js_symbol__WEBPACK_IMPORTED_MODULE_1___default.a && obj !== _core_js_symbol__WEBPACK_IMPORTED_MODULE_1___default.a.prototype ? "symbol" : typeof obj; }; } return _typeof2(obj); }

function _typeof(obj) {
  if (typeof _core_js_symbol__WEBPACK_IMPORTED_MODULE_1___default.a === "function" && _typeof2(_core_js_symbol_iterator__WEBPACK_IMPORTED_MODULE_0___default.a) === "symbol") {
    _typeof = function _typeof(obj) {
      return _typeof2(obj);
    };
  } else {
    _typeof = function _typeof(obj) {
      return obj && typeof _core_js_symbol__WEBPACK_IMPORTED_MODULE_1___default.a === "function" && obj.constructor === _core_js_symbol__WEBPACK_IMPORTED_MODULE_1___default.a && obj !== _core_js_symbol__WEBPACK_IMPORTED_MODULE_1___default.a.prototype ? "symbol" : _typeof2(obj);
    };
  }

  return _typeof(obj);
}

/***/ }),

/***/ "../../node_modules/string-hash/index.js":
/*!*********************************************************************************!*\
  !*** /Users/sarakusha/WebstormProjects/@nata/node_modules/string-hash/index.js ***!
  \*********************************************************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


function hash(str) {
  var hash = 5381,
      i    = str.length;

  while(i) {
    hash = (hash * 33) ^ str.charCodeAt(--i);
  }

  /* JavaScript does bitwise operations (like XOR, above) on 32-bit signed
   * integers. Since we want the results to be always positive, convert the
   * signed int to an unsigned by doing an unsigned bitshift. */
  return hash >>> 0;
}

module.exports = hash;


/***/ }),

/***/ "../../node_modules/styled-jsx/dist/lib/stylesheet.js":
/*!**********************************************************************************************!*\
  !*** /Users/sarakusha/WebstormProjects/@nata/node_modules/styled-jsx/dist/lib/stylesheet.js ***!
  \**********************************************************************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } }

function _createClass(Constructor, protoProps, staticProps) { if (protoProps) _defineProperties(Constructor.prototype, protoProps); if (staticProps) _defineProperties(Constructor, staticProps); return Constructor; }

/*
Based on Glamor's sheet
https://github.com/threepointone/glamor/blob/667b480d31b3721a905021b26e1290ce92ca2879/src/sheet.js
*/
var isProd = process.env && "development" === 'production';

var isString = function isString(o) {
  return Object.prototype.toString.call(o) === '[object String]';
};

var StyleSheet =
/*#__PURE__*/
function () {
  function StyleSheet() {
    var _ref = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {},
        _ref$name = _ref.name,
        name = _ref$name === void 0 ? 'stylesheet' : _ref$name,
        _ref$optimizeForSpeed = _ref.optimizeForSpeed,
        optimizeForSpeed = _ref$optimizeForSpeed === void 0 ? isProd : _ref$optimizeForSpeed,
        _ref$isBrowser = _ref.isBrowser,
        isBrowser = _ref$isBrowser === void 0 ? typeof window !== 'undefined' : _ref$isBrowser;

    _classCallCheck(this, StyleSheet);

    invariant(isString(name), '`name` must be a string');
    this._name = name;
    this._deletedRulePlaceholder = "#".concat(name, "-deleted-rule____{}");
    invariant(typeof optimizeForSpeed === 'boolean', '`optimizeForSpeed` must be a boolean');
    this._optimizeForSpeed = optimizeForSpeed;
    this._isBrowser = isBrowser;
    this._serverSheet = undefined;
    this._tags = [];
    this._injected = false;
    this._rulesCount = 0;
    var node = this._isBrowser && document.querySelector('meta[property="csp-nonce"]');
    this._nonce = node ? node.getAttribute('content') : null;
  }

  _createClass(StyleSheet, [{
    key: "setOptimizeForSpeed",
    value: function setOptimizeForSpeed(bool) {
      invariant(typeof bool === 'boolean', '`setOptimizeForSpeed` accepts a boolean');
      invariant(this._rulesCount === 0, 'optimizeForSpeed cannot be when rules have already been inserted');
      this.flush();
      this._optimizeForSpeed = bool;
      this.inject();
    }
  }, {
    key: "isOptimizeForSpeed",
    value: function isOptimizeForSpeed() {
      return this._optimizeForSpeed;
    }
  }, {
    key: "inject",
    value: function inject() {
      var _this = this;

      invariant(!this._injected, 'sheet already injected');
      this._injected = true;

      if (this._isBrowser && this._optimizeForSpeed) {
        this._tags[0] = this.makeStyleTag(this._name);
        this._optimizeForSpeed = 'insertRule' in this.getSheet();

        if (!this._optimizeForSpeed) {
          if (!isProd) {
            console.warn('StyleSheet: optimizeForSpeed mode not supported falling back to standard mode.');
          }

          this.flush();
          this._injected = true;
        }

        return;
      }

      this._serverSheet = {
        cssRules: [],
        insertRule: function insertRule(rule, index) {
          if (typeof index === 'number') {
            _this._serverSheet.cssRules[index] = {
              cssText: rule
            };
          } else {
            _this._serverSheet.cssRules.push({
              cssText: rule
            });
          }

          return index;
        },
        deleteRule: function deleteRule(index) {
          _this._serverSheet.cssRules[index] = null;
        }
      };
    }
  }, {
    key: "getSheetForTag",
    value: function getSheetForTag(tag) {
      if (tag.sheet) {
        return tag.sheet;
      } // this weirdness brought to you by firefox


      for (var i = 0; i < document.styleSheets.length; i++) {
        if (document.styleSheets[i].ownerNode === tag) {
          return document.styleSheets[i];
        }
      }
    }
  }, {
    key: "getSheet",
    value: function getSheet() {
      return this.getSheetForTag(this._tags[this._tags.length - 1]);
    }
  }, {
    key: "insertRule",
    value: function insertRule(rule, index) {
      invariant(isString(rule), '`insertRule` accepts only strings');

      if (!this._isBrowser) {
        if (typeof index !== 'number') {
          index = this._serverSheet.cssRules.length;
        }

        this._serverSheet.insertRule(rule, index);

        return this._rulesCount++;
      }

      if (this._optimizeForSpeed) {
        var sheet = this.getSheet();

        if (typeof index !== 'number') {
          index = sheet.cssRules.length;
        } // this weirdness for perf, and chrome's weird bug
        // https://stackoverflow.com/questions/20007992/chrome-suddenly-stopped-accepting-insertrule


        try {
          sheet.insertRule(rule, index);
        } catch (error) {
          if (!isProd) {
            console.warn("StyleSheet: illegal rule: \n\n".concat(rule, "\n\nSee https://stackoverflow.com/q/20007992 for more info"));
          }

          return -1;
        }
      } else {
        var insertionPoint = this._tags[index];

        this._tags.push(this.makeStyleTag(this._name, rule, insertionPoint));
      }

      return this._rulesCount++;
    }
  }, {
    key: "replaceRule",
    value: function replaceRule(index, rule) {
      if (this._optimizeForSpeed || !this._isBrowser) {
        var sheet = this._isBrowser ? this.getSheet() : this._serverSheet;

        if (!rule.trim()) {
          rule = this._deletedRulePlaceholder;
        }

        if (!sheet.cssRules[index]) {
          // @TBD Should we throw an error?
          return index;
        }

        sheet.deleteRule(index);

        try {
          sheet.insertRule(rule, index);
        } catch (error) {
          if (!isProd) {
            console.warn("StyleSheet: illegal rule: \n\n".concat(rule, "\n\nSee https://stackoverflow.com/q/20007992 for more info"));
          } // In order to preserve the indices we insert a deleteRulePlaceholder


          sheet.insertRule(this._deletedRulePlaceholder, index);
        }
      } else {
        var tag = this._tags[index];
        invariant(tag, "old rule at index `".concat(index, "` not found"));
        tag.textContent = rule;
      }

      return index;
    }
  }, {
    key: "deleteRule",
    value: function deleteRule(index) {
      if (!this._isBrowser) {
        this._serverSheet.deleteRule(index);

        return;
      }

      if (this._optimizeForSpeed) {
        this.replaceRule(index, '');
      } else {
        var tag = this._tags[index];
        invariant(tag, "rule at index `".concat(index, "` not found"));
        tag.parentNode.removeChild(tag);
        this._tags[index] = null;
      }
    }
  }, {
    key: "flush",
    value: function flush() {
      this._injected = false;
      this._rulesCount = 0;

      if (this._isBrowser) {
        this._tags.forEach(function (tag) {
          return tag && tag.parentNode.removeChild(tag);
        });

        this._tags = [];
      } else {
        // simpler on server
        this._serverSheet.cssRules = [];
      }
    }
  }, {
    key: "cssRules",
    value: function cssRules() {
      var _this2 = this;

      if (!this._isBrowser) {
        return this._serverSheet.cssRules;
      }

      return this._tags.reduce(function (rules, tag) {
        if (tag) {
          rules = rules.concat(_this2.getSheetForTag(tag).cssRules.map(function (rule) {
            return rule.cssText === _this2._deletedRulePlaceholder ? null : rule;
          }));
        } else {
          rules.push(null);
        }

        return rules;
      }, []);
    }
  }, {
    key: "makeStyleTag",
    value: function makeStyleTag(name, cssString, relativeToTag) {
      if (cssString) {
        invariant(isString(cssString), 'makeStyleTag acceps only strings as second parameter');
      }

      var tag = document.createElement('style');
      if (this._nonce) tag.setAttribute('nonce', this._nonce);
      tag.type = 'text/css';
      tag.setAttribute("data-".concat(name), '');

      if (cssString) {
        tag.appendChild(document.createTextNode(cssString));
      }

      var head = document.head || document.getElementsByTagName('head')[0];

      if (relativeToTag) {
        head.insertBefore(tag, relativeToTag);
      } else {
        head.appendChild(tag);
      }

      return tag;
    }
  }, {
    key: "length",
    get: function get() {
      return this._rulesCount;
    }
  }]);

  return StyleSheet;
}();

exports.default = StyleSheet;

function invariant(condition, message) {
  if (!condition) {
    throw new Error("StyleSheet: ".concat(message, "."));
  }
}

/***/ }),

/***/ "../../node_modules/styled-jsx/dist/style.js":
/*!*************************************************************************************!*\
  !*** /Users/sarakusha/WebstormProjects/@nata/node_modules/styled-jsx/dist/style.js ***!
  \*************************************************************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.flush = flush;
exports.default = void 0;

var _react = __webpack_require__(/*! react */ "react");

var _stylesheetRegistry = _interopRequireDefault(__webpack_require__(/*! ./stylesheet-registry */ "../../node_modules/styled-jsx/dist/stylesheet-registry.js"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _typeof(obj) { if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") { _typeof = function _typeof(obj) { return typeof obj; }; } else { _typeof = function _typeof(obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }; } return _typeof(obj); }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } }

function _createClass(Constructor, protoProps, staticProps) { if (protoProps) _defineProperties(Constructor.prototype, protoProps); if (staticProps) _defineProperties(Constructor, staticProps); return Constructor; }

function _possibleConstructorReturn(self, call) { if (call && (_typeof(call) === "object" || typeof call === "function")) { return call; } return _assertThisInitialized(self); }

function _assertThisInitialized(self) { if (self === void 0) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return self; }

function _getPrototypeOf(o) { _getPrototypeOf = Object.setPrototypeOf ? Object.getPrototypeOf : function _getPrototypeOf(o) { return o.__proto__ || Object.getPrototypeOf(o); }; return _getPrototypeOf(o); }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function"); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, writable: true, configurable: true } }); if (superClass) _setPrototypeOf(subClass, superClass); }

function _setPrototypeOf(o, p) { _setPrototypeOf = Object.setPrototypeOf || function _setPrototypeOf(o, p) { o.__proto__ = p; return o; }; return _setPrototypeOf(o, p); }

var styleSheetRegistry = new _stylesheetRegistry.default();

var JSXStyle =
/*#__PURE__*/
function (_Component) {
  _inherits(JSXStyle, _Component);

  function JSXStyle(props) {
    var _this;

    _classCallCheck(this, JSXStyle);

    _this = _possibleConstructorReturn(this, _getPrototypeOf(JSXStyle).call(this, props));
    _this.prevProps = {};
    return _this;
  }

  _createClass(JSXStyle, [{
    key: "shouldComponentUpdate",
    // probably faster than PureComponent (shallowEqual)
    value: function shouldComponentUpdate(otherProps) {
      return this.props.id !== otherProps.id || // We do this check because `dynamic` is an array of strings or undefined.
      // These are the computed values for dynamic styles.
      String(this.props.dynamic) !== String(otherProps.dynamic);
    }
  }, {
    key: "componentWillUnmount",
    value: function componentWillUnmount() {
      styleSheetRegistry.remove(this.props);
    }
  }, {
    key: "render",
    value: function render() {
      // This is a workaround to make the side effect async safe in the "render" phase.
      // See https://github.com/zeit/styled-jsx/pull/484
      if (this.shouldComponentUpdate(this.prevProps)) {
        // Updates
        if (this.prevProps.id) {
          styleSheetRegistry.remove(this.prevProps);
        }

        styleSheetRegistry.add(this.props);
        this.prevProps = this.props;
      }

      return null;
    }
  }], [{
    key: "dynamic",
    value: function dynamic(info) {
      return info.map(function (tagInfo) {
        var baseId = tagInfo[0];
        var props = tagInfo[1];
        return styleSheetRegistry.computeId(baseId, props);
      }).join(' ');
    }
  }]);

  return JSXStyle;
}(_react.Component);

exports.default = JSXStyle;

function flush() {
  var cssRules = styleSheetRegistry.cssRules();
  styleSheetRegistry.flush();
  return cssRules;
}

/***/ }),

/***/ "../../node_modules/styled-jsx/dist/stylesheet-registry.js":
/*!***************************************************************************************************!*\
  !*** /Users/sarakusha/WebstormProjects/@nata/node_modules/styled-jsx/dist/stylesheet-registry.js ***!
  \***************************************************************************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _stringHash = _interopRequireDefault(__webpack_require__(/*! string-hash */ "../../node_modules/string-hash/index.js"));

var _stylesheet = _interopRequireDefault(__webpack_require__(/*! ./lib/stylesheet */ "../../node_modules/styled-jsx/dist/lib/stylesheet.js"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } }

function _createClass(Constructor, protoProps, staticProps) { if (protoProps) _defineProperties(Constructor.prototype, protoProps); if (staticProps) _defineProperties(Constructor, staticProps); return Constructor; }

var sanitize = function sanitize(rule) {
  return rule.replace(/\/style/gi, '\\/style');
};

var StyleSheetRegistry =
/*#__PURE__*/
function () {
  function StyleSheetRegistry() {
    var _ref = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {},
        _ref$styleSheet = _ref.styleSheet,
        styleSheet = _ref$styleSheet === void 0 ? null : _ref$styleSheet,
        _ref$optimizeForSpeed = _ref.optimizeForSpeed,
        optimizeForSpeed = _ref$optimizeForSpeed === void 0 ? false : _ref$optimizeForSpeed,
        _ref$isBrowser = _ref.isBrowser,
        isBrowser = _ref$isBrowser === void 0 ? typeof window !== 'undefined' : _ref$isBrowser;

    _classCallCheck(this, StyleSheetRegistry);

    this._sheet = styleSheet || new _stylesheet.default({
      name: 'styled-jsx',
      optimizeForSpeed: optimizeForSpeed
    });

    this._sheet.inject();

    if (styleSheet && typeof optimizeForSpeed === 'boolean') {
      this._sheet.setOptimizeForSpeed(optimizeForSpeed);

      this._optimizeForSpeed = this._sheet.isOptimizeForSpeed();
    }

    this._isBrowser = isBrowser;
    this._fromServer = undefined;
    this._indices = {};
    this._instancesCounts = {};
    this.computeId = this.createComputeId();
    this.computeSelector = this.createComputeSelector();
  }

  _createClass(StyleSheetRegistry, [{
    key: "add",
    value: function add(props) {
      var _this = this;

      if (undefined === this._optimizeForSpeed) {
        this._optimizeForSpeed = Array.isArray(props.children);

        this._sheet.setOptimizeForSpeed(this._optimizeForSpeed);

        this._optimizeForSpeed = this._sheet.isOptimizeForSpeed();
      }

      if (this._isBrowser && !this._fromServer) {
        this._fromServer = this.selectFromServer();
        this._instancesCounts = Object.keys(this._fromServer).reduce(function (acc, tagName) {
          acc[tagName] = 0;
          return acc;
        }, {});
      }

      var _this$getIdAndRules = this.getIdAndRules(props),
          styleId = _this$getIdAndRules.styleId,
          rules = _this$getIdAndRules.rules; // Deduping: just increase the instances count.


      if (styleId in this._instancesCounts) {
        this._instancesCounts[styleId] += 1;
        return;
      }

      var indices = rules.map(function (rule) {
        return _this._sheet.insertRule(rule);
      }) // Filter out invalid rules
      .filter(function (index) {
        return index !== -1;
      });
      this._indices[styleId] = indices;
      this._instancesCounts[styleId] = 1;
    }
  }, {
    key: "remove",
    value: function remove(props) {
      var _this2 = this;

      var _this$getIdAndRules2 = this.getIdAndRules(props),
          styleId = _this$getIdAndRules2.styleId;

      invariant(styleId in this._instancesCounts, "styleId: `".concat(styleId, "` not found"));
      this._instancesCounts[styleId] -= 1;

      if (this._instancesCounts[styleId] < 1) {
        var tagFromServer = this._fromServer && this._fromServer[styleId];

        if (tagFromServer) {
          tagFromServer.parentNode.removeChild(tagFromServer);
          delete this._fromServer[styleId];
        } else {
          this._indices[styleId].forEach(function (index) {
            return _this2._sheet.deleteRule(index);
          });

          delete this._indices[styleId];
        }

        delete this._instancesCounts[styleId];
      }
    }
  }, {
    key: "update",
    value: function update(props, nextProps) {
      this.add(nextProps);
      this.remove(props);
    }
  }, {
    key: "flush",
    value: function flush() {
      this._sheet.flush();

      this._sheet.inject();

      this._fromServer = undefined;
      this._indices = {};
      this._instancesCounts = {};
      this.computeId = this.createComputeId();
      this.computeSelector = this.createComputeSelector();
    }
  }, {
    key: "cssRules",
    value: function cssRules() {
      var _this3 = this;

      var fromServer = this._fromServer ? Object.keys(this._fromServer).map(function (styleId) {
        return [styleId, _this3._fromServer[styleId]];
      }) : [];

      var cssRules = this._sheet.cssRules();

      return fromServer.concat(Object.keys(this._indices).map(function (styleId) {
        return [styleId, _this3._indices[styleId].map(function (index) {
          return cssRules[index].cssText;
        }).join(_this3._optimizeForSpeed ? '' : '\n')];
      }) // filter out empty rules
      .filter(function (rule) {
        return Boolean(rule[1]);
      }));
    }
    /**
     * createComputeId
     *
     * Creates a function to compute and memoize a jsx id from a basedId and optionally props.
     */

  }, {
    key: "createComputeId",
    value: function createComputeId() {
      var cache = {};
      return function (baseId, props) {
        if (!props) {
          return "jsx-".concat(baseId);
        }

        var propsToString = String(props);
        var key = baseId + propsToString; // return `jsx-${hashString(`${baseId}-${propsToString}`)}`

        if (!cache[key]) {
          cache[key] = "jsx-".concat((0, _stringHash.default)("".concat(baseId, "-").concat(propsToString)));
        }

        return cache[key];
      };
    }
    /**
     * createComputeSelector
     *
     * Creates a function to compute and memoize dynamic selectors.
     */

  }, {
    key: "createComputeSelector",
    value: function createComputeSelector() {
      var selectoPlaceholderRegexp = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : /__jsx-style-dynamic-selector/g;
      var cache = {};
      return function (id, css) {
        // Sanitize SSR-ed CSS.
        // Client side code doesn't need to be sanitized since we use
        // document.createTextNode (dev) and the CSSOM api sheet.insertRule (prod).
        if (!this._isBrowser) {
          css = sanitize(css);
        }

        var idcss = id + css;

        if (!cache[idcss]) {
          cache[idcss] = css.replace(selectoPlaceholderRegexp, id);
        }

        return cache[idcss];
      };
    }
  }, {
    key: "getIdAndRules",
    value: function getIdAndRules(props) {
      var _this4 = this;

      var css = props.children,
          dynamic = props.dynamic,
          id = props.id;

      if (dynamic) {
        var styleId = this.computeId(id, dynamic);
        return {
          styleId: styleId,
          rules: Array.isArray(css) ? css.map(function (rule) {
            return _this4.computeSelector(styleId, rule);
          }) : [this.computeSelector(styleId, css)]
        };
      }

      return {
        styleId: this.computeId(id),
        rules: Array.isArray(css) ? css : [css]
      };
    }
    /**
     * selectFromServer
     *
     * Collects style tags from the document with id __jsx-XXX
     */

  }, {
    key: "selectFromServer",
    value: function selectFromServer() {
      var elements = Array.prototype.slice.call(document.querySelectorAll('[id^="__jsx-"]'));
      return elements.reduce(function (acc, element) {
        var id = element.id.slice(2);
        acc[id] = element;
        return acc;
      }, {});
    }
  }]);

  return StyleSheetRegistry;
}();

exports.default = StyleSheetRegistry;

function invariant(condition, message) {
  if (!condition) {
    throw new Error("StyleSheetRegistry: ".concat(message, "."));
  }
}

/***/ }),

/***/ "../../node_modules/styled-jsx/style.js":
/*!********************************************************************************!*\
  !*** /Users/sarakusha/WebstormProjects/@nata/node_modules/styled-jsx/style.js ***!
  \********************************************************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

module.exports = __webpack_require__(/*! ./dist/style */ "../../node_modules/styled-jsx/dist/style.js")


/***/ }),

/***/ "./components/ColorPickerField.tsx":
/*!*****************************************!*\
  !*** ./components/ColorPickerField.tsx ***!
  \*****************************************/
/*! exports provided: default */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony import */ var _babel_runtime_corejs2_helpers_esm_extends__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime-corejs2/helpers/esm/extends */ "../../node_modules/@babel/runtime-corejs2/helpers/esm/extends.js");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "react");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(react__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var formik_material_ui__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! formik-material-ui */ "formik-material-ui");
/* harmony import */ var formik_material_ui__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(formik_material_ui__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var material_ui_color_picker__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! material-ui-color-picker */ "material-ui-color-picker");
/* harmony import */ var material_ui_color_picker__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(material_ui_color_picker__WEBPACK_IMPORTED_MODULE_3__);

var _jsxFileName = "/Users/sarakusha/WebstormProjects/@nata/packages/stela/components/ColorPickerField.tsx";




var ColorPickerField = function ColorPickerField(props) {
  var setFieldValue = props.form.setFieldValue,
      _props$field = props.field,
      name = _props$field.name,
      value = _props$field.value;
  var changed = react__WEBPACK_IMPORTED_MODULE_1___default.a.useCallback(function (color) {
    setFieldValue(name, color || '#fff');
  }, [setFieldValue, name]);
  var textFieldProps = react__WEBPACK_IMPORTED_MODULE_1___default.a.useMemo(function () {
    return {
      autoComplete: 'off',
      InputProps: {
        disableUnderline: true,
        style: {
          backgroundColor: 'black',
          borderRadius: 8,
          color: value,
          paddingLeft: 5,
          width: '12ch'
        }
      }
    };
  }, [value]);
  return react__WEBPACK_IMPORTED_MODULE_1___default.a.createElement(material_ui_color_picker__WEBPACK_IMPORTED_MODULE_3___default.a, Object(_babel_runtime_corejs2_helpers_esm_extends__WEBPACK_IMPORTED_MODULE_0__["default"])({}, Object(formik_material_ui__WEBPACK_IMPORTED_MODULE_2__["fieldToTextField"])(props), {
    TextFieldProps: textFieldProps,
    onChange: changed,
    __source: {
      fileName: _jsxFileName,
      lineNumber: 30
    },
    __self: this
  }));
};

/* harmony default export */ __webpack_exports__["default"] = (react__WEBPACK_IMPORTED_MODULE_1___default.a.memo(ColorPickerField));

/***/ }),

/***/ "./components/CurrencyField.tsx":
/*!**************************************!*\
  !*** ./components/CurrencyField.tsx ***!
  \**************************************/
/*! exports provided: default */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony import */ var _babel_runtime_corejs2_helpers_esm_extends__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime-corejs2/helpers/esm/extends */ "../../node_modules/@babel/runtime-corejs2/helpers/esm/extends.js");
/* harmony import */ var _babel_runtime_corejs2_core_js_number_is_nan__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @babel/runtime-corejs2/core-js/number/is-nan */ "../../node_modules/@babel/runtime-corejs2/core-js/number/is-nan.js");
/* harmony import */ var _babel_runtime_corejs2_core_js_number_is_nan__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(_babel_runtime_corejs2_core_js_number_is_nan__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react */ "react");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(react__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var _material_ui_core_TextField__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! @material-ui/core/TextField */ "@material-ui/core/TextField");
/* harmony import */ var _material_ui_core_TextField__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(_material_ui_core_TextField__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var formik_material_ui__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! formik-material-ui */ "formik-material-ui");
/* harmony import */ var formik_material_ui__WEBPACK_IMPORTED_MODULE_4___default = /*#__PURE__*/__webpack_require__.n(formik_material_ui__WEBPACK_IMPORTED_MODULE_4__);


var _jsxFileName = "/Users/sarakusha/WebstormProjects/@nata/packages/stela/components/CurrencyField.tsx";



var inputProps = {
  step: 0.1,
  min: 0.1,
  style: {
    textAlign: 'right'
  }
};

var CurrencyField = function CurrencyField(props) {
  var setFieldValue = props.form.setFieldValue,
      name = props.field.name,
      error = props.error;
  var format = Object(react__WEBPACK_IMPORTED_MODULE_2__["useCallback"])(function (_ref) {
    var value = _ref.target.value;
    var numValue = Number(value);
    setFieldValue(name, _babel_runtime_corejs2_core_js_number_is_nan__WEBPACK_IMPORTED_MODULE_1___default()(numValue) || value.trim().length === 0 ? value : numValue.toFixed(2));
  }, [setFieldValue, name]);
  return react__WEBPACK_IMPORTED_MODULE_2___default.a.createElement(_material_ui_core_TextField__WEBPACK_IMPORTED_MODULE_3___default.a, Object(_babel_runtime_corejs2_helpers_esm_extends__WEBPACK_IMPORTED_MODULE_0__["default"])({}, Object(formik_material_ui__WEBPACK_IMPORTED_MODULE_4__["fieldToTextField"])(props), {
    onBlur: format,
    type: 'number',
    error: !!error,
    helperText: error,
    inputProps: inputProps,
    __source: {
      fileName: _jsxFileName,
      lineNumber: 29
    },
    __self: this
  }));
};

/* harmony default export */ __webpack_exports__["default"] = (react__WEBPACK_IMPORTED_MODULE_2___default.a.memo(CurrencyField));

/***/ }),

/***/ "./components/FormFieldSet.tsx":
/*!*************************************!*\
  !*** ./components/FormFieldSet.tsx ***!
  \*************************************/
/*! exports provided: FormLegend, default */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "FormLegend", function() { return FormLegend; });
/* harmony import */ var _babel_runtime_corejs2_helpers_esm_objectWithoutProperties__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime-corejs2/helpers/esm/objectWithoutProperties */ "../../node_modules/@babel/runtime-corejs2/helpers/esm/objectWithoutProperties.js");
/* harmony import */ var _babel_runtime_corejs2_helpers_esm_extends__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @babel/runtime-corejs2/helpers/esm/extends */ "../../node_modules/@babel/runtime-corejs2/helpers/esm/extends.js");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react */ "react");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(react__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var _material_ui_core_FormControl__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! @material-ui/core/FormControl */ "@material-ui/core/FormControl");
/* harmony import */ var _material_ui_core_FormControl__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(_material_ui_core_FormControl__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var _material_ui_core_FormLabel__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! @material-ui/core/FormLabel */ "@material-ui/core/FormLabel");
/* harmony import */ var _material_ui_core_FormLabel__WEBPACK_IMPORTED_MODULE_4___default = /*#__PURE__*/__webpack_require__.n(_material_ui_core_FormLabel__WEBPACK_IMPORTED_MODULE_4__);


var _jsxFileName = "/Users/sarakusha/WebstormProjects/@nata/packages/stela/components/FormFieldSet.tsx";



var FormLegend = function FormLegend(props) {
  return react__WEBPACK_IMPORTED_MODULE_2___default.a.createElement(_material_ui_core_FormLabel__WEBPACK_IMPORTED_MODULE_4___default.a, Object(_babel_runtime_corejs2_helpers_esm_extends__WEBPACK_IMPORTED_MODULE_1__["default"])({}, props, {
    component: 'legend',
    __source: {
      fileName: _jsxFileName,
      lineNumber: 12
    },
    __self: this
  }));
};

var FormFieldSet = function FormFieldSet(_ref) {
  var legend = _ref.legend,
      children = _ref.children,
      title = _ref.title,
      props = Object(_babel_runtime_corejs2_helpers_esm_objectWithoutProperties__WEBPACK_IMPORTED_MODULE_0__["default"])(_ref, ["legend", "children", "title"]);

  return react__WEBPACK_IMPORTED_MODULE_2___default.a.createElement(_material_ui_core_FormControl__WEBPACK_IMPORTED_MODULE_3___default.a, Object(_babel_runtime_corejs2_helpers_esm_extends__WEBPACK_IMPORTED_MODULE_1__["default"])({
    component: 'fieldset'
  }, props, {
    title: title || legend,
    __source: {
      fileName: _jsxFileName,
      lineNumber: 15
    },
    __self: this
  }), legend && react__WEBPACK_IMPORTED_MODULE_2___default.a.createElement(FormLegend, {
    __source: {
      fileName: _jsxFileName,
      lineNumber: 16
    },
    __self: this
  }, legend), children);
};

/* harmony default export */ __webpack_exports__["default"] = (FormFieldSet);

/***/ }),

/***/ "./components/LockToolbar.tsx":
/*!************************************!*\
  !*** ./components/LockToolbar.tsx ***!
  \************************************/
/*! exports provided: default */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony import */ var _babel_runtime_corejs2_helpers_esm_extends__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime-corejs2/helpers/esm/extends */ "../../node_modules/@babel/runtime-corejs2/helpers/esm/extends.js");
/* harmony import */ var _babel_runtime_corejs2_helpers_esm_objectWithoutProperties__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @babel/runtime-corejs2/helpers/esm/objectWithoutProperties */ "../../node_modules/@babel/runtime-corejs2/helpers/esm/objectWithoutProperties.js");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react */ "react");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(react__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var _material_ui_core_Typography__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! @material-ui/core/Typography */ "@material-ui/core/Typography");
/* harmony import */ var _material_ui_core_Typography__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(_material_ui_core_Typography__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var _material_ui_core_styles__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! @material-ui/core/styles */ "@material-ui/core/styles");
/* harmony import */ var _material_ui_core_styles__WEBPACK_IMPORTED_MODULE_4___default = /*#__PURE__*/__webpack_require__.n(_material_ui_core_styles__WEBPACK_IMPORTED_MODULE_4__);
/* harmony import */ var _material_ui_core_IconButton__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! @material-ui/core/IconButton */ "@material-ui/core/IconButton");
/* harmony import */ var _material_ui_core_IconButton__WEBPACK_IMPORTED_MODULE_5___default = /*#__PURE__*/__webpack_require__.n(_material_ui_core_IconButton__WEBPACK_IMPORTED_MODULE_5__);
/* harmony import */ var _material_ui_icons_Lock__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! @material-ui/icons/Lock */ "@material-ui/icons/Lock");
/* harmony import */ var _material_ui_icons_Lock__WEBPACK_IMPORTED_MODULE_6___default = /*#__PURE__*/__webpack_require__.n(_material_ui_icons_Lock__WEBPACK_IMPORTED_MODULE_6__);
/* harmony import */ var _material_ui_icons_LockOpen__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! @material-ui/icons/LockOpen */ "@material-ui/icons/LockOpen");
/* harmony import */ var _material_ui_icons_LockOpen__WEBPACK_IMPORTED_MODULE_7___default = /*#__PURE__*/__webpack_require__.n(_material_ui_icons_LockOpen__WEBPACK_IMPORTED_MODULE_7__);
/* harmony import */ var _material_ui_core_Fab__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! @material-ui/core/Fab */ "@material-ui/core/Fab");
/* harmony import */ var _material_ui_core_Fab__WEBPACK_IMPORTED_MODULE_8___default = /*#__PURE__*/__webpack_require__.n(_material_ui_core_Fab__WEBPACK_IMPORTED_MODULE_8__);
/* harmony import */ var _material_ui_icons_Add__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! @material-ui/icons/Add */ "@material-ui/icons/Add");
/* harmony import */ var _material_ui_icons_Add__WEBPACK_IMPORTED_MODULE_9___default = /*#__PURE__*/__webpack_require__.n(_material_ui_icons_Add__WEBPACK_IMPORTED_MODULE_9__);
/* harmony import */ var recompose__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! recompose */ "recompose");
/* harmony import */ var recompose__WEBPACK_IMPORTED_MODULE_10___default = /*#__PURE__*/__webpack_require__.n(recompose__WEBPACK_IMPORTED_MODULE_10__);


var _jsxFileName = "/Users/sarakusha/WebstormProjects/@nata/packages/stela/components/LockToolbar.tsx";










var styles = function styles(theme) {
  return Object(_material_ui_core_styles__WEBPACK_IMPORTED_MODULE_4__["createStyles"])({
    heading: {
      // fontSize: theme.typography.pxToRem(15),
      // fontWeight: theme.typography.fontWeightRegular,
      flexGrow: 1
    },
    root: {
      display: 'flex',
      width: '100%',
      alignItems: 'center'
    },
    margin: {
      marginLeft: theme.spacing.unit,
      marginRight: theme.spacing.unit
    }
  });
};

var LockToolbar = function LockToolbar(_ref) {
  var title = _ref.title,
      classes = _ref.classes,
      checked = _ref.checked,
      onChange = _ref.onChange,
      onAdd = _ref.onAdd,
      props = Object(_babel_runtime_corejs2_helpers_esm_objectWithoutProperties__WEBPACK_IMPORTED_MODULE_1__["default"])(_ref, ["title", "classes", "checked", "onChange", "onAdd"]);

  var handleChange = Object(react__WEBPACK_IMPORTED_MODULE_2__["useCallback"])(function (e) {
    onChange && onChange(e.target, !checked);
    e.stopPropagation();
  }, [onChange]);
  var handleAdd = Object(react__WEBPACK_IMPORTED_MODULE_2__["useCallback"])(function (e) {
    onAdd && onAdd();
    e.stopPropagation();
  }, [onAdd]);
  return react__WEBPACK_IMPORTED_MODULE_2___default.a.createElement("div", {
    className: classes.root,
    __source: {
      fileName: _jsxFileName,
      lineNumber: 58
    },
    __self: this
  }, react__WEBPACK_IMPORTED_MODULE_2___default.a.createElement(_material_ui_core_Typography__WEBPACK_IMPORTED_MODULE_3___default.a, {
    variant: 'h6',
    className: classes.heading,
    __source: {
      fileName: _jsxFileName,
      lineNumber: 59
    },
    __self: this
  }, title), react__WEBPACK_IMPORTED_MODULE_2___default.a.createElement(_material_ui_core_IconButton__WEBPACK_IMPORTED_MODULE_5___default.a, Object(_babel_runtime_corejs2_helpers_esm_extends__WEBPACK_IMPORTED_MODULE_0__["default"])({
    onClick: handleChange,
    title: "\u0418\u0437\u043C\u0435\u043D\u0438\u0442\u044C \u043D\u0430\u0441\u0442\u0440\u043E\u0439\u043A\u0438"
  }, props, {
    className: classes.margin,
    color: "primary",
    __source: {
      fileName: _jsxFileName,
      lineNumber: 60
    },
    __self: this
  }), checked ? react__WEBPACK_IMPORTED_MODULE_2___default.a.createElement(_material_ui_icons_Lock__WEBPACK_IMPORTED_MODULE_6___default.a, {
    __source: {
      fileName: _jsxFileName,
      lineNumber: 67
    },
    __self: this
  }) : react__WEBPACK_IMPORTED_MODULE_2___default.a.createElement(_material_ui_icons_LockOpen__WEBPACK_IMPORTED_MODULE_7___default.a, {
    __source: {
      fileName: _jsxFileName,
      lineNumber: 67
    },
    __self: this
  })), react__WEBPACK_IMPORTED_MODULE_2___default.a.createElement(_material_ui_core_Fab__WEBPACK_IMPORTED_MODULE_8___default.a, {
    color: 'secondary',
    "aria-label": 'Add',
    size: 'medium',
    disabled: checked,
    className: classes.margin,
    onClick: handleAdd,
    title: "\u0414\u043E\u0431\u0430\u0432\u0438\u0442\u044C \u043F\u043E\u0437\u0438\u0446\u0438\u044E",
    __source: {
      fileName: _jsxFileName,
      lineNumber: 69
    },
    __self: this
  }, react__WEBPACK_IMPORTED_MODULE_2___default.a.createElement(_material_ui_icons_Add__WEBPACK_IMPORTED_MODULE_9___default.a, {
    __source: {
      fileName: _jsxFileName,
      lineNumber: 78
    },
    __self: this
  })));
};

/* harmony default export */ __webpack_exports__["default"] = (Object(recompose__WEBPACK_IMPORTED_MODULE_10__["compose"])(react__WEBPACK_IMPORTED_MODULE_2___default.a.memo, Object(_material_ui_core_styles__WEBPACK_IMPORTED_MODULE_4__["withStyles"])(styles))(LockToolbar));

/***/ }),

/***/ "./components/Section.tsx":
/*!********************************!*\
  !*** ./components/Section.tsx ***!
  \********************************/
/*! exports provided: default */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony import */ var _babel_runtime_corejs2_helpers_esm_extends__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime-corejs2/helpers/esm/extends */ "../../node_modules/@babel/runtime-corejs2/helpers/esm/extends.js");
/* harmony import */ var _babel_runtime_corejs2_helpers_esm_objectWithoutProperties__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @babel/runtime-corejs2/helpers/esm/objectWithoutProperties */ "../../node_modules/@babel/runtime-corejs2/helpers/esm/objectWithoutProperties.js");
/* harmony import */ var _material_ui_core_Divider__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! @material-ui/core/Divider */ "@material-ui/core/Divider");
/* harmony import */ var _material_ui_core_Divider__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(_material_ui_core_Divider__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! react */ "react");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(react__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var _material_ui_core_ExpansionPanel__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! @material-ui/core/ExpansionPanel */ "@material-ui/core/ExpansionPanel");
/* harmony import */ var _material_ui_core_ExpansionPanel__WEBPACK_IMPORTED_MODULE_4___default = /*#__PURE__*/__webpack_require__.n(_material_ui_core_ExpansionPanel__WEBPACK_IMPORTED_MODULE_4__);
/* harmony import */ var _material_ui_core_ExpansionPanelDetails__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! @material-ui/core/ExpansionPanelDetails */ "@material-ui/core/ExpansionPanelDetails");
/* harmony import */ var _material_ui_core_ExpansionPanelDetails__WEBPACK_IMPORTED_MODULE_5___default = /*#__PURE__*/__webpack_require__.n(_material_ui_core_ExpansionPanelDetails__WEBPACK_IMPORTED_MODULE_5__);
/* harmony import */ var _material_ui_core_ExpansionPanelSummary__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! @material-ui/core/ExpansionPanelSummary */ "@material-ui/core/ExpansionPanelSummary");
/* harmony import */ var _material_ui_core_ExpansionPanelSummary__WEBPACK_IMPORTED_MODULE_6___default = /*#__PURE__*/__webpack_require__.n(_material_ui_core_ExpansionPanelSummary__WEBPACK_IMPORTED_MODULE_6__);
/* harmony import */ var _material_ui_core_ExpansionPanelActions__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! @material-ui/core/ExpansionPanelActions */ "@material-ui/core/ExpansionPanelActions");
/* harmony import */ var _material_ui_core_ExpansionPanelActions__WEBPACK_IMPORTED_MODULE_7___default = /*#__PURE__*/__webpack_require__.n(_material_ui_core_ExpansionPanelActions__WEBPACK_IMPORTED_MODULE_7__);
/* harmony import */ var _material_ui_core_Typography__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! @material-ui/core/Typography */ "@material-ui/core/Typography");
/* harmony import */ var _material_ui_core_Typography__WEBPACK_IMPORTED_MODULE_8___default = /*#__PURE__*/__webpack_require__.n(_material_ui_core_Typography__WEBPACK_IMPORTED_MODULE_8__);
/* harmony import */ var _material_ui_icons_ExpandMore__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! @material-ui/icons/ExpandMore */ "@material-ui/icons/ExpandMore");
/* harmony import */ var _material_ui_icons_ExpandMore__WEBPACK_IMPORTED_MODULE_9___default = /*#__PURE__*/__webpack_require__.n(_material_ui_icons_ExpandMore__WEBPACK_IMPORTED_MODULE_9__);
/* harmony import */ var _material_ui_core_styles__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! @material-ui/core/styles */ "@material-ui/core/styles");
/* harmony import */ var _material_ui_core_styles__WEBPACK_IMPORTED_MODULE_10___default = /*#__PURE__*/__webpack_require__.n(_material_ui_core_styles__WEBPACK_IMPORTED_MODULE_10__);


var _jsxFileName = "/Users/sarakusha/WebstormProjects/@nata/packages/stela/components/Section.tsx";








 // import classNames from 'classnames';

var styles = function styles(theme) {
  return Object(_material_ui_core_styles__WEBPACK_IMPORTED_MODULE_10__["createStyles"])({
    title: {
      paddingTop: theme.spacing.unit,
      paddingBottom: theme.spacing.unit
    }
  });
};

var Section = function Section(_ref) {
  var title = _ref.title,
      classes = _ref.classes,
      className = _ref.className,
      children = _ref.children,
      actions = _ref.actions,
      props = Object(_babel_runtime_corejs2_helpers_esm_objectWithoutProperties__WEBPACK_IMPORTED_MODULE_1__["default"])(_ref, ["title", "classes", "className", "children", "actions"]);

  return react__WEBPACK_IMPORTED_MODULE_3___default.a.createElement(_material_ui_core_ExpansionPanel__WEBPACK_IMPORTED_MODULE_4___default.a, Object(_babel_runtime_corejs2_helpers_esm_extends__WEBPACK_IMPORTED_MODULE_0__["default"])({}, props, {
    __source: {
      fileName: _jsxFileName,
      lineNumber: 32
    },
    __self: this
  }), react__WEBPACK_IMPORTED_MODULE_3___default.a.createElement(_material_ui_core_ExpansionPanelSummary__WEBPACK_IMPORTED_MODULE_6___default.a, {
    expandIcon: react__WEBPACK_IMPORTED_MODULE_3___default.a.createElement(_material_ui_icons_ExpandMore__WEBPACK_IMPORTED_MODULE_9___default.a, {
      __source: {
        fileName: _jsxFileName,
        lineNumber: 33
      },
      __self: this
    }),
    __source: {
      fileName: _jsxFileName,
      lineNumber: 33
    },
    __self: this
  }, typeof title === 'string' ? react__WEBPACK_IMPORTED_MODULE_3___default.a.createElement(_material_ui_core_Typography__WEBPACK_IMPORTED_MODULE_8___default.a, {
    variant: 'h6',
    className: classes.title,
    __source: {
      fileName: _jsxFileName,
      lineNumber: 35
    },
    __self: this
  }, title) : title), react__WEBPACK_IMPORTED_MODULE_3___default.a.createElement(_material_ui_core_Divider__WEBPACK_IMPORTED_MODULE_2___default.a, {
    __source: {
      fileName: _jsxFileName,
      lineNumber: 38
    },
    __self: this
  }), react__WEBPACK_IMPORTED_MODULE_3___default.a.createElement(_material_ui_core_ExpansionPanelDetails__WEBPACK_IMPORTED_MODULE_5___default.a, {
    className: className,
    __source: {
      fileName: _jsxFileName,
      lineNumber: 39
    },
    __self: this
  }, children), actions && react__WEBPACK_IMPORTED_MODULE_3___default.a.createElement(_material_ui_core_Divider__WEBPACK_IMPORTED_MODULE_2___default.a, {
    __source: {
      fileName: _jsxFileName,
      lineNumber: 42
    },
    __self: this
  }), actions && react__WEBPACK_IMPORTED_MODULE_3___default.a.createElement(_material_ui_core_ExpansionPanelActions__WEBPACK_IMPORTED_MODULE_7___default.a, {
    __source: {
      fileName: _jsxFileName,
      lineNumber: 44
    },
    __self: this
  }, actions));
};

/* harmony default export */ __webpack_exports__["default"] = (Object(_material_ui_core_styles__WEBPACK_IMPORTED_MODULE_10__["withStyles"])(styles)(Section));

/***/ }),

/***/ "./components/StelaForm.tsx":
/*!**********************************!*\
  !*** ./components/StelaForm.tsx ***!
  \**********************************/
/*! exports provided: default */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony import */ var _babel_runtime_corejs2_core_js_number_is_nan__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime-corejs2/core-js/number/is-nan */ "../../node_modules/@babel/runtime-corejs2/core-js/number/is-nan.js");
/* harmony import */ var _babel_runtime_corejs2_core_js_number_is_nan__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(_babel_runtime_corejs2_core_js_number_is_nan__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _babel_runtime_corejs2_helpers_esm_objectSpread__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @babel/runtime-corejs2/helpers/esm/objectSpread */ "../../node_modules/@babel/runtime-corejs2/helpers/esm/objectSpread.js");
/* harmony import */ var _babel_runtime_corejs2_helpers_esm_objectWithoutProperties__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! @babel/runtime-corejs2/helpers/esm/objectWithoutProperties */ "../../node_modules/@babel/runtime-corejs2/helpers/esm/objectWithoutProperties.js");
/* harmony import */ var _babel_runtime_corejs2_helpers_esm_extends__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! @babel/runtime-corejs2/helpers/esm/extends */ "../../node_modules/@babel/runtime-corejs2/helpers/esm/extends.js");
/* harmony import */ var _babel_runtime_corejs2_helpers_esm_slicedToArray__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! @babel/runtime-corejs2/helpers/esm/slicedToArray */ "../../node_modules/@babel/runtime-corejs2/helpers/esm/slicedToArray.js");
/* harmony import */ var _babel_runtime_corejs2_helpers_esm_defineProperty__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! @babel/runtime-corejs2/helpers/esm/defineProperty */ "../../node_modules/@babel/runtime-corejs2/helpers/esm/defineProperty.js");
/* harmony import */ var _material_ui_core_FormGroup__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! @material-ui/core/FormGroup */ "@material-ui/core/FormGroup");
/* harmony import */ var _material_ui_core_FormGroup__WEBPACK_IMPORTED_MODULE_6___default = /*#__PURE__*/__webpack_require__.n(_material_ui_core_FormGroup__WEBPACK_IMPORTED_MODULE_6__);
/* harmony import */ var _material_ui_core_MenuItem__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! @material-ui/core/MenuItem */ "@material-ui/core/MenuItem");
/* harmony import */ var _material_ui_core_MenuItem__WEBPACK_IMPORTED_MODULE_7___default = /*#__PURE__*/__webpack_require__.n(_material_ui_core_MenuItem__WEBPACK_IMPORTED_MODULE_7__);
/* harmony import */ var _material_ui_core_styles__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! @material-ui/core/styles */ "@material-ui/core/styles");
/* harmony import */ var _material_ui_core_styles__WEBPACK_IMPORTED_MODULE_8___default = /*#__PURE__*/__webpack_require__.n(_material_ui_core_styles__WEBPACK_IMPORTED_MODULE_8__);
/* harmony import */ var classnames__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! classnames */ "classnames");
/* harmony import */ var classnames__WEBPACK_IMPORTED_MODULE_9___default = /*#__PURE__*/__webpack_require__.n(classnames__WEBPACK_IMPORTED_MODULE_9__);
/* harmony import */ var formik__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! formik */ "formik");
/* harmony import */ var formik__WEBPACK_IMPORTED_MODULE_10___default = /*#__PURE__*/__webpack_require__.n(formik__WEBPACK_IMPORTED_MODULE_10__);
/* harmony import */ var formik_material_ui__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! formik-material-ui */ "formik-material-ui");
/* harmony import */ var formik_material_ui__WEBPACK_IMPORTED_MODULE_11___default = /*#__PURE__*/__webpack_require__.n(formik_material_ui__WEBPACK_IMPORTED_MODULE_11__);
/* harmony import */ var lodash_set__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! lodash/set */ "lodash/set");
/* harmony import */ var lodash_set__WEBPACK_IMPORTED_MODULE_12___default = /*#__PURE__*/__webpack_require__.n(lodash_set__WEBPACK_IMPORTED_MODULE_12__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! react */ "react");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_13___default = /*#__PURE__*/__webpack_require__.n(react__WEBPACK_IMPORTED_MODULE_13__);
/* harmony import */ var react_beautiful_dnd__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! react-beautiful-dnd */ "react-beautiful-dnd");
/* harmony import */ var react_beautiful_dnd__WEBPACK_IMPORTED_MODULE_14___default = /*#__PURE__*/__webpack_require__.n(react_beautiful_dnd__WEBPACK_IMPORTED_MODULE_14__);
/* harmony import */ var recompose__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! recompose */ "recompose");
/* harmony import */ var recompose__WEBPACK_IMPORTED_MODULE_15___default = /*#__PURE__*/__webpack_require__.n(recompose__WEBPACK_IMPORTED_MODULE_15__);
/* harmony import */ var _src_timeid__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! ../src/timeid */ "./src/timeid.ts");
/* harmony import */ var _ColorPickerField__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! ./ColorPickerField */ "./components/ColorPickerField.tsx");
/* harmony import */ var _FormFieldSet__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! ./FormFieldSet */ "./components/FormFieldSet.tsx");
/* harmony import */ var _LockToolbar__WEBPACK_IMPORTED_MODULE_19__ = __webpack_require__(/*! ./LockToolbar */ "./components/LockToolbar.tsx");
/* harmony import */ var _Section__WEBPACK_IMPORTED_MODULE_20__ = __webpack_require__(/*! ./Section */ "./components/Section.tsx");
/* harmony import */ var _StelaFormRow__WEBPACK_IMPORTED_MODULE_21__ = __webpack_require__(/*! ./StelaFormRow */ "./components/StelaFormRow.tsx");






var _jsxFileName = "/Users/sarakusha/WebstormProjects/@nata/packages/stela/components/StelaForm.tsx";

















var styles = function styles(theme) {
  return Object(_material_ui_core_styles__WEBPACK_IMPORTED_MODULE_8__["createStyles"])({
    form: Object(_babel_runtime_corejs2_helpers_esm_defineProperty__WEBPACK_IMPORTED_MODULE_5__["default"])({
      maxWidth: 800
    }, theme.breakpoints.up('sm'), {
      marginRight: theme.spacing.unit * 3
    }),
    textField: {
      marginLeft: theme.spacing.unit,
      // marginRight: theme.spacing.unit,
      flex: 2
    },
    props: Object(_babel_runtime_corejs2_helpers_esm_defineProperty__WEBPACK_IMPORTED_MODULE_5__["default"])({
      display: 'flex',
      flexDirection: 'column'
    }, theme.breakpoints.down('xs'), {
      paddingLeft: theme.spacing.unit,
      paddingRight: theme.spacing.unit
    }),
    numberField: Object(_babel_runtime_corejs2_helpers_esm_defineProperty__WEBPACK_IMPORTED_MODULE_5__["default"])({
      marginLeft: theme.spacing.unit,
      // marginRight: theme.spacing.unit,
      flex: '0 0 5ch'
    }, theme.breakpoints.up('sm'), {
      flex: '0 0 8ch'
    }),
    dragHandle: {
      cursor: 'unset',
      backgroundColor: theme.palette.primary.main
    },
    dragHandleDragging: {
      backgroundColor: theme.palette.primary.light
    },
    dragHandleLocked: {
      backgroundColor: theme.palette.primary.light
    },
    draggingRow: {
      backgroundColor: theme.palette.background.default,
      userSelect: 'none'
    },
    fontName: {
      maxWidth: '20ch'
    }
  });
};

var rightAlign = {
  textAlign: 'right'
};
var sizeProps = {
  min: 6,
  style: rightAlign
};
var dimensionProps = {
  min: 20,
  step: 4,
  style: rightAlign
};
var lineHeightProps = {
  min: 1,
  step: 0.1,
  style: rightAlign
};
var paddingProps = {
  min: 0,
  step: 1,
  style: rightAlign
};

var InnerForm = function InnerForm(props) {
  var items = props.values.items,
      classes = props.classes,
      submitForm = props.submitForm,
      errors = props.errors,
      bindSubmitForm = props.bindSubmitForm,
      bindResetForm = props.bindResetForm,
      submittingChanged = props.submittingChanged,
      isSubmitting = props.isSubmitting,
      resetForm = props.resetForm;
  Object(react__WEBPACK_IMPORTED_MODULE_13__["useEffect"])(function () {
    bindSubmitForm && bindSubmitForm(submitForm);
    return function () {
      bindSubmitForm && bindSubmitForm(function () {});
    };
  }, [submitForm, bindSubmitForm]);
  Object(react__WEBPACK_IMPORTED_MODULE_13__["useEffect"])(function () {
    submittingChanged && submittingChanged(isSubmitting);
  }, [submittingChanged, isSubmitting]);
  Object(react__WEBPACK_IMPORTED_MODULE_13__["useEffect"])(function () {
    bindResetForm && bindResetForm(resetForm);
    return function () {
      bindResetForm && bindResetForm(function () {});
    };
  }, [resetForm, bindResetForm]);
  var arrayHelpersRef = Object(react__WEBPACK_IMPORTED_MODULE_13__["useRef"])(null);
  var dragEndMemo = Object(react__WEBPACK_IMPORTED_MODULE_13__["useCallback"])(function (result) {
    if (!result.destination || !arrayHelpersRef.current) return;
    arrayHelpersRef.current.move(result.source.index, result.destination.index);
  }, [arrayHelpersRef]);
  var addClick = Object(react__WEBPACK_IMPORTED_MODULE_13__["useCallback"])(function () {
    var item = {
      id: Object(_src_timeid__WEBPACK_IMPORTED_MODULE_16__["default"])(),
      name: '',
      subName: '',
      price: '',
      isVisible: true
    };
    arrayHelpersRef.current && arrayHelpersRef.current.push(item);
  }, [arrayHelpersRef]);

  var _useState = Object(react__WEBPACK_IMPORTED_MODULE_13__["useState"])(true),
      _useState2 = Object(_babel_runtime_corejs2_helpers_esm_slicedToArray__WEBPACK_IMPORTED_MODULE_4__["default"])(_useState, 2),
      locked = _useState2[0],
      setLocked = _useState2[1];

  var _useState3 = Object(react__WEBPACK_IMPORTED_MODULE_13__["useState"])(false),
      _useState4 = Object(_babel_runtime_corejs2_helpers_esm_slicedToArray__WEBPACK_IMPORTED_MODULE_4__["default"])(_useState3, 2),
      settingsExpanded = _useState4[0],
      setSettingsExpanded = _useState4[1];

  function handleChange(e, isLocked) {
    setLocked(isLocked);
  }

  function handleSettingsChange(e, expanded) {
    setSettingsExpanded(expanded);
  }

  return react__WEBPACK_IMPORTED_MODULE_13___default.a.createElement(formik__WEBPACK_IMPORTED_MODULE_10__["Form"], {
    noValidate: true,
    className: classes.form,
    autoComplete: "off",
    __source: {
      fileName: _jsxFileName,
      lineNumber: 175
    },
    __self: this
  }, react__WEBPACK_IMPORTED_MODULE_13___default.a.createElement(_Section__WEBPACK_IMPORTED_MODULE_20__["default"], {
    title: react__WEBPACK_IMPORTED_MODULE_13___default.a.createElement(_LockToolbar__WEBPACK_IMPORTED_MODULE_19__["default"], {
      title: 'Прайс-лист',
      onChange: handleChange,
      checked: locked,
      onAdd: addClick,
      __source: {
        fileName: _jsxFileName,
        lineNumber: 177
      },
      __self: this
    }),
    defaultExpanded: true,
    className: classes.props // actions={<AddAction onClick={addClick} />}
    ,
    __source: {
      fileName: _jsxFileName,
      lineNumber: 176
    },
    __self: this
  }, react__WEBPACK_IMPORTED_MODULE_13___default.a.createElement(_FormFieldSet__WEBPACK_IMPORTED_MODULE_18__["default"], {
    fullWidth: true,
    __source: {
      fileName: _jsxFileName,
      lineNumber: 187
    },
    __self: this
  }, react__WEBPACK_IMPORTED_MODULE_13___default.a.createElement(formik__WEBPACK_IMPORTED_MODULE_10__["FieldArray"], {
    name: "items",
    __source: {
      fileName: _jsxFileName,
      lineNumber: 188
    },
    __self: this
  }, function (arrayHelpers) {
    arrayHelpersRef.current = arrayHelpers;
    return react__WEBPACK_IMPORTED_MODULE_13___default.a.createElement(react_beautiful_dnd__WEBPACK_IMPORTED_MODULE_14__["DragDropContext"], {
      onDragEnd: dragEndMemo,
      __source: {
        fileName: _jsxFileName,
        lineNumber: 192
      },
      __self: this
    }, react__WEBPACK_IMPORTED_MODULE_13___default.a.createElement(react_beautiful_dnd__WEBPACK_IMPORTED_MODULE_14__["Droppable"], {
      droppableId: "droppable",
      __source: {
        fileName: _jsxFileName,
        lineNumber: 193
      },
      __self: this
    }, function (provided) {
      return react__WEBPACK_IMPORTED_MODULE_13___default.a.createElement("div", {
        ref: provided.innerRef,
        __source: {
          fileName: _jsxFileName,
          lineNumber: 195
        },
        __self: this
      }, items.map(function (item, index) {
        return react__WEBPACK_IMPORTED_MODULE_13___default.a.createElement(react_beautiful_dnd__WEBPACK_IMPORTED_MODULE_14__["Draggable"], {
          draggableId: item.id || "".concat(index),
          index: index,
          key: item.id,
          isDragDisabled: locked,
          __source: {
            fileName: _jsxFileName,
            lineNumber: 199
          },
          __self: this
        }, function (provided, snapshot) {
          return react__WEBPACK_IMPORTED_MODULE_13___default.a.createElement("div", Object(_babel_runtime_corejs2_helpers_esm_extends__WEBPACK_IMPORTED_MODULE_3__["default"])({
            ref: provided.innerRef
          }, provided.draggableProps, {
            className: classnames__WEBPACK_IMPORTED_MODULE_9___default()(Object(_babel_runtime_corejs2_helpers_esm_defineProperty__WEBPACK_IMPORTED_MODULE_5__["default"])({}, classes.draggingRow, snapshot.isDragging)),
            __source: {
              fileName: _jsxFileName,
              lineNumber: 206
            },
            __self: this
          }), react__WEBPACK_IMPORTED_MODULE_13___default.a.createElement(_StelaFormRow__WEBPACK_IMPORTED_MODULE_21__["default"], {
            item: item,
            index: index,
            classes: classes,
            handleProps: provided.dragHandleProps,
            errors: errors.items && errors.items[index],
            locked: locked,
            isDragging: snapshot.isDragging,
            remove: arrayHelpers.handleRemove(index),
            __source: {
              fileName: _jsxFileName,
              lineNumber: 213
            },
            __self: this
          }));
        });
      }), provided.placeholder);
    }));
  }))), react__WEBPACK_IMPORTED_MODULE_13___default.a.createElement(_Section__WEBPACK_IMPORTED_MODULE_20__["default"], {
    title: 'Настройки',
    className: classes.props,
    disabled: locked,
    onChange: handleSettingsChange,
    expanded: settingsExpanded && !locked,
    __source: {
      fileName: _jsxFileName,
      lineNumber: 237
    },
    __self: this
  }, react__WEBPACK_IMPORTED_MODULE_13___default.a.createElement(_FormFieldSet__WEBPACK_IMPORTED_MODULE_18__["default"], {
    margin: "none",
    legend: 'Шрифт',
    __source: {
      fileName: _jsxFileName,
      lineNumber: 244
    },
    __self: this
  }, react__WEBPACK_IMPORTED_MODULE_13___default.a.createElement(_material_ui_core_FormGroup__WEBPACK_IMPORTED_MODULE_6___default.a, {
    row: true,
    __source: {
      fileName: _jsxFileName,
      lineNumber: 245
    },
    __self: this
  }, react__WEBPACK_IMPORTED_MODULE_13___default.a.createElement(formik__WEBPACK_IMPORTED_MODULE_10__["Field"], {
    name: "isBold" // type="checkbox"
    ,
    Label: {
      label: 'Жирный',
      className: classes.textField
    },
    component: formik_material_ui__WEBPACK_IMPORTED_MODULE_11__["CheckboxWithLabel"],
    __source: {
      fileName: _jsxFileName,
      lineNumber: 246
    },
    __self: this
  }), react__WEBPACK_IMPORTED_MODULE_13___default.a.createElement(formik__WEBPACK_IMPORTED_MODULE_10__["Field"], {
    name: "isCondensed",
    Label: {
      label: 'Уплотненный',
      className: classes.textField
    },
    component: formik_material_ui__WEBPACK_IMPORTED_MODULE_11__["CheckboxWithLabel"],
    __source: {
      fileName: _jsxFileName,
      lineNumber: 255
    },
    __self: this
  }), react__WEBPACK_IMPORTED_MODULE_13___default.a.createElement(formik__WEBPACK_IMPORTED_MODULE_10__["Field"], {
    name: "lineHeight",
    type: "number",
    label: "\u0412\u044B\u0441\u043E\u0442\u0430",
    component: formik_material_ui__WEBPACK_IMPORTED_MODULE_11__["TextField"],
    className: classes.numberField,
    inputProps: lineHeightProps,
    __source: {
      fileName: _jsxFileName,
      lineNumber: 263
    },
    __self: this
  })), react__WEBPACK_IMPORTED_MODULE_13___default.a.createElement(formik__WEBPACK_IMPORTED_MODULE_10__["Field"], {
    name: "fontName",
    type: "text",
    label: "\u0418\u043C\u044F",
    select: true,
    title: "\u0413\u0430\u0440\u043D\u0438\u0442\u0443\u0440\u0430",
    component: formik_material_ui__WEBPACK_IMPORTED_MODULE_11__["TextField"],
    className: classes.fontName,
    InputLabelProps: {
      shrink: true
    },
    __source: {
      fileName: _jsxFileName,
      lineNumber: 272
    },
    __self: this
  }, react__WEBPACK_IMPORTED_MODULE_13___default.a.createElement(_material_ui_core_MenuItem__WEBPACK_IMPORTED_MODULE_7___default.a, {
    value: "Ubuntu",
    __source: {
      fileName: _jsxFileName,
      lineNumber: 282
    },
    __self: this
  }, "Ubuntu"), react__WEBPACK_IMPORTED_MODULE_13___default.a.createElement(_material_ui_core_MenuItem__WEBPACK_IMPORTED_MODULE_7___default.a, {
    value: "LCDnova",
    __source: {
      fileName: _jsxFileName,
      lineNumber: 283
    },
    __self: this
  }, "LCD"))), react__WEBPACK_IMPORTED_MODULE_13___default.a.createElement(_FormFieldSet__WEBPACK_IMPORTED_MODULE_18__["default"], {
    margin: "normal",
    legend: 'Заголовок',
    fullWidth: false,
    __source: {
      fileName: _jsxFileName,
      lineNumber: 286
    },
    __self: this
  }, react__WEBPACK_IMPORTED_MODULE_13___default.a.createElement(_material_ui_core_FormGroup__WEBPACK_IMPORTED_MODULE_6___default.a, {
    row: true,
    __source: {
      fileName: _jsxFileName,
      lineNumber: 287
    },
    __self: this
  }, react__WEBPACK_IMPORTED_MODULE_13___default.a.createElement(formik__WEBPACK_IMPORTED_MODULE_10__["Field"], {
    name: "titleColor",
    label: "\u0426\u0432\u0435\u0442",
    component: _ColorPickerField__WEBPACK_IMPORTED_MODULE_17__["default"],
    __source: {
      fileName: _jsxFileName,
      lineNumber: 288
    },
    __self: this
  }), react__WEBPACK_IMPORTED_MODULE_13___default.a.createElement(formik__WEBPACK_IMPORTED_MODULE_10__["Field"], {
    name: "titleSize",
    type: "number",
    label: "\u0420\u0430\u0437\u043C\u0435\u0440",
    component: formik_material_ui__WEBPACK_IMPORTED_MODULE_11__["TextField"],
    className: classes.numberField,
    inputProps: sizeProps,
    __source: {
      fileName: _jsxFileName,
      lineNumber: 293
    },
    __self: this
  }), react__WEBPACK_IMPORTED_MODULE_13___default.a.createElement(formik__WEBPACK_IMPORTED_MODULE_10__["Field"], {
    name: "title",
    type: "text",
    label: "\u0418\u043C\u044F",
    component: formik_material_ui__WEBPACK_IMPORTED_MODULE_11__["TextField"],
    className: classes.textField,
    __source: {
      fileName: _jsxFileName,
      lineNumber: 301
    },
    __self: this
  }))), react__WEBPACK_IMPORTED_MODULE_13___default.a.createElement(_FormFieldSet__WEBPACK_IMPORTED_MODULE_18__["default"], {
    margin: "normal",
    legend: 'Марка',
    fullWidth: false,
    __source: {
      fileName: _jsxFileName,
      lineNumber: 310
    },
    __self: this
  }, react__WEBPACK_IMPORTED_MODULE_13___default.a.createElement(_material_ui_core_FormGroup__WEBPACK_IMPORTED_MODULE_6___default.a, {
    row: true,
    __source: {
      fileName: _jsxFileName,
      lineNumber: 311
    },
    __self: this
  }, react__WEBPACK_IMPORTED_MODULE_13___default.a.createElement(formik__WEBPACK_IMPORTED_MODULE_10__["Field"], {
    name: "nameColor",
    type: "text",
    label: "\u0426\u0432\u0435\u0442",
    component: _ColorPickerField__WEBPACK_IMPORTED_MODULE_17__["default"],
    __source: {
      fileName: _jsxFileName,
      lineNumber: 312
    },
    __self: this
  }), react__WEBPACK_IMPORTED_MODULE_13___default.a.createElement(formik__WEBPACK_IMPORTED_MODULE_10__["Field"], {
    name: "nameSize",
    type: "number",
    label: "\u0420\u0430\u0437\u043C\u0435\u0440",
    component: formik_material_ui__WEBPACK_IMPORTED_MODULE_11__["TextField"],
    className: classes.numberField,
    inputProps: sizeProps,
    __source: {
      fileName: _jsxFileName,
      lineNumber: 318
    },
    __self: this
  }))), react__WEBPACK_IMPORTED_MODULE_13___default.a.createElement(_FormFieldSet__WEBPACK_IMPORTED_MODULE_18__["default"], {
    margin: "normal",
    legend: 'Бренд',
    __source: {
      fileName: _jsxFileName,
      lineNumber: 328
    },
    __self: this
  }, react__WEBPACK_IMPORTED_MODULE_13___default.a.createElement(_material_ui_core_FormGroup__WEBPACK_IMPORTED_MODULE_6___default.a, {
    row: true,
    __source: {
      fileName: _jsxFileName,
      lineNumber: 329
    },
    __self: this
  }, react__WEBPACK_IMPORTED_MODULE_13___default.a.createElement(formik__WEBPACK_IMPORTED_MODULE_10__["Field"], {
    name: "subColor",
    type: "text",
    label: "\u0426\u0432\u0435\u0442",
    component: _ColorPickerField__WEBPACK_IMPORTED_MODULE_17__["default"],
    __source: {
      fileName: _jsxFileName,
      lineNumber: 330
    },
    __self: this
  }), react__WEBPACK_IMPORTED_MODULE_13___default.a.createElement(formik__WEBPACK_IMPORTED_MODULE_10__["Field"], {
    name: "subSize",
    type: "number",
    label: "\u0420\u0430\u0437\u043C\u0435\u0440",
    component: formik_material_ui__WEBPACK_IMPORTED_MODULE_11__["TextField"],
    className: classes.numberField,
    inputProps: sizeProps,
    __source: {
      fileName: _jsxFileName,
      lineNumber: 336
    },
    __self: this
  }))), react__WEBPACK_IMPORTED_MODULE_13___default.a.createElement(_FormFieldSet__WEBPACK_IMPORTED_MODULE_18__["default"], {
    margin: "normal",
    legend: 'Цена',
    __source: {
      fileName: _jsxFileName,
      lineNumber: 346
    },
    __self: this
  }, react__WEBPACK_IMPORTED_MODULE_13___default.a.createElement(_material_ui_core_FormGroup__WEBPACK_IMPORTED_MODULE_6___default.a, {
    row: true,
    __source: {
      fileName: _jsxFileName,
      lineNumber: 347
    },
    __self: this
  }, react__WEBPACK_IMPORTED_MODULE_13___default.a.createElement(formik__WEBPACK_IMPORTED_MODULE_10__["Field"], {
    name: "priceColor",
    type: "text",
    label: "\u0426\u0432\u0435\u0442",
    component: _ColorPickerField__WEBPACK_IMPORTED_MODULE_17__["default"],
    __source: {
      fileName: _jsxFileName,
      lineNumber: 348
    },
    __self: this
  }), react__WEBPACK_IMPORTED_MODULE_13___default.a.createElement(formik__WEBPACK_IMPORTED_MODULE_10__["Field"], {
    name: "priceSize",
    type: "number",
    label: "\u0420\u0430\u0437\u043C\u0435\u0440",
    component: formik_material_ui__WEBPACK_IMPORTED_MODULE_11__["TextField"],
    className: classes.numberField,
    inputProps: sizeProps,
    __source: {
      fileName: _jsxFileName,
      lineNumber: 354
    },
    __self: this
  }))), react__WEBPACK_IMPORTED_MODULE_13___default.a.createElement(_FormFieldSet__WEBPACK_IMPORTED_MODULE_18__["default"], {
    legend: 'Размер',
    __source: {
      fileName: _jsxFileName,
      lineNumber: 364
    },
    __self: this
  }, react__WEBPACK_IMPORTED_MODULE_13___default.a.createElement(_material_ui_core_FormGroup__WEBPACK_IMPORTED_MODULE_6___default.a, {
    row: true,
    __source: {
      fileName: _jsxFileName,
      lineNumber: 365
    },
    __self: this
  }, react__WEBPACK_IMPORTED_MODULE_13___default.a.createElement(formik__WEBPACK_IMPORTED_MODULE_10__["Field"], {
    name: "width",
    type: "number",
    label: "\u0428\u0438\u0440\u0438\u043D\u0430",
    component: formik_material_ui__WEBPACK_IMPORTED_MODULE_11__["TextField"],
    className: classes.numberField,
    inputProps: dimensionProps,
    __source: {
      fileName: _jsxFileName,
      lineNumber: 366
    },
    __self: this
  }), react__WEBPACK_IMPORTED_MODULE_13___default.a.createElement(formik__WEBPACK_IMPORTED_MODULE_10__["Field"], {
    name: "height",
    type: "number",
    label: "\u0412\u044B\u0441\u043E\u0442\u0430",
    component: formik_material_ui__WEBPACK_IMPORTED_MODULE_11__["TextField"],
    className: classes.numberField,
    inputProps: dimensionProps,
    __source: {
      fileName: _jsxFileName,
      lineNumber: 374
    },
    __self: this
  }), react__WEBPACK_IMPORTED_MODULE_13___default.a.createElement(formik__WEBPACK_IMPORTED_MODULE_10__["Field"], {
    name: "paddingTop",
    type: "number",
    label: "\u041E\u0442\u0441\u0442\u0443\u043F",
    title: "\u041E\u0442\u0441\u0442\u0443\u043F \u0441\u0432\u0435\u0440\u0445\u0443",
    component: formik_material_ui__WEBPACK_IMPORTED_MODULE_11__["TextField"],
    className: classes.numberField,
    inputProps: paddingProps,
    __source: {
      fileName: _jsxFileName,
      lineNumber: 382
    },
    __self: this
  })))));
};

/* harmony default export */ __webpack_exports__["default"] = (Object(recompose__WEBPACK_IMPORTED_MODULE_15__["compose"])(Object(_material_ui_core_styles__WEBPACK_IMPORTED_MODULE_8__["withStyles"])(styles), Object(formik__WEBPACK_IMPORTED_MODULE_10__["withFormik"])({
  validateOnChange: true,
  enableReinitialize: true,
  mapPropsToValues: function mapPropsToValues(_ref) {
    var update = _ref.update,
        classes = _ref.classes,
        items = _ref.items,
        props = Object(_babel_runtime_corejs2_helpers_esm_objectWithoutProperties__WEBPACK_IMPORTED_MODULE_2__["default"])(_ref, ["update", "classes", "items"]);

    return Object(_babel_runtime_corejs2_helpers_esm_objectSpread__WEBPACK_IMPORTED_MODULE_1__["default"])({}, props, {
      items: items.map(function (_ref2) {
        var name = _ref2.name,
            subName = _ref2.subName,
            price = _ref2.price,
            other = Object(_babel_runtime_corejs2_helpers_esm_objectWithoutProperties__WEBPACK_IMPORTED_MODULE_2__["default"])(_ref2, ["name", "subName", "price"]);

        return Object(_babel_runtime_corejs2_helpers_esm_objectSpread__WEBPACK_IMPORTED_MODULE_1__["default"])({
          name: name || '',
          subName: subName || '',
          price: typeof price === 'number' ? price.toFixed(2) : price || ''
        }, other);
      })
    });
  },
  handleSubmit: function handleSubmit(values, _ref3) {
    var update = _ref3.props.update,
        setSubmitting = _ref3.setSubmitting;
    update(values);
    setSubmitting(false);
  },
  validate: function validate(values) {
    var errors = {};
    var items = values.items;
    items.forEach(function (_ref4, index) {
      var name = _ref4.name,
          price = _ref4.price;

      if (name.trim().length === 0) {
        lodash_set__WEBPACK_IMPORTED_MODULE_12___default()(errors, "items[".concat(index, "].name"), "required".concat(index));
      }

      var num = Number(price);

      if (price !== '' && (_babel_runtime_corejs2_core_js_number_is_nan__WEBPACK_IMPORTED_MODULE_0___default()(num) || num === 0)) {
        lodash_set__WEBPACK_IMPORTED_MODULE_12___default()(errors, "items[".concat(index, "].price"), 'must be a number'); // errors[`items[${index}].price`] = 'MUST BE A NUMBER';
      }
    }); // Object.keys(errors).length > 0 && console.log(errors);

    return errors;
  }
}) // React.memo,
)(InnerForm));

/***/ }),

/***/ "./components/StelaFormRow.tsx":
/*!*************************************!*\
  !*** ./components/StelaFormRow.tsx ***!
  \*************************************/
/*! exports provided: default */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony import */ var _babel_runtime_corejs2_helpers_esm_extends__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime-corejs2/helpers/esm/extends */ "../../node_modules/@babel/runtime-corejs2/helpers/esm/extends.js");
/* harmony import */ var _babel_runtime_corejs2_helpers_esm_defineProperty__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @babel/runtime-corejs2/helpers/esm/defineProperty */ "../../node_modules/@babel/runtime-corejs2/helpers/esm/defineProperty.js");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! react */ "react");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(react__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var _material_ui_core_FormGroup__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! @material-ui/core/FormGroup */ "@material-ui/core/FormGroup");
/* harmony import */ var _material_ui_core_FormGroup__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(_material_ui_core_FormGroup__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var _material_ui_core_Avatar__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! @material-ui/core/Avatar */ "@material-ui/core/Avatar");
/* harmony import */ var _material_ui_core_Avatar__WEBPACK_IMPORTED_MODULE_4___default = /*#__PURE__*/__webpack_require__.n(_material_ui_core_Avatar__WEBPACK_IMPORTED_MODULE_4__);
/* harmony import */ var _material_ui_core_IconButton__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! @material-ui/core/IconButton */ "@material-ui/core/IconButton");
/* harmony import */ var _material_ui_core_IconButton__WEBPACK_IMPORTED_MODULE_5___default = /*#__PURE__*/__webpack_require__.n(_material_ui_core_IconButton__WEBPACK_IMPORTED_MODULE_5__);
/* harmony import */ var _material_ui_icons_Clear__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! @material-ui/icons/Clear */ "@material-ui/icons/Clear");
/* harmony import */ var _material_ui_icons_Clear__WEBPACK_IMPORTED_MODULE_6___default = /*#__PURE__*/__webpack_require__.n(_material_ui_icons_Clear__WEBPACK_IMPORTED_MODULE_6__);
/* harmony import */ var classnames__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! classnames */ "classnames");
/* harmony import */ var classnames__WEBPACK_IMPORTED_MODULE_7___default = /*#__PURE__*/__webpack_require__.n(classnames__WEBPACK_IMPORTED_MODULE_7__);
/* harmony import */ var formik__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! formik */ "formik");
/* harmony import */ var formik__WEBPACK_IMPORTED_MODULE_8___default = /*#__PURE__*/__webpack_require__.n(formik__WEBPACK_IMPORTED_MODULE_8__);
/* harmony import */ var formik_material_ui__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! formik-material-ui */ "formik-material-ui");
/* harmony import */ var formik_material_ui__WEBPACK_IMPORTED_MODULE_9___default = /*#__PURE__*/__webpack_require__.n(formik_material_ui__WEBPACK_IMPORTED_MODULE_9__);
/* harmony import */ var _CurrencyField__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! ./CurrencyField */ "./components/CurrencyField.tsx");
/* harmony import */ var _FormFieldSet__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! ./FormFieldSet */ "./components/FormFieldSet.tsx");


var _jsxFileName = "/Users/sarakusha/WebstormProjects/@nata/packages/stela/components/StelaFormRow.tsx";











var StelaFormRow = function StelaFormRow(_ref) {
  var id = _ref.item.id,
      index = _ref.index,
      handleProps = _ref.handleProps,
      classes = _ref.classes,
      _ref$errors = _ref.errors,
      errors = _ref$errors === void 0 ? {} : _ref$errors,
      locked = _ref.locked,
      isDragging = _ref.isDragging,
      remove = _ref.remove;
  var lockedInput = Object(react__WEBPACK_IMPORTED_MODULE_2__["useMemo"])(function () {
    return locked ? {
      readOnly: true,
      inputProps: {
        tabIndex: -1,
        readOnly: true
      }
    } : {};
  }, [locked]);
  return react__WEBPACK_IMPORTED_MODULE_2___default.a.createElement(_FormFieldSet__WEBPACK_IMPORTED_MODULE_11__["default"], {
    margin: 'dense',
    fullWidth: true,
    key: id || index,
    __source: {
      fileName: _jsxFileName,
      lineNumber: 49
    },
    __self: this
  }, react__WEBPACK_IMPORTED_MODULE_2___default.a.createElement(_material_ui_core_FormGroup__WEBPACK_IMPORTED_MODULE_3___default.a, {
    row: true,
    __source: {
      fileName: _jsxFileName,
      lineNumber: 54
    },
    __self: this
  }, react__WEBPACK_IMPORTED_MODULE_2___default.a.createElement(_material_ui_core_Avatar__WEBPACK_IMPORTED_MODULE_4___default.a, Object(_babel_runtime_corejs2_helpers_esm_extends__WEBPACK_IMPORTED_MODULE_0__["default"])({}, handleProps, {
    className: classnames__WEBPACK_IMPORTED_MODULE_7___default()(classes.dragHandle, Object(_babel_runtime_corejs2_helpers_esm_defineProperty__WEBPACK_IMPORTED_MODULE_1__["default"])({}, classes.dragHandleDragging, isDragging), Object(_babel_runtime_corejs2_helpers_esm_defineProperty__WEBPACK_IMPORTED_MODULE_1__["default"])({}, classes.dragHandleLocked, locked)),
    tabIndex: locked ? -1 : 0,
    __source: {
      fileName: _jsxFileName,
      lineNumber: 55
    },
    __self: this
  }), index + 1), react__WEBPACK_IMPORTED_MODULE_2___default.a.createElement(formik__WEBPACK_IMPORTED_MODULE_8__["Field"], {
    name: "items[".concat(index, "].isVisible"),
    component: formik_material_ui__WEBPACK_IMPORTED_MODULE_9__["Checkbox"],
    title: "\u0412\u044B\u0432\u0435\u0441\u0442\u0438 \u043D\u0430 \u044D\u043A\u0440\u0430\u043D",
    disabled: locked,
    __source: {
      fileName: _jsxFileName,
      lineNumber: 66
    },
    __self: this
  }), react__WEBPACK_IMPORTED_MODULE_2___default.a.createElement(formik__WEBPACK_IMPORTED_MODULE_8__["Field"], {
    name: "items[".concat(index, "].name"),
    type: "text",
    label: "\u041C\u0430\u0440\u043A\u0430",
    component: formik_material_ui__WEBPACK_IMPORTED_MODULE_9__["TextField"],
    className: classes.textField,
    InputProps: lockedInput,
    __source: {
      fileName: _jsxFileName,
      lineNumber: 72
    },
    __self: this
  }), react__WEBPACK_IMPORTED_MODULE_2___default.a.createElement(formik__WEBPACK_IMPORTED_MODULE_8__["Field"], {
    name: "items[".concat(index, "].subName"),
    type: "text",
    label: "\u0411\u0440\u0435\u043D\u0434",
    component: formik_material_ui__WEBPACK_IMPORTED_MODULE_9__["TextField"],
    className: classes.textField,
    InputProps: lockedInput,
    __source: {
      fileName: _jsxFileName,
      lineNumber: 80
    },
    __self: this
  }), react__WEBPACK_IMPORTED_MODULE_2___default.a.createElement(formik__WEBPACK_IMPORTED_MODULE_8__["Field"], {
    error: errors.price,
    name: "items[".concat(index, "].price"),
    type: "text",
    label: "\u0426\u0435\u043D\u0430",
    component: _CurrencyField__WEBPACK_IMPORTED_MODULE_10__["default"],
    className: classes.numberField,
    __source: {
      fileName: _jsxFileName,
      lineNumber: 88
    },
    __self: this
  }), react__WEBPACK_IMPORTED_MODULE_2___default.a.createElement(_material_ui_core_IconButton__WEBPACK_IMPORTED_MODULE_5___default.a, {
    disabled: locked,
    onClick: remove,
    __source: {
      fileName: _jsxFileName,
      lineNumber: 96
    },
    __self: this
  }, react__WEBPACK_IMPORTED_MODULE_2___default.a.createElement(_material_ui_icons_Clear__WEBPACK_IMPORTED_MODULE_6___default.a, {
    fontSize: "small",
    __source: {
      fileName: _jsxFileName,
      lineNumber: 97
    },
    __self: this
  }))));
};

/* harmony default export */ __webpack_exports__["default"] = (react__WEBPACK_IMPORTED_MODULE_2___default.a.memo(StelaFormRow));

/***/ }),

/***/ "./pages/dashboard.tsx":
/*!*****************************!*\
  !*** ./pages/dashboard.tsx ***!
  \*****************************/
/*! exports provided: default */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony import */ var _babel_runtime_corejs2_helpers_esm_extends__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime-corejs2/helpers/esm/extends */ "../../node_modules/@babel/runtime-corejs2/helpers/esm/extends.js");
/* harmony import */ var _babel_runtime_corejs2_helpers_esm_objectWithoutProperties__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @babel/runtime-corejs2/helpers/esm/objectWithoutProperties */ "../../node_modules/@babel/runtime-corejs2/helpers/esm/objectWithoutProperties.js");
/* harmony import */ var _babel_runtime_corejs2_helpers_esm_classCallCheck__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! @babel/runtime-corejs2/helpers/esm/classCallCheck */ "../../node_modules/@babel/runtime-corejs2/helpers/esm/classCallCheck.js");
/* harmony import */ var _babel_runtime_corejs2_helpers_esm_createClass__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! @babel/runtime-corejs2/helpers/esm/createClass */ "../../node_modules/@babel/runtime-corejs2/helpers/esm/createClass.js");
/* harmony import */ var _babel_runtime_corejs2_helpers_esm_possibleConstructorReturn__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! @babel/runtime-corejs2/helpers/esm/possibleConstructorReturn */ "../../node_modules/@babel/runtime-corejs2/helpers/esm/possibleConstructorReturn.js");
/* harmony import */ var _babel_runtime_corejs2_helpers_esm_getPrototypeOf__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! @babel/runtime-corejs2/helpers/esm/getPrototypeOf */ "../../node_modules/@babel/runtime-corejs2/helpers/esm/getPrototypeOf.js");
/* harmony import */ var _babel_runtime_corejs2_helpers_esm_assertThisInitialized__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! @babel/runtime-corejs2/helpers/esm/assertThisInitialized */ "../../node_modules/@babel/runtime-corejs2/helpers/esm/assertThisInitialized.js");
/* harmony import */ var _babel_runtime_corejs2_helpers_esm_inherits__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! @babel/runtime-corejs2/helpers/esm/inherits */ "../../node_modules/@babel/runtime-corejs2/helpers/esm/inherits.js");
/* harmony import */ var _babel_runtime_corejs2_helpers_esm_defineProperty__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! @babel/runtime-corejs2/helpers/esm/defineProperty */ "../../node_modules/@babel/runtime-corejs2/helpers/esm/defineProperty.js");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! react */ "react");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_9___default = /*#__PURE__*/__webpack_require__.n(react__WEBPACK_IMPORTED_MODULE_9__);
/* harmony import */ var _material_ui_core_AppBar__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! @material-ui/core/AppBar */ "@material-ui/core/AppBar");
/* harmony import */ var _material_ui_core_AppBar__WEBPACK_IMPORTED_MODULE_10___default = /*#__PURE__*/__webpack_require__.n(_material_ui_core_AppBar__WEBPACK_IMPORTED_MODULE_10__);
/* harmony import */ var _material_ui_core_Drawer__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! @material-ui/core/Drawer */ "@material-ui/core/Drawer");
/* harmony import */ var _material_ui_core_Drawer__WEBPACK_IMPORTED_MODULE_11___default = /*#__PURE__*/__webpack_require__.n(_material_ui_core_Drawer__WEBPACK_IMPORTED_MODULE_11__);
/* harmony import */ var _material_ui_core_Hidden__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! @material-ui/core/Hidden */ "@material-ui/core/Hidden");
/* harmony import */ var _material_ui_core_Hidden__WEBPACK_IMPORTED_MODULE_12___default = /*#__PURE__*/__webpack_require__.n(_material_ui_core_Hidden__WEBPACK_IMPORTED_MODULE_12__);
/* harmony import */ var _material_ui_core_IconButton__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! @material-ui/core/IconButton */ "@material-ui/core/IconButton");
/* harmony import */ var _material_ui_core_IconButton__WEBPACK_IMPORTED_MODULE_13___default = /*#__PURE__*/__webpack_require__.n(_material_ui_core_IconButton__WEBPACK_IMPORTED_MODULE_13__);
/* harmony import */ var _material_ui_core_Paper__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! @material-ui/core/Paper */ "@material-ui/core/Paper");
/* harmony import */ var _material_ui_core_Paper__WEBPACK_IMPORTED_MODULE_14___default = /*#__PURE__*/__webpack_require__.n(_material_ui_core_Paper__WEBPACK_IMPORTED_MODULE_14__);
/* harmony import */ var _material_ui_core_styles__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! @material-ui/core/styles */ "@material-ui/core/styles");
/* harmony import */ var _material_ui_core_styles__WEBPACK_IMPORTED_MODULE_15___default = /*#__PURE__*/__webpack_require__.n(_material_ui_core_styles__WEBPACK_IMPORTED_MODULE_15__);
/* harmony import */ var _material_ui_core_Toolbar__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! @material-ui/core/Toolbar */ "@material-ui/core/Toolbar");
/* harmony import */ var _material_ui_core_Toolbar__WEBPACK_IMPORTED_MODULE_16___default = /*#__PURE__*/__webpack_require__.n(_material_ui_core_Toolbar__WEBPACK_IMPORTED_MODULE_16__);
/* harmony import */ var _material_ui_core_Typography__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! @material-ui/core/Typography */ "@material-ui/core/Typography");
/* harmony import */ var _material_ui_core_Typography__WEBPACK_IMPORTED_MODULE_17___default = /*#__PURE__*/__webpack_require__.n(_material_ui_core_Typography__WEBPACK_IMPORTED_MODULE_17__);
/* harmony import */ var _material_ui_icons_Visibility__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! @material-ui/icons/Visibility */ "@material-ui/icons/Visibility");
/* harmony import */ var _material_ui_icons_Visibility__WEBPACK_IMPORTED_MODULE_18___default = /*#__PURE__*/__webpack_require__.n(_material_ui_icons_Visibility__WEBPACK_IMPORTED_MODULE_18__);
/* harmony import */ var _material_ui_icons_ExitToApp__WEBPACK_IMPORTED_MODULE_19__ = __webpack_require__(/*! @material-ui/icons/ExitToApp */ "@material-ui/icons/ExitToApp");
/* harmony import */ var _material_ui_icons_ExitToApp__WEBPACK_IMPORTED_MODULE_19___default = /*#__PURE__*/__webpack_require__.n(_material_ui_icons_ExitToApp__WEBPACK_IMPORTED_MODULE_19__);
/* harmony import */ var _material_ui_icons_Refresh__WEBPACK_IMPORTED_MODULE_20__ = __webpack_require__(/*! @material-ui/icons/Refresh */ "@material-ui/icons/Refresh");
/* harmony import */ var _material_ui_icons_Refresh__WEBPACK_IMPORTED_MODULE_20___default = /*#__PURE__*/__webpack_require__.n(_material_ui_icons_Refresh__WEBPACK_IMPORTED_MODULE_20__);
/* harmony import */ var _material_ui_icons_Send__WEBPACK_IMPORTED_MODULE_21__ = __webpack_require__(/*! @material-ui/icons/Send */ "@material-ui/icons/Send");
/* harmony import */ var _material_ui_icons_Send__WEBPACK_IMPORTED_MODULE_21___default = /*#__PURE__*/__webpack_require__.n(_material_ui_icons_Send__WEBPACK_IMPORTED_MODULE_21__);
/* harmony import */ var _components_StelaForm__WEBPACK_IMPORTED_MODULE_22__ = __webpack_require__(/*! ../components/StelaForm */ "./components/StelaForm.tsx");
/* harmony import */ var _index__WEBPACK_IMPORTED_MODULE_23__ = __webpack_require__(/*! ./index */ "./pages/index.tsx");









var _jsxFileName = "/Users/sarakusha/WebstormProjects/@nata/packages/stela/pages/dashboard.tsx";















var drawerWidth = 240;

var styles = function styles(theme) {
  return Object(_material_ui_core_styles__WEBPACK_IMPORTED_MODULE_15__["createStyles"])({
    root: {// backgroundColor: theme.palette.background.default,
      // maxWidth: 800,
    },
    frame: {
      backgroundColor: 'black',
      marginLeft: 5,
      marginRight: 5
    },
    paperFrame: {
      // ...theme.mixins.gutters(),
      paddingTop: 5,
      paddingBottom: 5
    },
    drawer: Object(_babel_runtime_corejs2_helpers_esm_defineProperty__WEBPACK_IMPORTED_MODULE_8__["default"])({}, theme.breakpoints.up('sm'), {
      width: drawerWidth,
      flexShrink: 0
    }),
    appBar: {// [theme.breakpoints.up('sm')]: {
      //   width: `calc(100% - ${drawerWidth}px)`,
      //   marginRight: drawerWidth,
      // },
    },
    menuButton: Object(_babel_runtime_corejs2_helpers_esm_defineProperty__WEBPACK_IMPORTED_MODULE_8__["default"])({
      marginRight: 10
    }, theme.breakpoints.up('sm'), {
      display: 'none'
    }),
    toolbar: theme.mixins.toolbar,
    drawerPaper: {
      width: drawerWidth
    },
    content: Object(_babel_runtime_corejs2_helpers_esm_defineProperty__WEBPACK_IMPORTED_MODULE_8__["default"])({
      flexGrow: 1,
      padding: theme.spacing.unit * 3
    }, theme.breakpoints.down('xs'), {
      padding: 0
    }),
    row: {
      display: 'flex'
    },
    title: {
      flexGrow: 1
    },
    right: {
      flexShrink: 0,
      marginLeft: theme.spacing.unit,
      marginRight: theme.spacing.unit
    }
  });
};

var Dashboard =
/*#__PURE__*/
function (_PureComponent) {
  Object(_babel_runtime_corejs2_helpers_esm_inherits__WEBPACK_IMPORTED_MODULE_7__["default"])(Dashboard, _PureComponent);

  function Dashboard() {
    var _getPrototypeOf2;

    var _this;

    Object(_babel_runtime_corejs2_helpers_esm_classCallCheck__WEBPACK_IMPORTED_MODULE_2__["default"])(this, Dashboard);

    for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
      args[_key] = arguments[_key];
    }

    _this = Object(_babel_runtime_corejs2_helpers_esm_possibleConstructorReturn__WEBPACK_IMPORTED_MODULE_4__["default"])(this, (_getPrototypeOf2 = Object(_babel_runtime_corejs2_helpers_esm_getPrototypeOf__WEBPACK_IMPORTED_MODULE_5__["default"])(Dashboard)).call.apply(_getPrototypeOf2, [this].concat(args)));

    Object(_babel_runtime_corejs2_helpers_esm_defineProperty__WEBPACK_IMPORTED_MODULE_8__["default"])(Object(_babel_runtime_corejs2_helpers_esm_assertThisInitialized__WEBPACK_IMPORTED_MODULE_6__["default"])(_this), "submitForm", function () {});

    Object(_babel_runtime_corejs2_helpers_esm_defineProperty__WEBPACK_IMPORTED_MODULE_8__["default"])(Object(_babel_runtime_corejs2_helpers_esm_assertThisInitialized__WEBPACK_IMPORTED_MODULE_6__["default"])(_this), "resetForm", function () {});

    Object(_babel_runtime_corejs2_helpers_esm_defineProperty__WEBPACK_IMPORTED_MODULE_8__["default"])(Object(_babel_runtime_corejs2_helpers_esm_assertThisInitialized__WEBPACK_IMPORTED_MODULE_6__["default"])(_this), "bindSubmitForm", function (submitForm) {
      _this.submitForm = submitForm;
    });

    Object(_babel_runtime_corejs2_helpers_esm_defineProperty__WEBPACK_IMPORTED_MODULE_8__["default"])(Object(_babel_runtime_corejs2_helpers_esm_assertThisInitialized__WEBPACK_IMPORTED_MODULE_6__["default"])(_this), "submittingChanged", function (isSubmitting) {
      _this.setState({
        isSubmitting: isSubmitting
      });
    });

    Object(_babel_runtime_corejs2_helpers_esm_defineProperty__WEBPACK_IMPORTED_MODULE_8__["default"])(Object(_babel_runtime_corejs2_helpers_esm_assertThisInitialized__WEBPACK_IMPORTED_MODULE_6__["default"])(_this), "bindResetForm", function (resetForm) {
      _this.resetForm = resetForm;
    });

    Object(_babel_runtime_corejs2_helpers_esm_defineProperty__WEBPACK_IMPORTED_MODULE_8__["default"])(Object(_babel_runtime_corejs2_helpers_esm_assertThisInitialized__WEBPACK_IMPORTED_MODULE_6__["default"])(_this), "reset", function () {
      _this.resetForm && _this.resetForm();
    });

    Object(_babel_runtime_corejs2_helpers_esm_defineProperty__WEBPACK_IMPORTED_MODULE_8__["default"])(Object(_babel_runtime_corejs2_helpers_esm_assertThisInitialized__WEBPACK_IMPORTED_MODULE_6__["default"])(_this), "state", {
      src: '',
      isOpen: false,
      settingsExpanded: true,
      isSubmitting: true
    });

    Object(_babel_runtime_corejs2_helpers_esm_defineProperty__WEBPACK_IMPORTED_MODULE_8__["default"])(Object(_babel_runtime_corejs2_helpers_esm_assertThisInitialized__WEBPACK_IMPORTED_MODULE_6__["default"])(_this), "handleDrawerToggle", function () {
      _this.setState(function (state) {
        return {
          isOpen: !state.isOpen
        };
      });
    });

    return _this;
  }

  Object(_babel_runtime_corejs2_helpers_esm_createClass__WEBPACK_IMPORTED_MODULE_3__["default"])(Dashboard, [{
    key: "componentDidMount",
    value: function componentDidMount() {// this.setState({ src: `http://${window.location.host}/` });
    }
  }, {
    key: "render",
    value: function render() {
      var _this$props = this.props,
          classes = _this$props.classes,
          update = _this$props.update,
          logout = _this$props.logout,
          values = Object(_babel_runtime_corejs2_helpers_esm_objectWithoutProperties__WEBPACK_IMPORTED_MODULE_1__["default"])(_this$props, ["classes", "update", "logout"]);

      var width = values.width,
          height = values.height,
          title = values.title;
      var _this$state = this.state,
          src = _this$state.src,
          isSubmitting = _this$state.isSubmitting;
      var scale = (drawerWidth - 10) / width;
      var drawer = react__WEBPACK_IMPORTED_MODULE_9___default.a.createElement(_material_ui_core_Paper__WEBPACK_IMPORTED_MODULE_14___default.a, {
        style: {
          height: height * scale + 10
        },
        className: classes.paperFrame,
        __source: {
          fileName: _jsxFileName,
          lineNumber: 139
        },
        __self: this
      }, react__WEBPACK_IMPORTED_MODULE_9___default.a.createElement("div", {
        style: {
          width: width,
          height: height,
          transform: "scale(".concat(scale),
          transformOrigin: 'left top'
        },
        className: classes.frame,
        __source: {
          fileName: _jsxFileName,
          lineNumber: 140
        },
        __self: this
      }, react__WEBPACK_IMPORTED_MODULE_9___default.a.createElement(_index__WEBPACK_IMPORTED_MODULE_23__["default"], Object(_babel_runtime_corejs2_helpers_esm_extends__WEBPACK_IMPORTED_MODULE_0__["default"])({}, values, {
        __source: {
          fileName: _jsxFileName,
          lineNumber: 149
        },
        __self: this
      }))));
      return react__WEBPACK_IMPORTED_MODULE_9___default.a.createElement("div", {
        className: classes.root,
        __source: {
          fileName: _jsxFileName,
          lineNumber: 167
        },
        __self: this
      }, react__WEBPACK_IMPORTED_MODULE_9___default.a.createElement(_material_ui_core_AppBar__WEBPACK_IMPORTED_MODULE_10___default.a, {
        position: "fixed",
        className: classes.appBar,
        __source: {
          fileName: _jsxFileName,
          lineNumber: 168
        },
        __self: this
      }, react__WEBPACK_IMPORTED_MODULE_9___default.a.createElement(_material_ui_core_Toolbar__WEBPACK_IMPORTED_MODULE_16___default.a, {
        __source: {
          fileName: _jsxFileName,
          lineNumber: 169
        },
        __self: this
      }, react__WEBPACK_IMPORTED_MODULE_9___default.a.createElement(_material_ui_core_IconButton__WEBPACK_IMPORTED_MODULE_13___default.a, {
        color: "inherit",
        "aria-label": "Open drawer",
        onClick: this.handleDrawerToggle,
        className: classes.menuButton,
        title: "\u041F\u0440\u043E\u0441\u043C\u043E\u0442\u0440",
        __source: {
          fileName: _jsxFileName,
          lineNumber: 170
        },
        __self: this
      }, react__WEBPACK_IMPORTED_MODULE_9___default.a.createElement(_material_ui_icons_Visibility__WEBPACK_IMPORTED_MODULE_18___default.a, {
        __source: {
          fileName: _jsxFileName,
          lineNumber: 177
        },
        __self: this
      })), react__WEBPACK_IMPORTED_MODULE_9___default.a.createElement(_material_ui_core_Typography__WEBPACK_IMPORTED_MODULE_17___default.a, {
        variant: "h6",
        color: "inherit",
        className: classes.title,
        __source: {
          fileName: _jsxFileName,
          lineNumber: 179
        },
        __self: this
      }, title || 'Стела'), react__WEBPACK_IMPORTED_MODULE_9___default.a.createElement(_material_ui_core_IconButton__WEBPACK_IMPORTED_MODULE_13___default.a, {
        color: "inherit",
        onClick: logout,
        className: classes.right,
        title: "\u0412\u044B\u0439\u0442\u0438",
        "aria-label": "Log Out",
        __source: {
          fileName: _jsxFileName,
          lineNumber: 186
        },
        __self: this
      }, react__WEBPACK_IMPORTED_MODULE_9___default.a.createElement(_material_ui_icons_ExitToApp__WEBPACK_IMPORTED_MODULE_19___default.a, {
        __source: {
          fileName: _jsxFileName,
          lineNumber: 193
        },
        __self: this
      })), react__WEBPACK_IMPORTED_MODULE_9___default.a.createElement(_material_ui_core_IconButton__WEBPACK_IMPORTED_MODULE_13___default.a, {
        color: "inherit",
        onClick: this.reset,
        className: classes.right,
        title: "\u0421\u0431\u0440\u043E\u0441\u0438\u0442\u044C",
        "aria-label": "Reset form",
        __source: {
          fileName: _jsxFileName,
          lineNumber: 195
        },
        __self: this
      }, react__WEBPACK_IMPORTED_MODULE_9___default.a.createElement(_material_ui_icons_Refresh__WEBPACK_IMPORTED_MODULE_20___default.a, {
        __source: {
          fileName: _jsxFileName,
          lineNumber: 202
        },
        __self: this
      })), react__WEBPACK_IMPORTED_MODULE_9___default.a.createElement(_material_ui_core_IconButton__WEBPACK_IMPORTED_MODULE_13___default.a, {
        color: "inherit",
        onClick: this.submitForm,
        className: classes.right,
        disabled: isSubmitting,
        title: "\u041E\u0442\u043F\u0440\u0430\u0432\u0438\u0442\u044C",
        "aria-label": "Send data",
        __source: {
          fileName: _jsxFileName,
          lineNumber: 204
        },
        __self: this
      }, react__WEBPACK_IMPORTED_MODULE_9___default.a.createElement(_material_ui_icons_Send__WEBPACK_IMPORTED_MODULE_21___default.a, {
        __source: {
          fileName: _jsxFileName,
          lineNumber: 212
        },
        __self: this
      })))), react__WEBPACK_IMPORTED_MODULE_9___default.a.createElement("main", {
        className: classes.content,
        __source: {
          fileName: _jsxFileName,
          lineNumber: 216
        },
        __self: this
      }, react__WEBPACK_IMPORTED_MODULE_9___default.a.createElement("div", {
        className: classes.toolbar,
        __source: {
          fileName: _jsxFileName,
          lineNumber: 217
        },
        __self: this
      }), react__WEBPACK_IMPORTED_MODULE_9___default.a.createElement("div", {
        style: {
          display: 'flex',
          flexDirection: 'row',
          justifyContent: 'center'
        },
        __source: {
          fileName: _jsxFileName,
          lineNumber: 218
        },
        __self: this
      }, react__WEBPACK_IMPORTED_MODULE_9___default.a.createElement(_components_StelaForm__WEBPACK_IMPORTED_MODULE_22__["default"], Object(_babel_runtime_corejs2_helpers_esm_extends__WEBPACK_IMPORTED_MODULE_0__["default"])({}, values, {
        update: update,
        bindSubmitForm: this.bindSubmitForm,
        submittingChanged: this.submittingChanged,
        bindResetForm: this.bindResetForm,
        __source: {
          fileName: _jsxFileName,
          lineNumber: 225
        },
        __self: this
      })), react__WEBPACK_IMPORTED_MODULE_9___default.a.createElement("aside", {
        __source: {
          fileName: _jsxFileName,
          lineNumber: 232
        },
        __self: this
      }, react__WEBPACK_IMPORTED_MODULE_9___default.a.createElement(_material_ui_core_Hidden__WEBPACK_IMPORTED_MODULE_12___default.a, {
        xsDown: true,
        __source: {
          fileName: _jsxFileName,
          lineNumber: 233
        },
        __self: this
      }, react__WEBPACK_IMPORTED_MODULE_9___default.a.createElement("div", {
        style: {
          width: 240
        },
        __source: {
          fileName: _jsxFileName,
          lineNumber: 234
        },
        __self: this
      }, drawer))))), react__WEBPACK_IMPORTED_MODULE_9___default.a.createElement("nav", {
        className: classes.drawer,
        __source: {
          fileName: _jsxFileName,
          lineNumber: 241
        },
        __self: this
      }, react__WEBPACK_IMPORTED_MODULE_9___default.a.createElement(_material_ui_core_Hidden__WEBPACK_IMPORTED_MODULE_12___default.a, {
        smUp: true,
        __source: {
          fileName: _jsxFileName,
          lineNumber: 242
        },
        __self: this
      }, react__WEBPACK_IMPORTED_MODULE_9___default.a.createElement(_material_ui_core_Drawer__WEBPACK_IMPORTED_MODULE_11___default.a, {
        variant: "temporary",
        open: this.state.isOpen,
        onClose: this.handleDrawerToggle,
        classes: {
          paper: classes.drawerPaper
        },
        anchor: "right",
        __source: {
          fileName: _jsxFileName,
          lineNumber: 243
        },
        __self: this
      }, react__WEBPACK_IMPORTED_MODULE_9___default.a.createElement("div", {
        className: classes.toolbar,
        __source: {
          fileName: _jsxFileName,
          lineNumber: 252
        },
        __self: this
      }), drawer))));
    }
  }], [{
    key: "getInitialProps",
    value: function getInitialProps() {
      return {
        isNeedLogin: true
      };
    }
  }]);

  return Dashboard;
}(react__WEBPACK_IMPORTED_MODULE_9__["PureComponent"]);

Object(_babel_runtime_corejs2_helpers_esm_defineProperty__WEBPACK_IMPORTED_MODULE_8__["default"])(Dashboard, "defaultProps", {
  width: 160,
  height: 320
});

/* harmony default export */ __webpack_exports__["default"] = (Object(_material_ui_core_styles__WEBPACK_IMPORTED_MODULE_15__["withStyles"])(styles)(Dashboard));

/***/ }),

/***/ "./pages/index.tsx":
/*!*************************!*\
  !*** ./pages/index.tsx ***!
  \*************************/
/*! exports provided: default */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony import */ var styled_jsx_style__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! styled-jsx/style */ "../../node_modules/styled-jsx/style.js");
/* harmony import */ var styled_jsx_style__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(styled_jsx_style__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! react */ "react");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(react__WEBPACK_IMPORTED_MODULE_1__);
var _jsxFileName = "/Users/sarakusha/WebstormProjects/@nata/packages/stela/pages/index.tsx";



// type Omit<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>;
var Stela = function Stela(props) {
  var width = props.width,
      height = props.height,
      isBold = props.isBold,
      title = props.title,
      titleColor = props.titleColor,
      titleSize = props.titleSize,
      nameColor = props.nameColor,
      nameSize = props.nameSize,
      subColor = props.subColor,
      subSize = props.subSize,
      priceColor = props.priceColor,
      priceSize = props.priceSize,
      backgroundColor = props.backgroundColor,
      isCondensed = props.isCondensed,
      lineHeight = props.lineHeight,
      items = props.items,
      paddingTop = props.paddingTop,
      fontName = props.fontName;
  return react__WEBPACK_IMPORTED_MODULE_1___default.a.createElement("div", {
    className: "jsx-789581391 " + styled_jsx_style__WEBPACK_IMPORTED_MODULE_0___default.a.dynamic([["668886214", [lineHeight, paddingTop, width, height, backgroundColor, isBold ? 'bold' : 'inherited', fontName === 'Ubuntu' ? "Ubuntu".concat(isCondensed ? ' Condensed' : '') : fontName, titleColor || 'inherited', title ? 'inherit' : 'none', titleSize, nameColor, nameSize, subSize, fontName === 'Ubuntu' ? 'Ubuntu Condensed' : fontName, subColor, priceColor, priceSize]]]) + " " + 'stela',
    __source: {
      fileName: _jsxFileName,
      lineNumber: 28
    },
    __self: this
  }, react__WEBPACK_IMPORTED_MODULE_1___default.a.createElement("h3", {
    className: "jsx-789581391 " + styled_jsx_style__WEBPACK_IMPORTED_MODULE_0___default.a.dynamic([["668886214", [lineHeight, paddingTop, width, height, backgroundColor, isBold ? 'bold' : 'inherited', fontName === 'Ubuntu' ? "Ubuntu".concat(isCondensed ? ' Condensed' : '') : fontName, titleColor || 'inherited', title ? 'inherit' : 'none', titleSize, nameColor, nameSize, subSize, fontName === 'Ubuntu' ? 'Ubuntu Condensed' : fontName, subColor, priceColor, priceSize]]]),
    __source: {
      fileName: _jsxFileName,
      lineNumber: 29
    },
    __self: this
  }, title), react__WEBPACK_IMPORTED_MODULE_1___default.a.createElement("ul", {
    className: "jsx-789581391 " + styled_jsx_style__WEBPACK_IMPORTED_MODULE_0___default.a.dynamic([["668886214", [lineHeight, paddingTop, width, height, backgroundColor, isBold ? 'bold' : 'inherited', fontName === 'Ubuntu' ? "Ubuntu".concat(isCondensed ? ' Condensed' : '') : fontName, titleColor || 'inherited', title ? 'inherit' : 'none', titleSize, nameColor, nameSize, subSize, fontName === 'Ubuntu' ? 'Ubuntu Condensed' : fontName, subColor, priceColor, priceSize]]]),
    __source: {
      fileName: _jsxFileName,
      lineNumber: 30
    },
    __self: this
  }, items.filter(function (item) {
    return item.isVisible;
  }).map(function (item, index) {
    // const neon = item.effect === Effect.neon;
    return react__WEBPACK_IMPORTED_MODULE_1___default.a.createElement("li", {
      key: item.id || index,
      className: "jsx-789581391 " + styled_jsx_style__WEBPACK_IMPORTED_MODULE_0___default.a.dynamic([["668886214", [lineHeight, paddingTop, width, height, backgroundColor, isBold ? 'bold' : 'inherited', fontName === 'Ubuntu' ? "Ubuntu".concat(isCondensed ? ' Condensed' : '') : fontName, titleColor || 'inherited', title ? 'inherit' : 'none', titleSize, nameColor, nameSize, subSize, fontName === 'Ubuntu' ? 'Ubuntu Condensed' : fontName, subColor, priceColor, priceSize]]]),
      __source: {
        fileName: _jsxFileName,
        lineNumber: 35
      },
      __self: this
    }, react__WEBPACK_IMPORTED_MODULE_1___default.a.createElement("div", {
      className: "jsx-789581391 " + styled_jsx_style__WEBPACK_IMPORTED_MODULE_0___default.a.dynamic([["668886214", [lineHeight, paddingTop, width, height, backgroundColor, isBold ? 'bold' : 'inherited', fontName === 'Ubuntu' ? "Ubuntu".concat(isCondensed ? ' Condensed' : '') : fontName, titleColor || 'inherited', title ? 'inherit' : 'none', titleSize, nameColor, nameSize, subSize, fontName === 'Ubuntu' ? 'Ubuntu Condensed' : fontName, subColor, priceColor, priceSize]]]) + " " + "name",
      __source: {
        fileName: _jsxFileName,
        lineNumber: 37
      },
      __self: this
    }, item.name), item.subName && react__WEBPACK_IMPORTED_MODULE_1___default.a.createElement("div", {
      className: "jsx-789581391 " + styled_jsx_style__WEBPACK_IMPORTED_MODULE_0___default.a.dynamic([["668886214", [lineHeight, paddingTop, width, height, backgroundColor, isBold ? 'bold' : 'inherited', fontName === 'Ubuntu' ? "Ubuntu".concat(isCondensed ? ' Condensed' : '') : fontName, titleColor || 'inherited', title ? 'inherit' : 'none', titleSize, nameColor, nameSize, subSize, fontName === 'Ubuntu' ? 'Ubuntu Condensed' : fontName, subColor, priceColor, priceSize]]]) + " " + "sub",
      __source: {
        fileName: _jsxFileName,
        lineNumber: 38
      },
      __self: this
    }, item.subName), react__WEBPACK_IMPORTED_MODULE_1___default.a.createElement("div", {
      className: "jsx-789581391 " + styled_jsx_style__WEBPACK_IMPORTED_MODULE_0___default.a.dynamic([["668886214", [lineHeight, paddingTop, width, height, backgroundColor, isBold ? 'bold' : 'inherited', fontName === 'Ubuntu' ? "Ubuntu".concat(isCondensed ? ' Condensed' : '') : fontName, titleColor || 'inherited', title ? 'inherit' : 'none', titleSize, nameColor, nameSize, subSize, fontName === 'Ubuntu' ? 'Ubuntu Condensed' : fontName, subColor, priceColor, priceSize]]]) + " " + "price",
      __source: {
        fileName: _jsxFileName,
        lineNumber: 39
      },
      __self: this
    }, Number(item.price).toFixed(2)));
  })), react__WEBPACK_IMPORTED_MODULE_1___default.a.createElement(styled_jsx_style__WEBPACK_IMPORTED_MODULE_0___default.a, {
    id: "668886214",
    dynamic: [lineHeight, paddingTop, width, height, backgroundColor, isBold ? 'bold' : 'inherited', fontName === 'Ubuntu' ? "Ubuntu".concat(isCondensed ? ' Condensed' : '') : fontName, titleColor || 'inherited', title ? 'inherit' : 'none', titleSize, nameColor, nameSize, subSize, fontName === 'Ubuntu' ? 'Ubuntu Condensed' : fontName, subColor, priceColor, priceSize],
    __self: this
  }, ".stela.__jsx-style-dynamic-selector{line-height:".concat(lineHeight, ";padding-top:").concat(paddingTop, "px;width:").concat(width, "px;height:").concat(height, "px;background:").concat(backgroundColor, ";color:white;font-weight:").concat(isBold ? 'bold' : 'inherited', ";padding-left:2px;padding-right:2px;-webkit-font-smoothing:antialiased;font-family:").concat(fontName === 'Ubuntu' ? "Ubuntu".concat(isCondensed ? ' Condensed' : '') : fontName, ",sans-serif;overflow:hidden;}h3.__jsx-style-dynamic-selector{color:").concat(titleColor || 'inherited', ";display:").concat(title ? 'inherit' : 'none', ";text-align:center;font-size:").concat(titleSize, "px;}li.__jsx-style-dynamic-selector{display:-webkit-box;display:-webkit-flex;display:-ms-flexbox;display:flex;}li.__jsx-style-dynamic-selector>*.__jsx-style-dynamic-selector{-webkit-align-self:baseline;-ms-flex-item-align:baseline;align-self:baseline;}.name.__jsx-style-dynamic-selector{-webkit-flex:0 0;-ms-flex:0 0;flex:0 0;margin-right:2px;color:").concat(nameColor, ";font-size:").concat(nameSize, "px;}.sub.__jsx-style-dynamic-selector{overflow:hidden;white-space:nowrap;font-size:").concat(subSize, "px;font-weight:normal;font-family:").concat(fontName === 'Ubuntu' ? 'Ubuntu Condensed' : fontName, ",sans-serif;color:").concat(subColor, ";}.price.__jsx-style-dynamic-selector{-webkit-flex:1 0;-ms-flex:1 0;flex:1 0;text-align:right;color:").concat(priceColor, ";font-size:").concat(priceSize, "px;}.neon.__jsx-style-dynamic-selector{-webkit-animation:neon-__jsx-style-dynamic-selector 1.5s ease-in-out infinite alternate;animation:neon-__jsx-style-dynamic-selector 1.5s ease-in-out infinite alternate;}@-webkit-keyframes neon-__jsx-style-dynamic-selector{from{text-shadow: 0 0 10px #fff, 0 0 20px #fff, 0 0 30px #fff, 0 0 40px #f17, 0 0 70px #f17, 0 0 80px #f17, 0 0 100px #f17, 0 0 150px #f17;}to{text-shadow: 0 0 5px #fff, 0 0 10px #fff, 0 0 15px #fff, 0 0 20px #F17, 0 0 35px #F17, 0 0 40px #F17, 0 0 50px #F17, 0 0 75px #F17;}}@keyframes neon-__jsx-style-dynamic-selector{from{text-shadow: 0 0 10px #fff, 0 0 20px #fff, 0 0 30px #fff, 0 0 40px #f17, 0 0 70px #f17, 0 0 80px #f17, 0 0 100px #f17, 0 0 150px #f17;}to{text-shadow: 0 0 5px #fff, 0 0 10px #fff, 0 0 15px #fff, 0 0 20px #F17, 0 0 35px #F17, 0 0 40px #F17, 0 0 50px #F17, 0 0 75px #F17;}}\n/*# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi9Vc2Vycy9zYXJha3VzaGEvV2Vic3Rvcm1Qcm9qZWN0cy9AbmF0YS9wYWNrYWdlcy9zdGVsYS9wYWdlcy9pbmRleC50c3giXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBOENrQixBQUdzRCxBQWlCTixBQU90QixBQUlPLEFBSVgsQUFPTyxBQVNQLEFBTzBDLEFBYWpDLEFBWUQsZ0JBeENFLG1CQXRCa0IsQUF1QkssSUFSekIsQUFnQkEsRUFoRDBCLGVBaUNQLEFBZ0JBLGdCQS9CbEIsRUFNcEIsR0FJQSxBQWFxQixPQXhDa0IsTUFrQkksRUFlQyxBQWdCQSxJQVJZLHlCQXhDaEIsVUFrQnhDLEFBNERFLEdBN0NGLEFBZ0JBLEFBaUJFLGVBekJvQyxVQXhDSSxTQW9EMUMsaUJBWEEsY0F4Q2MsWUFDNkIseUNBQ3hCLGlCQUNDLGtCQUNpQixtQ0FDa0Isb0RBRXJDLGdCQUVsQiIsImZpbGUiOiIvVXNlcnMvc2FyYWt1c2hhL1dlYnN0b3JtUHJvamVjdHMvQG5hdGEvcGFja2FnZXMvc3RlbGEvcGFnZXMvaW5kZXgudHN4Iiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IFJlYWN0IGZyb20gJ3JlYWN0JztcbmltcG9ydCB7IC8qIEVmZmVjdCwgKi8gU3RlbGFQcm9wcyB9IGZyb20gJy4uL3NyYy9zdGVsYSc7XG5cbi8vIHR5cGUgT21pdDxULCBLIGV4dGVuZHMga2V5b2YgVD4gPSBQaWNrPFQsIEV4Y2x1ZGU8a2V5b2YgVCwgSz4+O1xuY29uc3QgU3RlbGEgPSAocHJvcHM6IFN0ZWxhUHJvcHMpID0+IHtcbiAgY29uc3Qge1xuICAgIHdpZHRoLFxuICAgIGhlaWdodCxcbiAgICBpc0JvbGQsXG4gICAgdGl0bGUsXG4gICAgdGl0bGVDb2xvcixcbiAgICB0aXRsZVNpemUsXG4gICAgbmFtZUNvbG9yLFxuICAgIG5hbWVTaXplLFxuICAgIHN1YkNvbG9yLFxuICAgIHN1YlNpemUsXG4gICAgcHJpY2VDb2xvcixcbiAgICBwcmljZVNpemUsXG4gICAgYmFja2dyb3VuZENvbG9yLFxuICAgIGlzQ29uZGVuc2VkLFxuICAgIGxpbmVIZWlnaHQsXG4gICAgaXRlbXMsXG4gICAgcGFkZGluZ1RvcCxcbiAgICBmb250TmFtZSxcbiAgICAvLyBub3RHbG9iYWwgPSBmYWxzZSxcbiAgfSA9IHByb3BzO1xuICByZXR1cm4gKFxuICAgIDxkaXYgY2xhc3NOYW1lPXsnc3RlbGEnfT5cbiAgICAgIDxoMz57dGl0bGV9PC9oMz5cbiAgICAgIDx1bD5cbiAgICAgICAge2l0ZW1zLmZpbHRlcihpdGVtID0+IGl0ZW0uaXNWaXNpYmxlKS5tYXAoKGl0ZW0sIGluZGV4KSA9PiB7XG4gICAgICAgICAgLy8gY29uc3QgbmVvbiA9IGl0ZW0uZWZmZWN0ID09PSBFZmZlY3QubmVvbjtcbiAgICAgICAgICAvLyBjb25zb2xlLmxvZygnSVRFTScsIGl0ZW0pO1xuICAgICAgICAgIHJldHVybiAoXG4gICAgICAgICAgICA8bGkga2V5PXtpdGVtLmlkIHx8IGluZGV4fT5cbiAgICAgICAgICAgICAgey8qPGRpdiBjbGFzc05hbWU9e2NsYXNzTmFtZXMoJ25hbWUnLCB7IG5lb24gfSl9PntpdGVtLm5hbWV9PC9kaXY+Ki99XG4gICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwibmFtZVwiPntpdGVtLm5hbWV9PC9kaXY+XG4gICAgICAgICAgICAgIHtpdGVtLnN1Yk5hbWUgJiYgPGRpdiBjbGFzc05hbWU9XCJzdWJcIj57aXRlbS5zdWJOYW1lfTwvZGl2Pn1cbiAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJwcmljZVwiPlxuICAgICAgICAgICAgICAgIHtOdW1iZXIoaXRlbS5wcmljZSkudG9GaXhlZCgyKX1cbiAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICA8L2xpPlxuICAgICAgICAgICk7XG4gICAgICAgIH0pfVxuICAgICAgPC91bD5cbiAgICAgIHsvKiBsYW5ndWFnZT1DU1MgKi99XG4gICAgICA8c3R5bGUganN4PntgXG4gICAgICAgICAgLnN0ZWxhIHtcbiAgICAgICAgICAgIGxpbmUtaGVpZ2h0OiAke2xpbmVIZWlnaHR9O1xuICAgICAgICAgICAgcGFkZGluZy10b3A6ICR7cGFkZGluZ1RvcH1weDtcbiAgICAgICAgICAgIHdpZHRoOiAke3dpZHRofXB4O1xuICAgICAgICAgICAgaGVpZ2h0OiAke2hlaWdodH1weDtcbiAgICAgICAgICAgIGJhY2tncm91bmQ6ICR7YmFja2dyb3VuZENvbG9yfTtcbiAgICAgICAgICAgIGNvbG9yOiB3aGl0ZTtcbiAgICAgICAgICAgIGZvbnQtd2VpZ2h0OiAke2lzQm9sZCA/ICdib2xkJyA6ICdpbmhlcml0ZWQnfTtcbiAgICAgICAgICAgIHBhZGRpbmctbGVmdDogMnB4O1xuICAgICAgICAgICAgcGFkZGluZy1yaWdodDogMnB4O1xuICAgICAgICAgICAgLXdlYmtpdC1mb250LXNtb290aGluZzogYW50aWFsaWFzZWQ7XG4gICAgICAgICAgICBmb250LWZhbWlseTogJHtmb250TmFtZSA9PT0gJ1VidW50dSdcbiAgICAgICAgPyBgVWJ1bnR1JHtpc0NvbmRlbnNlZCA/ICcgQ29uZGVuc2VkJyA6ICcnfWBcbiAgICAgICAgOiBmb250TmFtZX0sIHNhbnMtc2VyaWY7XG4gICAgICAgICAgICAvKmZvbnQtZmFtaWx5OiBMQ0Rub3ZhLCBzYW5zLXNlcmlmOyovXG4gICAgICAgICAgICBvdmVyZmxvdzogaGlkZGVuO1xuICAgICAgICAgICAgLypmb250LXNpemU6IDI4cHg7Ki9cbiAgICAgICAgICB9XG5cbiAgICAgICAgICBoMyB7XG4gICAgICAgICAgICBjb2xvcjogJHt0aXRsZUNvbG9yIHx8ICdpbmhlcml0ZWQnfTtcbiAgICAgICAgICAgIGRpc3BsYXk6ICR7dGl0bGUgPyAnaW5oZXJpdCcgOiAnbm9uZSd9O1xuICAgICAgICAgICAgdGV4dC1hbGlnbjogY2VudGVyO1xuICAgICAgICAgICAgZm9udC1zaXplOiAke3RpdGxlU2l6ZX1weDtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBsaSB7XG4gICAgICAgICAgICBkaXNwbGF5OiBmbGV4O1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGxpID4gKiB7XG4gICAgICAgICAgICBhbGlnbi1zZWxmOiBiYXNlbGluZTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICAubmFtZSB7XG4gICAgICAgICAgICBmbGV4OiAwIDA7XG4gICAgICAgICAgICBtYXJnaW4tcmlnaHQ6IDJweDtcbiAgICAgICAgICAgIGNvbG9yOiAke25hbWVDb2xvcn07XG4gICAgICAgICAgICBmb250LXNpemU6ICR7bmFtZVNpemV9cHg7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgLnN1YiB7XG4gICAgICAgICAgICBvdmVyZmxvdzogaGlkZGVuO1xuICAgICAgICAgICAgd2hpdGUtc3BhY2U6IG5vd3JhcDtcbiAgICAgICAgICAgIGZvbnQtc2l6ZTogJHtzdWJTaXplfXB4O1xuICAgICAgICAgICAgZm9udC13ZWlnaHQ6IG5vcm1hbDtcbiAgICAgICAgICAgIGZvbnQtZmFtaWx5OiAke2ZvbnROYW1lID09PSAnVWJ1bnR1JyA/ICdVYnVudHUgQ29uZGVuc2VkJyA6IGZvbnROYW1lfSwgc2Fucy1zZXJpZjtcbiAgICAgICAgICAgIGNvbG9yOiAke3N1YkNvbG9yfTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICAucHJpY2Uge1xuICAgICAgICAgICAgZmxleDogMSAwO1xuICAgICAgICAgICAgdGV4dC1hbGlnbjogcmlnaHQ7XG4gICAgICAgICAgICBjb2xvcjogJHtwcmljZUNvbG9yfTtcbiAgICAgICAgICAgIGZvbnQtc2l6ZTogJHtwcmljZVNpemV9cHg7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgLm5lb24ge1xuICAgICAgICAgICAgYW5pbWF0aW9uOiBuZW9uIDEuNXMgZWFzZS1pbi1vdXQgaW5maW5pdGUgYWx0ZXJuYXRlO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIEBrZXlmcmFtZXMgbmVvbiB7XG4gICAgICAgICAgICBmcm9tIHtcbiAgICAgICAgICAgICAgdGV4dC1zaGFkb3c6XG4gICAgICAgICAgICAgICAgMCAwIDEwcHggI2ZmZixcbiAgICAgICAgICAgICAgICAwIDAgMjBweCAjZmZmLFxuICAgICAgICAgICAgICAgIDAgMCAzMHB4ICNmZmYsXG4gICAgICAgICAgICAgICAgMCAwIDQwcHggI2YxNyxcbiAgICAgICAgICAgICAgICAwIDAgNzBweCAjZjE3LFxuICAgICAgICAgICAgICAgIDAgMCA4MHB4ICNmMTcsXG4gICAgICAgICAgICAgICAgMCAwIDEwMHB4ICNmMTcsXG4gICAgICAgICAgICAgICAgMCAwIDE1MHB4ICNmMTc7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHRvIHtcbiAgICAgICAgICAgICAgdGV4dC1zaGFkb3c6XG4gICAgICAgICAgICAgICAgMCAwIDVweCAjZmZmLFxuICAgICAgICAgICAgICAgIDAgMCAxMHB4ICNmZmYsXG4gICAgICAgICAgICAgICAgMCAwIDE1cHggI2ZmZixcbiAgICAgICAgICAgICAgICAwIDAgMjBweCAjRjE3LFxuICAgICAgICAgICAgICAgIDAgMCAzNXB4ICNGMTcsXG4gICAgICAgICAgICAgICAgMCAwIDQwcHggI0YxNyxcbiAgICAgICAgICAgICAgICAwIDAgNTBweCAjRjE3LFxuICAgICAgICAgICAgICAgIDAgMCA3NXB4ICNGMTc7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICBgfTwvc3R5bGU+XG4gICAgICB7LyogbGFuZ3VhZ2U9Q1NTICovfVxuICAgICAgPHN0eWxlIGdsb2JhbCBqc3g+e2BcbiAgICAgICAgKiB7XG4gICAgICAgICAgbWFyZ2luOiAwO1xuICAgICAgICAgIHBhZGRpbmc6IDA7XG4gICAgICAgICAgYm94LXNpemluZzogYm9yZGVyLWJveDtcbiAgICAgICAgfVxuICAgICAgYH08L3N0eWxlPlxuICAgIDwvZGl2PlxuICApO1xufTtcblxuZXhwb3J0IGRlZmF1bHQgU3RlbGE7XG4iXX0= */\n/*@ sourceURL=/Users/sarakusha/WebstormProjects/@nata/packages/stela/pages/index.tsx */")), react__WEBPACK_IMPORTED_MODULE_1___default.a.createElement(styled_jsx_style__WEBPACK_IMPORTED_MODULE_0___default.a, {
    id: "789581391",
    __self: this
  }, "*{margin:0;padding:0;box-sizing:border-box;}\n/*# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi9Vc2Vycy9zYXJha3VzaGEvV2Vic3Rvcm1Qcm9qZWN0cy9AbmF0YS9wYWNrYWdlcy9zdGVsYS9wYWdlcy9pbmRleC50c3giXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBdUl5QixBQUdvQixTQUNDLFVBQ1ksc0JBQ3hCIiwiZmlsZSI6Ii9Vc2Vycy9zYXJha3VzaGEvV2Vic3Rvcm1Qcm9qZWN0cy9AbmF0YS9wYWNrYWdlcy9zdGVsYS9wYWdlcy9pbmRleC50c3giLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgUmVhY3QgZnJvbSAncmVhY3QnO1xuaW1wb3J0IHsgLyogRWZmZWN0LCAqLyBTdGVsYVByb3BzIH0gZnJvbSAnLi4vc3JjL3N0ZWxhJztcblxuLy8gdHlwZSBPbWl0PFQsIEsgZXh0ZW5kcyBrZXlvZiBUPiA9IFBpY2s8VCwgRXhjbHVkZTxrZXlvZiBULCBLPj47XG5jb25zdCBTdGVsYSA9IChwcm9wczogU3RlbGFQcm9wcykgPT4ge1xuICBjb25zdCB7XG4gICAgd2lkdGgsXG4gICAgaGVpZ2h0LFxuICAgIGlzQm9sZCxcbiAgICB0aXRsZSxcbiAgICB0aXRsZUNvbG9yLFxuICAgIHRpdGxlU2l6ZSxcbiAgICBuYW1lQ29sb3IsXG4gICAgbmFtZVNpemUsXG4gICAgc3ViQ29sb3IsXG4gICAgc3ViU2l6ZSxcbiAgICBwcmljZUNvbG9yLFxuICAgIHByaWNlU2l6ZSxcbiAgICBiYWNrZ3JvdW5kQ29sb3IsXG4gICAgaXNDb25kZW5zZWQsXG4gICAgbGluZUhlaWdodCxcbiAgICBpdGVtcyxcbiAgICBwYWRkaW5nVG9wLFxuICAgIGZvbnROYW1lLFxuICAgIC8vIG5vdEdsb2JhbCA9IGZhbHNlLFxuICB9ID0gcHJvcHM7XG4gIHJldHVybiAoXG4gICAgPGRpdiBjbGFzc05hbWU9eydzdGVsYSd9PlxuICAgICAgPGgzPnt0aXRsZX08L2gzPlxuICAgICAgPHVsPlxuICAgICAgICB7aXRlbXMuZmlsdGVyKGl0ZW0gPT4gaXRlbS5pc1Zpc2libGUpLm1hcCgoaXRlbSwgaW5kZXgpID0+IHtcbiAgICAgICAgICAvLyBjb25zdCBuZW9uID0gaXRlbS5lZmZlY3QgPT09IEVmZmVjdC5uZW9uO1xuICAgICAgICAgIC8vIGNvbnNvbGUubG9nKCdJVEVNJywgaXRlbSk7XG4gICAgICAgICAgcmV0dXJuIChcbiAgICAgICAgICAgIDxsaSBrZXk9e2l0ZW0uaWQgfHwgaW5kZXh9PlxuICAgICAgICAgICAgICB7Lyo8ZGl2IGNsYXNzTmFtZT17Y2xhc3NOYW1lcygnbmFtZScsIHsgbmVvbiB9KX0+e2l0ZW0ubmFtZX08L2Rpdj4qL31cbiAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJuYW1lXCI+e2l0ZW0ubmFtZX08L2Rpdj5cbiAgICAgICAgICAgICAge2l0ZW0uc3ViTmFtZSAmJiA8ZGl2IGNsYXNzTmFtZT1cInN1YlwiPntpdGVtLnN1Yk5hbWV9PC9kaXY+fVxuICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cInByaWNlXCI+XG4gICAgICAgICAgICAgICAge051bWJlcihpdGVtLnByaWNlKS50b0ZpeGVkKDIpfVxuICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgIDwvbGk+XG4gICAgICAgICAgKTtcbiAgICAgICAgfSl9XG4gICAgICA8L3VsPlxuICAgICAgey8qIGxhbmd1YWdlPUNTUyAqL31cbiAgICAgIDxzdHlsZSBqc3g+e2BcbiAgICAgICAgICAuc3RlbGEge1xuICAgICAgICAgICAgbGluZS1oZWlnaHQ6ICR7bGluZUhlaWdodH07XG4gICAgICAgICAgICBwYWRkaW5nLXRvcDogJHtwYWRkaW5nVG9wfXB4O1xuICAgICAgICAgICAgd2lkdGg6ICR7d2lkdGh9cHg7XG4gICAgICAgICAgICBoZWlnaHQ6ICR7aGVpZ2h0fXB4O1xuICAgICAgICAgICAgYmFja2dyb3VuZDogJHtiYWNrZ3JvdW5kQ29sb3J9O1xuICAgICAgICAgICAgY29sb3I6IHdoaXRlO1xuICAgICAgICAgICAgZm9udC13ZWlnaHQ6ICR7aXNCb2xkID8gJ2JvbGQnIDogJ2luaGVyaXRlZCd9O1xuICAgICAgICAgICAgcGFkZGluZy1sZWZ0OiAycHg7XG4gICAgICAgICAgICBwYWRkaW5nLXJpZ2h0OiAycHg7XG4gICAgICAgICAgICAtd2Via2l0LWZvbnQtc21vb3RoaW5nOiBhbnRpYWxpYXNlZDtcbiAgICAgICAgICAgIGZvbnQtZmFtaWx5OiAke2ZvbnROYW1lID09PSAnVWJ1bnR1J1xuICAgICAgICA/IGBVYnVudHUke2lzQ29uZGVuc2VkID8gJyBDb25kZW5zZWQnIDogJyd9YFxuICAgICAgICA6IGZvbnROYW1lfSwgc2Fucy1zZXJpZjtcbiAgICAgICAgICAgIC8qZm9udC1mYW1pbHk6IExDRG5vdmEsIHNhbnMtc2VyaWY7Ki9cbiAgICAgICAgICAgIG92ZXJmbG93OiBoaWRkZW47XG4gICAgICAgICAgICAvKmZvbnQtc2l6ZTogMjhweDsqL1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGgzIHtcbiAgICAgICAgICAgIGNvbG9yOiAke3RpdGxlQ29sb3IgfHwgJ2luaGVyaXRlZCd9O1xuICAgICAgICAgICAgZGlzcGxheTogJHt0aXRsZSA/ICdpbmhlcml0JyA6ICdub25lJ307XG4gICAgICAgICAgICB0ZXh0LWFsaWduOiBjZW50ZXI7XG4gICAgICAgICAgICBmb250LXNpemU6ICR7dGl0bGVTaXplfXB4O1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGxpIHtcbiAgICAgICAgICAgIGRpc3BsYXk6IGZsZXg7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgbGkgPiAqIHtcbiAgICAgICAgICAgIGFsaWduLXNlbGY6IGJhc2VsaW5lO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIC5uYW1lIHtcbiAgICAgICAgICAgIGZsZXg6IDAgMDtcbiAgICAgICAgICAgIG1hcmdpbi1yaWdodDogMnB4O1xuICAgICAgICAgICAgY29sb3I6ICR7bmFtZUNvbG9yfTtcbiAgICAgICAgICAgIGZvbnQtc2l6ZTogJHtuYW1lU2l6ZX1weDtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICAuc3ViIHtcbiAgICAgICAgICAgIG92ZXJmbG93OiBoaWRkZW47XG4gICAgICAgICAgICB3aGl0ZS1zcGFjZTogbm93cmFwO1xuICAgICAgICAgICAgZm9udC1zaXplOiAke3N1YlNpemV9cHg7XG4gICAgICAgICAgICBmb250LXdlaWdodDogbm9ybWFsO1xuICAgICAgICAgICAgZm9udC1mYW1pbHk6ICR7Zm9udE5hbWUgPT09ICdVYnVudHUnID8gJ1VidW50dSBDb25kZW5zZWQnIDogZm9udE5hbWV9LCBzYW5zLXNlcmlmO1xuICAgICAgICAgICAgY29sb3I6ICR7c3ViQ29sb3J9O1xuICAgICAgICAgIH1cblxuICAgICAgICAgIC5wcmljZSB7XG4gICAgICAgICAgICBmbGV4OiAxIDA7XG4gICAgICAgICAgICB0ZXh0LWFsaWduOiByaWdodDtcbiAgICAgICAgICAgIGNvbG9yOiAke3ByaWNlQ29sb3J9O1xuICAgICAgICAgICAgZm9udC1zaXplOiAke3ByaWNlU2l6ZX1weDtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICAubmVvbiB7XG4gICAgICAgICAgICBhbmltYXRpb246IG5lb24gMS41cyBlYXNlLWluLW91dCBpbmZpbml0ZSBhbHRlcm5hdGU7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgQGtleWZyYW1lcyBuZW9uIHtcbiAgICAgICAgICAgIGZyb20ge1xuICAgICAgICAgICAgICB0ZXh0LXNoYWRvdzpcbiAgICAgICAgICAgICAgICAwIDAgMTBweCAjZmZmLFxuICAgICAgICAgICAgICAgIDAgMCAyMHB4ICNmZmYsXG4gICAgICAgICAgICAgICAgMCAwIDMwcHggI2ZmZixcbiAgICAgICAgICAgICAgICAwIDAgNDBweCAjZjE3LFxuICAgICAgICAgICAgICAgIDAgMCA3MHB4ICNmMTcsXG4gICAgICAgICAgICAgICAgMCAwIDgwcHggI2YxNyxcbiAgICAgICAgICAgICAgICAwIDAgMTAwcHggI2YxNyxcbiAgICAgICAgICAgICAgICAwIDAgMTUwcHggI2YxNztcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdG8ge1xuICAgICAgICAgICAgICB0ZXh0LXNoYWRvdzpcbiAgICAgICAgICAgICAgICAwIDAgNXB4ICNmZmYsXG4gICAgICAgICAgICAgICAgMCAwIDEwcHggI2ZmZixcbiAgICAgICAgICAgICAgICAwIDAgMTVweCAjZmZmLFxuICAgICAgICAgICAgICAgIDAgMCAyMHB4ICNGMTcsXG4gICAgICAgICAgICAgICAgMCAwIDM1cHggI0YxNyxcbiAgICAgICAgICAgICAgICAwIDAgNDBweCAjRjE3LFxuICAgICAgICAgICAgICAgIDAgMCA1MHB4ICNGMTcsXG4gICAgICAgICAgICAgICAgMCAwIDc1cHggI0YxNztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIGB9PC9zdHlsZT5cbiAgICAgIHsvKiBsYW5ndWFnZT1DU1MgKi99XG4gICAgICA8c3R5bGUgZ2xvYmFsIGpzeD57YFxuICAgICAgICAqIHtcbiAgICAgICAgICBtYXJnaW46IDA7XG4gICAgICAgICAgcGFkZGluZzogMDtcbiAgICAgICAgICBib3gtc2l6aW5nOiBib3JkZXItYm94O1xuICAgICAgICB9XG4gICAgICBgfTwvc3R5bGU+XG4gICAgPC9kaXY+XG4gICk7XG59O1xuXG5leHBvcnQgZGVmYXVsdCBTdGVsYTtcbiJdfQ== */\n/*@ sourceURL=/Users/sarakusha/WebstormProjects/@nata/packages/stela/pages/index.tsx */"));
};

/* harmony default export */ __webpack_exports__["default"] = (Stela);

/***/ }),

/***/ "./src/timeid.ts":
/*!***********************!*\
  !*** ./src/timeid.ts ***!
  \***********************/
/*! exports provided: default */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "default", function() { return timeid; });
/* harmony import */ var _babel_runtime_corejs2_core_js_date_now__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @babel/runtime-corejs2/core-js/date/now */ "../../node_modules/@babel/runtime-corejs2/core-js/date/now.js");
/* harmony import */ var _babel_runtime_corejs2_core_js_date_now__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(_babel_runtime_corejs2_core_js_date_now__WEBPACK_IMPORTED_MODULE_0__);

var lastTimeid;
function timeid() {
  var time = _babel_runtime_corejs2_core_js_date_now__WEBPACK_IMPORTED_MODULE_0___default()();

  var last = lastTimeid || time;
  return (lastTimeid = time > last ? time : last + 1).toString(36);
}

/***/ }),

/***/ 4:
/*!***********************************!*\
  !*** multi ./pages/dashboard.tsx ***!
  \***********************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

module.exports = __webpack_require__(/*! /Users/sarakusha/WebstormProjects/@nata/packages/stela/pages/dashboard.tsx */"./pages/dashboard.tsx");


/***/ }),

/***/ "@material-ui/core/AppBar":
/*!*******************************************!*\
  !*** external "@material-ui/core/AppBar" ***!
  \*******************************************/
/*! no static exports found */
/***/ (function(module, exports) {

module.exports = require("@material-ui/core/AppBar");

/***/ }),

/***/ "@material-ui/core/Avatar":
/*!*******************************************!*\
  !*** external "@material-ui/core/Avatar" ***!
  \*******************************************/
/*! no static exports found */
/***/ (function(module, exports) {

module.exports = require("@material-ui/core/Avatar");

/***/ }),

/***/ "@material-ui/core/Divider":
/*!********************************************!*\
  !*** external "@material-ui/core/Divider" ***!
  \********************************************/
/*! no static exports found */
/***/ (function(module, exports) {

module.exports = require("@material-ui/core/Divider");

/***/ }),

/***/ "@material-ui/core/Drawer":
/*!*******************************************!*\
  !*** external "@material-ui/core/Drawer" ***!
  \*******************************************/
/*! no static exports found */
/***/ (function(module, exports) {

module.exports = require("@material-ui/core/Drawer");

/***/ }),

/***/ "@material-ui/core/ExpansionPanel":
/*!***************************************************!*\
  !*** external "@material-ui/core/ExpansionPanel" ***!
  \***************************************************/
/*! no static exports found */
/***/ (function(module, exports) {

module.exports = require("@material-ui/core/ExpansionPanel");

/***/ }),

/***/ "@material-ui/core/ExpansionPanelActions":
/*!**********************************************************!*\
  !*** external "@material-ui/core/ExpansionPanelActions" ***!
  \**********************************************************/
/*! no static exports found */
/***/ (function(module, exports) {

module.exports = require("@material-ui/core/ExpansionPanelActions");

/***/ }),

/***/ "@material-ui/core/ExpansionPanelDetails":
/*!**********************************************************!*\
  !*** external "@material-ui/core/ExpansionPanelDetails" ***!
  \**********************************************************/
/*! no static exports found */
/***/ (function(module, exports) {

module.exports = require("@material-ui/core/ExpansionPanelDetails");

/***/ }),

/***/ "@material-ui/core/ExpansionPanelSummary":
/*!**********************************************************!*\
  !*** external "@material-ui/core/ExpansionPanelSummary" ***!
  \**********************************************************/
/*! no static exports found */
/***/ (function(module, exports) {

module.exports = require("@material-ui/core/ExpansionPanelSummary");

/***/ }),

/***/ "@material-ui/core/Fab":
/*!****************************************!*\
  !*** external "@material-ui/core/Fab" ***!
  \****************************************/
/*! no static exports found */
/***/ (function(module, exports) {

module.exports = require("@material-ui/core/Fab");

/***/ }),

/***/ "@material-ui/core/FormControl":
/*!************************************************!*\
  !*** external "@material-ui/core/FormControl" ***!
  \************************************************/
/*! no static exports found */
/***/ (function(module, exports) {

module.exports = require("@material-ui/core/FormControl");

/***/ }),

/***/ "@material-ui/core/FormGroup":
/*!**********************************************!*\
  !*** external "@material-ui/core/FormGroup" ***!
  \**********************************************/
/*! no static exports found */
/***/ (function(module, exports) {

module.exports = require("@material-ui/core/FormGroup");

/***/ }),

/***/ "@material-ui/core/FormLabel":
/*!**********************************************!*\
  !*** external "@material-ui/core/FormLabel" ***!
  \**********************************************/
/*! no static exports found */
/***/ (function(module, exports) {

module.exports = require("@material-ui/core/FormLabel");

/***/ }),

/***/ "@material-ui/core/Hidden":
/*!*******************************************!*\
  !*** external "@material-ui/core/Hidden" ***!
  \*******************************************/
/*! no static exports found */
/***/ (function(module, exports) {

module.exports = require("@material-ui/core/Hidden");

/***/ }),

/***/ "@material-ui/core/IconButton":
/*!***********************************************!*\
  !*** external "@material-ui/core/IconButton" ***!
  \***********************************************/
/*! no static exports found */
/***/ (function(module, exports) {

module.exports = require("@material-ui/core/IconButton");

/***/ }),

/***/ "@material-ui/core/MenuItem":
/*!*********************************************!*\
  !*** external "@material-ui/core/MenuItem" ***!
  \*********************************************/
/*! no static exports found */
/***/ (function(module, exports) {

module.exports = require("@material-ui/core/MenuItem");

/***/ }),

/***/ "@material-ui/core/Paper":
/*!******************************************!*\
  !*** external "@material-ui/core/Paper" ***!
  \******************************************/
/*! no static exports found */
/***/ (function(module, exports) {

module.exports = require("@material-ui/core/Paper");

/***/ }),

/***/ "@material-ui/core/TextField":
/*!**********************************************!*\
  !*** external "@material-ui/core/TextField" ***!
  \**********************************************/
/*! no static exports found */
/***/ (function(module, exports) {

module.exports = require("@material-ui/core/TextField");

/***/ }),

/***/ "@material-ui/core/Toolbar":
/*!********************************************!*\
  !*** external "@material-ui/core/Toolbar" ***!
  \********************************************/
/*! no static exports found */
/***/ (function(module, exports) {

module.exports = require("@material-ui/core/Toolbar");

/***/ }),

/***/ "@material-ui/core/Typography":
/*!***********************************************!*\
  !*** external "@material-ui/core/Typography" ***!
  \***********************************************/
/*! no static exports found */
/***/ (function(module, exports) {

module.exports = require("@material-ui/core/Typography");

/***/ }),

/***/ "@material-ui/core/styles":
/*!*******************************************!*\
  !*** external "@material-ui/core/styles" ***!
  \*******************************************/
/*! no static exports found */
/***/ (function(module, exports) {

module.exports = require("@material-ui/core/styles");

/***/ }),

/***/ "@material-ui/icons/Add":
/*!*****************************************!*\
  !*** external "@material-ui/icons/Add" ***!
  \*****************************************/
/*! no static exports found */
/***/ (function(module, exports) {

module.exports = require("@material-ui/icons/Add");

/***/ }),

/***/ "@material-ui/icons/Clear":
/*!*******************************************!*\
  !*** external "@material-ui/icons/Clear" ***!
  \*******************************************/
/*! no static exports found */
/***/ (function(module, exports) {

module.exports = require("@material-ui/icons/Clear");

/***/ }),

/***/ "@material-ui/icons/ExitToApp":
/*!***********************************************!*\
  !*** external "@material-ui/icons/ExitToApp" ***!
  \***********************************************/
/*! no static exports found */
/***/ (function(module, exports) {

module.exports = require("@material-ui/icons/ExitToApp");

/***/ }),

/***/ "@material-ui/icons/ExpandMore":
/*!************************************************!*\
  !*** external "@material-ui/icons/ExpandMore" ***!
  \************************************************/
/*! no static exports found */
/***/ (function(module, exports) {

module.exports = require("@material-ui/icons/ExpandMore");

/***/ }),

/***/ "@material-ui/icons/Lock":
/*!******************************************!*\
  !*** external "@material-ui/icons/Lock" ***!
  \******************************************/
/*! no static exports found */
/***/ (function(module, exports) {

module.exports = require("@material-ui/icons/Lock");

/***/ }),

/***/ "@material-ui/icons/LockOpen":
/*!**********************************************!*\
  !*** external "@material-ui/icons/LockOpen" ***!
  \**********************************************/
/*! no static exports found */
/***/ (function(module, exports) {

module.exports = require("@material-ui/icons/LockOpen");

/***/ }),

/***/ "@material-ui/icons/Refresh":
/*!*********************************************!*\
  !*** external "@material-ui/icons/Refresh" ***!
  \*********************************************/
/*! no static exports found */
/***/ (function(module, exports) {

module.exports = require("@material-ui/icons/Refresh");

/***/ }),

/***/ "@material-ui/icons/Send":
/*!******************************************!*\
  !*** external "@material-ui/icons/Send" ***!
  \******************************************/
/*! no static exports found */
/***/ (function(module, exports) {

module.exports = require("@material-ui/icons/Send");

/***/ }),

/***/ "@material-ui/icons/Visibility":
/*!************************************************!*\
  !*** external "@material-ui/icons/Visibility" ***!
  \************************************************/
/*! no static exports found */
/***/ (function(module, exports) {

module.exports = require("@material-ui/icons/Visibility");

/***/ }),

/***/ "classnames":
/*!*****************************!*\
  !*** external "classnames" ***!
  \*****************************/
/*! no static exports found */
/***/ (function(module, exports) {

module.exports = require("classnames");

/***/ }),

/***/ "core-js/library/fn/array/is-array":
/*!****************************************************!*\
  !*** external "core-js/library/fn/array/is-array" ***!
  \****************************************************/
/*! no static exports found */
/***/ (function(module, exports) {

module.exports = require("core-js/library/fn/array/is-array");

/***/ }),

/***/ "core-js/library/fn/date/now":
/*!**********************************************!*\
  !*** external "core-js/library/fn/date/now" ***!
  \**********************************************/
/*! no static exports found */
/***/ (function(module, exports) {

module.exports = require("core-js/library/fn/date/now");

/***/ }),

/***/ "core-js/library/fn/get-iterator":
/*!**************************************************!*\
  !*** external "core-js/library/fn/get-iterator" ***!
  \**************************************************/
/*! no static exports found */
/***/ (function(module, exports) {

module.exports = require("core-js/library/fn/get-iterator");

/***/ }),

/***/ "core-js/library/fn/number/is-nan":
/*!***************************************************!*\
  !*** external "core-js/library/fn/number/is-nan" ***!
  \***************************************************/
/*! no static exports found */
/***/ (function(module, exports) {

module.exports = require("core-js/library/fn/number/is-nan");

/***/ }),

/***/ "core-js/library/fn/object/assign":
/*!***************************************************!*\
  !*** external "core-js/library/fn/object/assign" ***!
  \***************************************************/
/*! no static exports found */
/***/ (function(module, exports) {

module.exports = require("core-js/library/fn/object/assign");

/***/ }),

/***/ "core-js/library/fn/object/create":
/*!***************************************************!*\
  !*** external "core-js/library/fn/object/create" ***!
  \***************************************************/
/*! no static exports found */
/***/ (function(module, exports) {

module.exports = require("core-js/library/fn/object/create");

/***/ }),

/***/ "core-js/library/fn/object/define-property":
/*!************************************************************!*\
  !*** external "core-js/library/fn/object/define-property" ***!
  \************************************************************/
/*! no static exports found */
/***/ (function(module, exports) {

module.exports = require("core-js/library/fn/object/define-property");

/***/ }),

/***/ "core-js/library/fn/object/get-own-property-descriptor":
/*!************************************************************************!*\
  !*** external "core-js/library/fn/object/get-own-property-descriptor" ***!
  \************************************************************************/
/*! no static exports found */
/***/ (function(module, exports) {

module.exports = require("core-js/library/fn/object/get-own-property-descriptor");

/***/ }),

/***/ "core-js/library/fn/object/get-own-property-symbols":
/*!*********************************************************************!*\
  !*** external "core-js/library/fn/object/get-own-property-symbols" ***!
  \*********************************************************************/
/*! no static exports found */
/***/ (function(module, exports) {

module.exports = require("core-js/library/fn/object/get-own-property-symbols");

/***/ }),

/***/ "core-js/library/fn/object/get-prototype-of":
/*!*************************************************************!*\
  !*** external "core-js/library/fn/object/get-prototype-of" ***!
  \*************************************************************/
/*! no static exports found */
/***/ (function(module, exports) {

module.exports = require("core-js/library/fn/object/get-prototype-of");

/***/ }),

/***/ "core-js/library/fn/object/keys":
/*!*************************************************!*\
  !*** external "core-js/library/fn/object/keys" ***!
  \*************************************************/
/*! no static exports found */
/***/ (function(module, exports) {

module.exports = require("core-js/library/fn/object/keys");

/***/ }),

/***/ "core-js/library/fn/object/set-prototype-of":
/*!*************************************************************!*\
  !*** external "core-js/library/fn/object/set-prototype-of" ***!
  \*************************************************************/
/*! no static exports found */
/***/ (function(module, exports) {

module.exports = require("core-js/library/fn/object/set-prototype-of");

/***/ }),

/***/ "core-js/library/fn/symbol":
/*!********************************************!*\
  !*** external "core-js/library/fn/symbol" ***!
  \********************************************/
/*! no static exports found */
/***/ (function(module, exports) {

module.exports = require("core-js/library/fn/symbol");

/***/ }),

/***/ "core-js/library/fn/symbol/iterator":
/*!*****************************************************!*\
  !*** external "core-js/library/fn/symbol/iterator" ***!
  \*****************************************************/
/*! no static exports found */
/***/ (function(module, exports) {

module.exports = require("core-js/library/fn/symbol/iterator");

/***/ }),

/***/ "formik":
/*!*************************!*\
  !*** external "formik" ***!
  \*************************/
/*! no static exports found */
/***/ (function(module, exports) {

module.exports = require("formik");

/***/ }),

/***/ "formik-material-ui":
/*!*************************************!*\
  !*** external "formik-material-ui" ***!
  \*************************************/
/*! no static exports found */
/***/ (function(module, exports) {

module.exports = require("formik-material-ui");

/***/ }),

/***/ "lodash/set":
/*!*****************************!*\
  !*** external "lodash/set" ***!
  \*****************************/
/*! no static exports found */
/***/ (function(module, exports) {

module.exports = require("lodash/set");

/***/ }),

/***/ "material-ui-color-picker":
/*!*******************************************!*\
  !*** external "material-ui-color-picker" ***!
  \*******************************************/
/*! no static exports found */
/***/ (function(module, exports) {

module.exports = require("material-ui-color-picker");

/***/ }),

/***/ "react":
/*!************************!*\
  !*** external "react" ***!
  \************************/
/*! no static exports found */
/***/ (function(module, exports) {

module.exports = require("react");

/***/ }),

/***/ "react-beautiful-dnd":
/*!**************************************!*\
  !*** external "react-beautiful-dnd" ***!
  \**************************************/
/*! no static exports found */
/***/ (function(module, exports) {

module.exports = require("react-beautiful-dnd");

/***/ }),

/***/ "recompose":
/*!****************************!*\
  !*** external "recompose" ***!
  \****************************/
/*! no static exports found */
/***/ (function(module, exports) {

module.exports = require("recompose");

/***/ })

/******/ });
//# sourceMappingURL=dashboard.js.map