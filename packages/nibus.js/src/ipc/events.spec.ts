import {
  EventFromString,
  PortsEventV,
  IPortsEvent,
  PortAddedEventV,
  IPortAddedEvent,
  PortRemovedEventV,
  IPortRemovedEvent,
  EventV,
} from './events';

const portsEvent = {
  event: 'ports',
  args: [[
    {
      portInfo: {
        comName: 'com1',
        productId: 1,
        vendorId: 2,
      },
      description: { mib: 'test' },
    },
    {
      portInfo: {
        comName: 'com2',
        productId: 1,
        vendorId: 2,
      },
      description: { mib: 'test' },
    },
  ]],
};

const addEvent = {
  event: 'add',
  args: [{
    portInfo: {
      comName: 'com3',
      productId: 1,
      vendorId: 2,
    },
    description: { mib: 'test' },
  }],
};

const removeEvent = {
  event: 'remove',
  args: [{
    portInfo: {
      comName: 'com3',
      productId: 1,
      vendorId: 2,
    },
    description: { mib: 'test' },
  }],
};

const testEvent = {
  event: 'test',
  args: [{
    a: 1,
    b: 2,
  }],
};

const events = [
  portsEvent as IPortsEvent,
  addEvent as IPortAddedEvent,
  removeEvent as IPortRemovedEvent,
];

describe('event tests', () => {
  test('PortsEvent', () => {
    expect(PortsEventV.is(portsEvent)).toBeTruthy();
    expect(PortAddedEventV.is(portsEvent)).toBeFalsy();
    expect(PortRemovedEventV.is(portsEvent)).toBeFalsy();
  });
  test('PortAddedEvent', () => {
    expect(PortsEventV.is(addEvent)).toBeFalsy();
    expect(PortAddedEventV.is(addEvent)).toBeTruthy();
    expect(PortRemovedEventV.is(addEvent)).toBeFalsy();
  });
  test('PortRemovedEvent', () => {
    expect(PortsEventV.is(removeEvent)).toBeFalsy();
    expect(PortAddedEventV.is(removeEvent)).toBeFalsy();
    expect(PortRemovedEventV.is(removeEvent)).toBeTruthy();
  });
  test('Event', () => {
    expect(EventV.is(portsEvent)).toBeTruthy();
    expect(EventV.is(addEvent)).toBeTruthy();
    expect(EventV.is(removeEvent)).toBeTruthy();
  });
  test('invalid event', () => {
    expect(PortsEventV.is(testEvent)).toBeFalsy();
    expect(PortAddedEventV.is(testEvent)).toBeFalsy();
    expect(PortRemovedEventV.is(testEvent)).toBeFalsy();
    expect(EventV.is(testEvent)).toBeFalsy();
  });
  test('stringify', () => {
    events.forEach((event) => {
      expect(EventFromString.encode(event)).toBe(JSON.stringify(event));
    });
  });

  test('parse', () => {
    events.forEach((event) => {
      expect(EventFromString.decode(JSON.stringify(event)).getOrElse(undefined)).toEqual(event);
    });
  });
});
