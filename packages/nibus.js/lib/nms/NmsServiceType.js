"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
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