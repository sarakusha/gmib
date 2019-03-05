"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.EventFromString = exports.EventFromStringType = exports.FromStringType = exports.EventV = exports.PortRemovedEventV = exports.PortAddedEventV = exports.PortsEventV = exports.PortArgV = void 0;

var t = _interopRequireWildcard(require("io-ts"));

var _ioTsTypes = require("io-ts-types");

var _KnownPorts = require("../service/KnownPorts");

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) { var desc = Object.defineProperty && Object.getOwnPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : {}; if (desc.get || desc.set) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } } newObj.default = obj; return newObj; } }

/* tslint:disable:variable-name */
const eventType = (name, a, b) => t.type({
  event: t.literal(name),
  args: b ? t.tuple([a, b]) : t.tuple([a])
});

const PortArgV = t.type({
  portInfo: _KnownPorts.KnownPortV,
  description: _KnownPorts.MibDescriptionV
});
exports.PortArgV = PortArgV;
const PortsEventV = eventType('ports', t.array(PortArgV));
exports.PortsEventV = PortsEventV;
const PortAddedEventV = eventType('add', PortArgV);
exports.PortAddedEventV = PortAddedEventV;
const PortRemovedEventV = eventType('remove', PortArgV);
exports.PortRemovedEventV = PortRemovedEventV;
const EventV = t.taggedUnion('event', [PortsEventV, PortAddedEventV, PortRemovedEventV]);
exports.EventV = EventV;

class FromStringType extends t.Type {
  constructor(name, type) {
    super(name, type.is, (m, c) => {
      const jsonValidation = _ioTsTypes.JSONFromString.validate(m, c);

      if (jsonValidation.isLeft()) {
        return jsonValidation;
      }

      const {
        value
      } = jsonValidation;
      return type.validate(value, c);
    }, JSON.stringify);
  }

}

exports.FromStringType = FromStringType;

class EventFromStringType extends FromStringType {
  constructor() {
    super('EventFromString', EventV);
  }

}

exports.EventFromStringType = EventFromStringType;
const EventFromString = new EventFromStringType();
exports.EventFromString = EventFromString;