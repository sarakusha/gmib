"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

require("source-map-support/register");

/*
 * @license
 * Copyright (c) 2019. OOO Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nata" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */
var NmsServiceType;

(function (NmsServiceType) {
  NmsServiceType[NmsServiceType["Invalid"] = -1] = "Invalid";
  NmsServiceType[NmsServiceType["None"] = 0] = "None";
  NmsServiceType[NmsServiceType["Read"] = 1] = "Read";
  NmsServiceType[NmsServiceType["Write"] = 2] = "Write";
  NmsServiceType[NmsServiceType["InformationReport"] = 3] = "InformationReport";
  NmsServiceType[NmsServiceType["EventNotification"] = 4] = "EventNotification";
  NmsServiceType[NmsServiceType["AckEventNotification"] = 5] = "AckEventNotification";
  NmsServiceType[NmsServiceType["AlterEventConditionMonitoring"] = 6] = "AlterEventConditionMonitoring";
  NmsServiceType[NmsServiceType["RequestDomainUpload"] = 7] = "RequestDomainUpload";
  NmsServiceType[NmsServiceType["InitiateUploadSequence"] = 8] = "InitiateUploadSequence";
  NmsServiceType[NmsServiceType["UploadSegment"] = 9] = "UploadSegment";
  NmsServiceType[NmsServiceType["RequestDomainDownload"] = 10] = "RequestDomainDownload";
  NmsServiceType[NmsServiceType["InitiateDownloadSequence"] = 11] = "InitiateDownloadSequence";
  NmsServiceType[NmsServiceType["DownloadSegment"] = 12] = "DownloadSegment";
  NmsServiceType[NmsServiceType["TerminateDownloadSequence"] = 13] = "TerminateDownloadSequence";
  NmsServiceType[NmsServiceType["VerifyDomainChecksum"] = 14] = "VerifyDomainChecksum";
  NmsServiceType[NmsServiceType["ExecuteProgramInvocation"] = 15] = "ExecuteProgramInvocation";
  NmsServiceType[NmsServiceType["StartProgramInvocation"] = 16] = "StartProgramInvocation";
  NmsServiceType[NmsServiceType["Stop"] = 17] = "Stop";
  NmsServiceType[NmsServiceType["Resume"] = 18] = "Resume";
  NmsServiceType[NmsServiceType["Reset"] = 19] = "Reset";
  NmsServiceType[NmsServiceType["Shutdown"] = 20] = "Shutdown";
})(NmsServiceType || (NmsServiceType = {}));

var _default = NmsServiceType;
exports.default = _default;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9ubXMvTm1zU2VydmljZVR5cGUudHMiXSwibmFtZXMiOlsiTm1zU2VydmljZVR5cGUiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7OztBQUFBOzs7Ozs7Ozs7SUFVS0EsYzs7V0FBQUEsYztBQUFBQSxFQUFBQSxjLENBQUFBLGM7QUFBQUEsRUFBQUEsYyxDQUFBQSxjO0FBQUFBLEVBQUFBLGMsQ0FBQUEsYztBQUFBQSxFQUFBQSxjLENBQUFBLGM7QUFBQUEsRUFBQUEsYyxDQUFBQSxjO0FBQUFBLEVBQUFBLGMsQ0FBQUEsYztBQUFBQSxFQUFBQSxjLENBQUFBLGM7QUFBQUEsRUFBQUEsYyxDQUFBQSxjO0FBQUFBLEVBQUFBLGMsQ0FBQUEsYztBQUFBQSxFQUFBQSxjLENBQUFBLGM7QUFBQUEsRUFBQUEsYyxDQUFBQSxjO0FBQUFBLEVBQUFBLGMsQ0FBQUEsYztBQUFBQSxFQUFBQSxjLENBQUFBLGM7QUFBQUEsRUFBQUEsYyxDQUFBQSxjO0FBQUFBLEVBQUFBLGMsQ0FBQUEsYztBQUFBQSxFQUFBQSxjLENBQUFBLGM7QUFBQUEsRUFBQUEsYyxDQUFBQSxjO0FBQUFBLEVBQUFBLGMsQ0FBQUEsYztBQUFBQSxFQUFBQSxjLENBQUFBLGM7QUFBQUEsRUFBQUEsYyxDQUFBQSxjO0FBQUFBLEVBQUFBLGMsQ0FBQUEsYztBQUFBQSxFQUFBQSxjLENBQUFBLGM7R0FBQUEsYyxLQUFBQSxjOztlQXlCVUEsYyIsInNvdXJjZXNDb250ZW50IjpbIi8qXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IChjKSAyMDE5LiBPT08gTmF0YS1JbmZvXG4gKiBAYXV0aG9yIEFuZHJlaSBTYXJha2VldiA8YXZzQG5hdGEtaW5mby5ydT5cbiAqXG4gKiBUaGlzIGZpbGUgaXMgcGFydCBvZiB0aGUgXCJAbmF0YVwiIHByb2plY3QuXG4gKiBGb3IgdGhlIGZ1bGwgY29weXJpZ2h0IGFuZCBsaWNlbnNlIGluZm9ybWF0aW9uLCBwbGVhc2Ugdmlld1xuICogdGhlIEVVTEEgZmlsZSB0aGF0IHdhcyBkaXN0cmlidXRlZCB3aXRoIHRoaXMgc291cmNlIGNvZGUuXG4gKi9cblxuZW51bSBObXNTZXJ2aWNlVHlwZSB7XG4gIEludmFsaWQgPSAtMSxcbiAgTm9uZSA9IDAsXG4gIFJlYWQgPSAxLFxuICBXcml0ZSA9IDIsXG4gIEluZm9ybWF0aW9uUmVwb3J0ID0gMyxcbiAgRXZlbnROb3RpZmljYXRpb24gPSA0LFxuICBBY2tFdmVudE5vdGlmaWNhdGlvbiA9IDUsXG4gIEFsdGVyRXZlbnRDb25kaXRpb25Nb25pdG9yaW5nID0gNixcbiAgUmVxdWVzdERvbWFpblVwbG9hZCA9IDcsXG4gIEluaXRpYXRlVXBsb2FkU2VxdWVuY2UgPSA4LFxuICBVcGxvYWRTZWdtZW50ID0gOSxcbiAgUmVxdWVzdERvbWFpbkRvd25sb2FkID0gMTAsXG4gIEluaXRpYXRlRG93bmxvYWRTZXF1ZW5jZSA9IDExLFxuICBEb3dubG9hZFNlZ21lbnQgPSAxMixcbiAgVGVybWluYXRlRG93bmxvYWRTZXF1ZW5jZSA9IDEzLFxuICBWZXJpZnlEb21haW5DaGVja3N1bSA9IDE0LFxuICBFeGVjdXRlUHJvZ3JhbUludm9jYXRpb24gPSAxNSxcbiAgU3RhcnRQcm9ncmFtSW52b2NhdGlvbiA9IDE2LFxuICBTdG9wID0gMTcsXG4gIFJlc3VtZSA9IDE4LFxuICBSZXNldCA9IDE5LFxuICBTaHV0ZG93biA9IDIwLFxufVxuXG5leHBvcnQgZGVmYXVsdCBObXNTZXJ2aWNlVHlwZTtcbiJdfQ==