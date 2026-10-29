import type { GmibApi } from '../preload/gmib';
import type { PlayerApi } from '../preload/player';
import type { RemoteApi } from '../preload/remote';

type Equal<Left, Right> =
  (<T>() => T extends Left ? 1 : 2) extends <T>() => T extends Right ? 1 : 2 ? true : false;
type Assert<Value extends true> = Value;
type IsAny<Value> = 0 extends 1 & Value ? true : false;

// Checked by typecheck: renderer contracts must stay tied to the real preload API,
// including methods that are absent in either local playback or remote preview.
export type PreloadContractAssertions = [
  Assert<Equal<Window['identify'], GmibApi['identify']>>,
  Assert<Equal<Window['identify'], PlayerApi['identify']>>,
  Assert<Equal<Window['identify'], RemoteApi['identify']>>,
  Assert<Equal<Window['setDispatch'], RemoteApi['setDispatch']>>,
  Assert<Equal<Window['log'], PlayerApi['log']>>,
  Assert<Equal<Window['log'], RemoteApi['log']>>,
  Assert<Equal<Window['nibus']['ping'], GmibApi['nibus']['ping']>>,
  Assert<Equal<IsAny<ReturnType<Window['nibus']['ping']>>, false>>,
  Assert<
    Equal<Window['mediaStream']['updateSrcObject'], PlayerApi['mediaStream']['updateSrcObject']>
  >,
  Assert<
    Equal<Window['mediaStream']['updateSrcObject'], RemoteApi['mediaStream']['updateSrcObject']>
  >,
  Assert<Equal<Window['mediaStream']['seek'], PlayerApi['mediaStream']['seek'] | undefined>>,
  Assert<
    Equal<Window['mediaStream']['reconnect'], RemoteApi['mediaStream']['reconnect'] | undefined>
  >,
  Assert<
    Equal<
      Window['mediaStream']['clearSrcObject'],
      RemoteApi['mediaStream']['clearSrcObject'] | undefined
    >
  >,
];
