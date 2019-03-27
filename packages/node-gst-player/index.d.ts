/// <reference types="node" />
import { EventEmitter } from 'events';
export declare class Player extends EventEmitter {
    static discover(playlist: string[], cb?: (error: Error | null, result: object) => void): Promise<object>;
    constructor(output?: string, screen?: number);
    playlist: string[];
    screen: number;
    width: number;
    height: number;
    left: number;
    top: number;
    output: string;
    preferredOutputModel?: string;
    loop: boolean;
    readonly currentUri: string;
    current: number;
    volume: number;
    mute: boolean;
    readonly state: PlayerState;
    readonly position: number;
    accurateSeek: boolean;
    readonly duration: number;
    readonly total: number;
    audioEnabled: boolean;
    subtitleEnabled:boolean;
    letterboxing: boolean;
    readonly origin: string;

    show(): void;
    hide(): void;
    play(): void;
    pause(): void;
    stop(): void;
    seek(): void;
    updateCurrient(index: number): void;

    on(event: 'changed', callback: (propName: 'string') => void): this;
    on(event: 'EOS', callback: () => void): this;
    on(event: 'EOP', callback: () => void): this;
    on(event: 'error', callback: (error: string) => void): this;
    on(event: 'bus-error', callback: (error: string) => void): this;
    on(event: 'warning', callback: (warn: string) => void): this;
    on(event: 'position', callback: (msec: number, percent: number) => void): this;
    on(event: 'seek-done', callback: (seconds: number) => void): this;
    on(event: 'state-changed', callback: (state: string) => void): this;
    on(event: 'uri-loaded', callback: (filename: string) => void): this;
}

type Direction = 'normal' | 'left' | 'inverted' | 'right';
type Reflection = 'x' | 'y' | 'xy';
type xid = number;
type PlayerState = 'stopped' | 'paused' | 'playing';

interface Mode {
    x?: number;
    y?: number;
    direction?: Direction;
    reflection?: Reflection;
    mode?: number | string;
    rate?: number;
    primary?: boolean;
    scaleX?: number;
    scaleY?: number;
}

interface  Xrandr {
    getOutputs(): any;
    setOutputMode(output: xid | string, mode: number | string | Mode, screen?: number): boolean;
}

export declare function close(): void;
export declare const xrandr: Xrandr;
