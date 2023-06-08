export type CandidateMessage = {
  event: 'candidate';
  candidate: RTCIceCandidateInit | null;
  sourceId: number;
};

export type OfferMessage = {
  event: 'offer';
  desc: RTCSessionDescriptionInit;
  sourceId: number;
};

export type AnswerMessage = {
  event: 'answer';
  desc: RTCSessionDescriptionInit;
  sourceId: number;
};

export type RequestMessage = {
  event: 'request';
  sourceId: number;
};

export type DurationMessage = {
  event: 'duration';
  value: number;
};

export type PositionMessage = {
  event: 'position';
  value: number;
};

export type RtcMessage = CandidateMessage | OfferMessage | AnswerMessage | RequestMessage;

export type WithWebSocketKey<T extends RtcMessage> = T & {
  id: string;
};
