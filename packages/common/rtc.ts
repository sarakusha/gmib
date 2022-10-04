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

export type RtcMessage = CandidateMessage | OfferMessage | AnswerMessage;

export type WithWebSocketKey<T extends RtcMessage> = T & {
  id: string;
};
