"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.KnownPortV = exports.CategoryV = void 0;

require("source-map-support/register");

var t = _interopRequireWildcard(require("io-ts"));

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) { var desc = Object.defineProperty && Object.getOwnPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : {}; if (desc.get || desc.set) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } } newObj.default = obj; return newObj; } }

/*
 * @license
 * Copyright (c) 2019. OOO Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nata" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */

/* tslint:disable:variable-name */
const CategoryV = t.union([t.keyof({
  siolynx: null,
  minihost: null,
  fancontrol: null,
  c22: null,
  relay: null,
  ftdi: null,
  undefined: null
}), t.undefined]);
exports.CategoryV = CategoryV;
const KnownPortV = t.intersection([t.type({
  comName: t.string,
  productId: t.number,
  vendorId: t.number
}), t.partial({
  manufacturer: t.string,
  serialNumber: t.string,
  pnpId: t.string,
  locationId: t.string,
  deviceAddress: t.number,
  device: t.string,
  category: CategoryV
})]); // export const FindKindV = t.keyof({
//   sarp: null,
//   version: null,
// }, 'FindKind');
// export type FindKind = t.TypeOf<typeof FindKindV>;
//
// export const NibusBaudRateV = t.union(
//   [t.literal(115200), t.literal(57600), t.literal(28800)],
//   'NibusBaudRate',
// );
//
// export const NibusParityV = t.keyof(
//   {
//     none: null,
//     even: null,
//     mark: null,
//   },
//   'NibusParity',
// );
// export type NibusBaudRate = t.TypeOf<typeof NibusBaudRateV>;
// export type NibusParity = t.TypeOf<typeof NibusParityV>;
//
// export const MibDescriptionV = t.partial({
//   type: t.number,
//   mib: t.string,
//   link: t.boolean,
//   baudRate: NibusBaudRateV,
//   parity: NibusParityV,
//   category: t.string,
//   find: FindKindV,
//   disableBatchReading: t.boolean,
//   select: t.array(t.string),
// });
//
// export interface IMibDescription extends t.TypeOf<typeof MibDescriptionV> {
//   baudRate?: NibusBaudRate;
//   parity?: NibusParity;
//   find?: FindKind;
// }

exports.KnownPortV = KnownPortV;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9zZXNzaW9uL0tub3duUG9ydHMudHMiXSwibmFtZXMiOlsiQ2F0ZWdvcnlWIiwidCIsInVuaW9uIiwia2V5b2YiLCJzaW9seW54IiwibWluaWhvc3QiLCJmYW5jb250cm9sIiwiYzIyIiwicmVsYXkiLCJmdGRpIiwidW5kZWZpbmVkIiwiS25vd25Qb3J0ViIsImludGVyc2VjdGlvbiIsInR5cGUiLCJjb21OYW1lIiwic3RyaW5nIiwicHJvZHVjdElkIiwibnVtYmVyIiwidmVuZG9ySWQiLCJwYXJ0aWFsIiwibWFudWZhY3R1cmVyIiwic2VyaWFsTnVtYmVyIiwicG5wSWQiLCJsb2NhdGlvbklkIiwiZGV2aWNlQWRkcmVzcyIsImRldmljZSIsImNhdGVnb3J5Il0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7QUFXQTs7OztBQVhBOzs7Ozs7Ozs7O0FBVUE7QUFLTyxNQUFNQSxTQUFTLEdBQUdDLENBQUMsQ0FBQ0MsS0FBRixDQUFRLENBQy9CRCxDQUFDLENBQUNFLEtBQUYsQ0FBUTtBQUNOQyxFQUFBQSxPQUFPLEVBQUUsSUFESDtBQUVOQyxFQUFBQSxRQUFRLEVBQUUsSUFGSjtBQUdOQyxFQUFBQSxVQUFVLEVBQUUsSUFITjtBQUlOQyxFQUFBQSxHQUFHLEVBQUUsSUFKQztBQUtOQyxFQUFBQSxLQUFLLEVBQUUsSUFMRDtBQU1OQyxFQUFBQSxJQUFJLEVBQUUsSUFOQTtBQU9OQyxFQUFBQSxTQUFTLEVBQUU7QUFQTCxDQUFSLENBRCtCLEVBVS9CVCxDQUFDLENBQUNTLFNBVjZCLENBQVIsQ0FBbEI7O0FBYUEsTUFBTUMsVUFBVSxHQUFHVixDQUFDLENBQUNXLFlBQUYsQ0FBZSxDQUN2Q1gsQ0FBQyxDQUFDWSxJQUFGLENBQU87QUFDTEMsRUFBQUEsT0FBTyxFQUFFYixDQUFDLENBQUNjLE1BRE47QUFFTEMsRUFBQUEsU0FBUyxFQUFFZixDQUFDLENBQUNnQixNQUZSO0FBR0xDLEVBQUFBLFFBQVEsRUFBRWpCLENBQUMsQ0FBQ2dCO0FBSFAsQ0FBUCxDQUR1QyxFQU12Q2hCLENBQUMsQ0FBQ2tCLE9BQUYsQ0FBVTtBQUNSQyxFQUFBQSxZQUFZLEVBQUVuQixDQUFDLENBQUNjLE1BRFI7QUFFUk0sRUFBQUEsWUFBWSxFQUFFcEIsQ0FBQyxDQUFDYyxNQUZSO0FBR1JPLEVBQUFBLEtBQUssRUFBRXJCLENBQUMsQ0FBQ2MsTUFIRDtBQUlSUSxFQUFBQSxVQUFVLEVBQUV0QixDQUFDLENBQUNjLE1BSk47QUFLUlMsRUFBQUEsYUFBYSxFQUFFdkIsQ0FBQyxDQUFDZ0IsTUFMVDtBQU1SUSxFQUFBQSxNQUFNLEVBQUV4QixDQUFDLENBQUNjLE1BTkY7QUFPUlcsRUFBQUEsUUFBUSxFQUFFMUI7QUFQRixDQUFWLENBTnVDLENBQWYsQ0FBbkIsQyxDQW1CUDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJzb3VyY2VzQ29udGVudCI6WyIvKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCAoYykgMjAxOS4gT09PIE5hdGEtSW5mb1xuICogQGF1dGhvciBBbmRyZWkgU2FyYWtlZXYgPGF2c0BuYXRhLWluZm8ucnU+XG4gKlxuICogVGhpcyBmaWxlIGlzIHBhcnQgb2YgdGhlIFwiQG5hdGFcIiBwcm9qZWN0LlxuICogRm9yIHRoZSBmdWxsIGNvcHlyaWdodCBhbmQgbGljZW5zZSBpbmZvcm1hdGlvbiwgcGxlYXNlIHZpZXdcbiAqIHRoZSBFVUxBIGZpbGUgdGhhdCB3YXMgZGlzdHJpYnV0ZWQgd2l0aCB0aGlzIHNvdXJjZSBjb2RlLlxuICovXG5cbi8qIHRzbGludDpkaXNhYmxlOnZhcmlhYmxlLW5hbWUgKi9cbmltcG9ydCAqIGFzIHQgZnJvbSAnaW8tdHMnO1xuLy8gaW1wb3J0IHsgTmlidXNCYXVkUmF0ZSwgTmlidXNCYXVkUmF0ZVYgfSBmcm9tICcuLi9uaWJ1cyc7XG5cbmV4cG9ydCB0eXBlIEhleE9yTnVtYmVyID0gc3RyaW5nIHwgbnVtYmVyO1xuZXhwb3J0IGNvbnN0IENhdGVnb3J5ViA9IHQudW5pb24oW1xuICB0LmtleW9mKHtcbiAgICBzaW9seW54OiBudWxsLFxuICAgIG1pbmlob3N0OiBudWxsLFxuICAgIGZhbmNvbnRyb2w6IG51bGwsXG4gICAgYzIyOiBudWxsLFxuICAgIHJlbGF5OiBudWxsLFxuICAgIGZ0ZGk6IG51bGwsXG4gICAgdW5kZWZpbmVkOiBudWxsLFxuICB9KSxcbiAgdC51bmRlZmluZWQsXG5dKTtcbmV4cG9ydCB0eXBlIENhdGVnb3J5ID0gdC5UeXBlT2Y8dHlwZW9mIENhdGVnb3J5Vj47XG5leHBvcnQgY29uc3QgS25vd25Qb3J0ViA9IHQuaW50ZXJzZWN0aW9uKFtcbiAgdC50eXBlKHtcbiAgICBjb21OYW1lOiB0LnN0cmluZyxcbiAgICBwcm9kdWN0SWQ6IHQubnVtYmVyLFxuICAgIHZlbmRvcklkOiB0Lm51bWJlcixcbiAgfSksXG4gIHQucGFydGlhbCh7XG4gICAgbWFudWZhY3R1cmVyOiB0LnN0cmluZyxcbiAgICBzZXJpYWxOdW1iZXI6IHQuc3RyaW5nLFxuICAgIHBucElkOiB0LnN0cmluZyxcbiAgICBsb2NhdGlvbklkOiB0LnN0cmluZyxcbiAgICBkZXZpY2VBZGRyZXNzOiB0Lm51bWJlcixcbiAgICBkZXZpY2U6IHQuc3RyaW5nLFxuICAgIGNhdGVnb3J5OiBDYXRlZ29yeVYsXG4gIH0pLFxuXSk7XG5cbmV4cG9ydCBpbnRlcmZhY2UgSUtub3duUG9ydCBleHRlbmRzIHQuVHlwZU9mPHR5cGVvZiBLbm93blBvcnRWPiB7fVxuXG4vLyBleHBvcnQgY29uc3QgRmluZEtpbmRWID0gdC5rZXlvZih7XG4vLyAgIHNhcnA6IG51bGwsXG4vLyAgIHZlcnNpb246IG51bGwsXG4vLyB9LCAnRmluZEtpbmQnKTtcbi8vIGV4cG9ydCB0eXBlIEZpbmRLaW5kID0gdC5UeXBlT2Y8dHlwZW9mIEZpbmRLaW5kVj47XG4vL1xuLy8gZXhwb3J0IGNvbnN0IE5pYnVzQmF1ZFJhdGVWID0gdC51bmlvbihcbi8vICAgW3QubGl0ZXJhbCgxMTUyMDApLCB0LmxpdGVyYWwoNTc2MDApLCB0LmxpdGVyYWwoMjg4MDApXSxcbi8vICAgJ05pYnVzQmF1ZFJhdGUnLFxuLy8gKTtcbi8vXG4vLyBleHBvcnQgY29uc3QgTmlidXNQYXJpdHlWID0gdC5rZXlvZihcbi8vICAge1xuLy8gICAgIG5vbmU6IG51bGwsXG4vLyAgICAgZXZlbjogbnVsbCxcbi8vICAgICBtYXJrOiBudWxsLFxuLy8gICB9LFxuLy8gICAnTmlidXNQYXJpdHknLFxuLy8gKTtcblxuLy8gZXhwb3J0IHR5cGUgTmlidXNCYXVkUmF0ZSA9IHQuVHlwZU9mPHR5cGVvZiBOaWJ1c0JhdWRSYXRlVj47XG4vLyBleHBvcnQgdHlwZSBOaWJ1c1Bhcml0eSA9IHQuVHlwZU9mPHR5cGVvZiBOaWJ1c1Bhcml0eVY+O1xuLy9cbi8vIGV4cG9ydCBjb25zdCBNaWJEZXNjcmlwdGlvblYgPSB0LnBhcnRpYWwoe1xuLy8gICB0eXBlOiB0Lm51bWJlcixcbi8vICAgbWliOiB0LnN0cmluZyxcbi8vICAgbGluazogdC5ib29sZWFuLFxuLy8gICBiYXVkUmF0ZTogTmlidXNCYXVkUmF0ZVYsXG4vLyAgIHBhcml0eTogTmlidXNQYXJpdHlWLFxuLy8gICBjYXRlZ29yeTogdC5zdHJpbmcsXG4vLyAgIGZpbmQ6IEZpbmRLaW5kVixcbi8vICAgZGlzYWJsZUJhdGNoUmVhZGluZzogdC5ib29sZWFuLFxuLy8gICBzZWxlY3Q6IHQuYXJyYXkodC5zdHJpbmcpLFxuLy8gfSk7XG4vL1xuLy8gZXhwb3J0IGludGVyZmFjZSBJTWliRGVzY3JpcHRpb24gZXh0ZW5kcyB0LlR5cGVPZjx0eXBlb2YgTWliRGVzY3JpcHRpb25WPiB7XG4vLyAgIGJhdWRSYXRlPzogTmlidXNCYXVkUmF0ZTtcbi8vICAgcGFyaXR5PzogTmlidXNQYXJpdHk7XG4vLyAgIGZpbmQ/OiBGaW5kS2luZDtcbi8vIH1cbiJdfQ==