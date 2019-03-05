"use strict";

var _events = require("./events");

const portsEvent = {
  event: 'ports',
  args: [[{
    portInfo: {
      comName: 'com1',
      productId: 1,
      vendorId: 2
    },
    description: {
      mib: 'test'
    }
  }, {
    portInfo: {
      comName: 'com2',
      productId: 1,
      vendorId: 2
    },
    description: {
      mib: 'test'
    }
  }]]
};
const addEvent = {
  event: 'add',
  args: [{
    portInfo: {
      comName: 'com3',
      productId: 1,
      vendorId: 2
    },
    description: {
      mib: 'test'
    }
  }]
};
const removeEvent = {
  event: 'remove',
  args: [{
    portInfo: {
      comName: 'com3',
      productId: 1,
      vendorId: 2
    },
    description: {
      mib: 'test'
    }
  }]
};
const testEvent = {
  event: 'test',
  args: [{
    a: 1,
    b: 2
  }]
};
const events = [portsEvent, addEvent, removeEvent];
describe('event tests', () => {
  test('PortsEvent', () => {
    expect(_events.PortsEventV.is(portsEvent)).toBeTruthy();
    expect(_events.PortAddedEventV.is(portsEvent)).toBeFalsy();
    expect(_events.PortRemovedEventV.is(portsEvent)).toBeFalsy();
  });
  test('PortAddedEvent', () => {
    expect(_events.PortsEventV.is(addEvent)).toBeFalsy();
    expect(_events.PortAddedEventV.is(addEvent)).toBeTruthy();
    expect(_events.PortRemovedEventV.is(addEvent)).toBeFalsy();
  });
  test('PortRemovedEvent', () => {
    expect(_events.PortsEventV.is(removeEvent)).toBeFalsy();
    expect(_events.PortAddedEventV.is(removeEvent)).toBeFalsy();
    expect(_events.PortRemovedEventV.is(removeEvent)).toBeTruthy();
  });
  test('Event', () => {
    expect(_events.EventV.is(portsEvent)).toBeTruthy();
    expect(_events.EventV.is(addEvent)).toBeTruthy();
    expect(_events.EventV.is(removeEvent)).toBeTruthy();
  });
  test('invalid event', () => {
    expect(_events.PortsEventV.is(testEvent)).toBeFalsy();
    expect(_events.PortAddedEventV.is(testEvent)).toBeFalsy();
    expect(_events.PortRemovedEventV.is(testEvent)).toBeFalsy();
    expect(_events.EventV.is(testEvent)).toBeFalsy();
  });
  test('stringify', () => {
    events.forEach(event => {
      expect(_events.EventFromString.encode(event)).toBe(JSON.stringify(event));
    });
  });
  test('parse', () => {
    events.forEach(event => {
      expect(_events.EventFromString.decode(JSON.stringify(event)).getOrElse(undefined)).toEqual(event);
    });
  });
});