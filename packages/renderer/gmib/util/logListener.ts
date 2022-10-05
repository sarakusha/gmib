import TypedEventTarget from '../../common/TypedEventTarget';

type LogEvents = {
  line: (line: string) => void;
};

export default new TypedEventTarget<LogEvents>('logger');
