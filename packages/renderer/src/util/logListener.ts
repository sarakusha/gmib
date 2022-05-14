import TypedEventTarget from './TypedEventTarget';

type LogEvents = {
  line: (line: string) => void;
};

export default new TypedEventTarget<LogEvents>('logger');
