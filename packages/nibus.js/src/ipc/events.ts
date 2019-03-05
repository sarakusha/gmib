/* tslint:disable:variable-name */
import * as t from 'io-ts';
import { IMibDescription } from '../service';
import { JSONFromString } from 'io-ts-types';
import { Mixed } from 'io-ts/lib';
import { IKnownPort, KnownPortV, MibDescriptionV } from '../service/KnownPorts';

const eventType = <A extends Mixed, B extends Mixed>(name: string, a: A, b?: B) => t.type({
  event: t.literal(name),
  args: b ? t.tuple([a, b]) : t.tuple([a]),
});

export const PortArgV = t.type({
  portInfo: KnownPortV,
  description: MibDescriptionV,
});

export interface IPortArg extends t.TypeOf<typeof PortArgV> {
  portInfo: IKnownPort;
  description: IMibDescription;
}

export const PortsEventV = eventType('ports', t.array(PortArgV));

export interface IPortsEvent extends t.TypeOf<typeof PortsEventV> {}

export const PortAddedEventV = eventType('add', PortArgV);

export interface IPortAddedEvent extends t.TypeOf<typeof PortAddedEventV> {}

export const PortRemovedEventV = eventType('remove', PortArgV);

export interface IPortRemovedEvent extends t.TypeOf<typeof PortRemovedEventV> {}

export const EventV = t.taggedUnion('event', [PortsEventV, PortAddedEventV, PortRemovedEventV]);

export type Event = IPortsEvent | IPortAddedEvent | IPortRemovedEvent;

export class FromStringType<A> extends t.Type<A, string, unknown> {
  constructor(name: string, type: Mixed) {
    super(
      name,
      type.is,
      (m, c) => {
        const jsonValidation = JSONFromString.validate(m, c);
        if (jsonValidation.isLeft()) {
          return jsonValidation as any;
        }
        const { value } = jsonValidation;
        return type.validate(value, c);
      },
      JSON.stringify,
    );
  }
}

export class EventFromStringType extends FromStringType<Event> {
  constructor() {
    super('EventFromString', EventV);
  }
}

export const EventFromString = new EventFromStringType();
