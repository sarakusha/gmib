/*
 * @license
 * Copyright (c) 2019. OOO Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nata" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */

enum NmsValueType {
  Unknown = 0,
  Boolean = 11,
  Int8 = 16,
  Int16 = 2,
  Int32 = 3,
  Int64 = 20,
  UInt8 = 17,
  UInt16 = 18,
  UInt32 = 19,
  UInt64 = 21,
  Real32 = 4,
  Real64 = 5,
  String = 30,
  DateTime = 7,
  Array = 0x80,
  BooleanArray = Boolean | Array,
  Int8Array = Int8 | Array,
  Int16Array = Int16 | Array,
  Int32Array = Int32 | Array,
  Int64Array = Int64 | Array,
  UInt8Array = UInt8 | Array,
  UInt16Array = UInt16 | Array,
  UInt32Array = UInt32 | Array,
  UInt64Array = UInt64 | Array,
  Real32Array = Real32 | Array,
  Real64Array = Real64 | Array,
}

export default NmsValueType;
