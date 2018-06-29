export enum States {
  PREAMBLE_WAITING = 0,
  HEADER_READING = 1,
  DATA_READING = 2,
}

export enum Offsets {
  DESTINATION = 1,
  SOURCE = 7,
  SERVICE = 13,
  LENGTH = 14,
  PROTOCOL = 15,
  DATA = 16,
}

export const PREAMBLE = 0x7E;
export const SERVICE_INFO_LENGTH = Offsets.DATA;
export const MAX_DATA_LENGTH = 238;
export const NMS_MAX_DATA_LENGTH = 63;
