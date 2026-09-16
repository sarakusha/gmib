const verifySqlite3Arch = require('./verify-sqlite3-arch.js').default;
const { verifyProductionArtifacts } = require('./verify-production-artifacts.cjs');

exports.default = async context => {
  await verifySqlite3Arch(context);
  verifyProductionArtifacts([context.appOutDir]);
};
