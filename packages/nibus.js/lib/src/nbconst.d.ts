export declare enum States {
    PREAMBLE_WAITING = 0,
    HEADER_READING = 1,
    DATA_READING = 2
}
export declare enum Offsets {
    DESTINATION = 1,
    SOURCE = 7,
    SERVICE = 13,
    LENGTH = 14,
    PROTOCOL = 15,
    DATA = 16
}
export declare const PREAMBLE = 126;
export declare const SERVICE_INFO_LENGTH = Offsets.DATA;
export declare const MAX_DATA_LENGTH = 238;
export declare const NMS_MAX_DATA_LENGTH = 63;
//# sourceMappingURL=nbconst.d.ts.map