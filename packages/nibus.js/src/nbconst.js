export const States = Object.freeze({
  PREAMBLE_WAITING: 0,
  HEADER_READING: 1,
  DATA_READING: 2,
});

export const Offsets = Object.freeze({
  DESTINATION: 0,
  SOURCE: 6,
  SERVICE: 12,
  LENGTH: 13,
  PROTOCOL: 14,
  DATA: 15,
});

export const PREAMBLE = 0x7E;
export const SERVICE_INFO_LENGTH = Offsets.DATA;
export const MAX_DATA_LENGTH = 238;
export const NMS_MAX_DATA_LENGTH = 63;
