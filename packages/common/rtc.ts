export type SourceType = 'player' | 'screen';
export type CandidateMessage = {
  event: 'candidate';
  candidate: RTCIceCandidateInit | null;
  sourceId: number;
  sourceType: SourceType;
};

export type OfferMessage = {
  event: 'offer';
  desc: RTCSessionDescriptionInit;
  sourceId: number;
  sourceType: SourceType;
};

export type AnswerMessage = {
  event: 'answer';
  desc: RTCSessionDescriptionInit;
  sourceId: number;
  sourceType: SourceType;
};

export type RequestMessage = {
  event: 'request';
  sourceId: number;
  sourceType: SourceType;
};

export type RtcMessage = CandidateMessage | OfferMessage | AnswerMessage | RequestMessage;

export type WithWebSocketKey<T extends RtcMessage> = T & {
  id: string;
};
