/**
 * Auth.js ESM only loads under Jest with Node's --experimental-vm-modules,
 * which emits an ExperimentalWarning on first use of vm.SourceTextModule.
 * Suppress that one message only, so other warnings/errors stay visible.
 */
const originalEmitWarning = process.emitWarning;

process.emitWarning = function suppressVmModulesWarning(warning, ...args) {
  const message = typeof warning === "string" ? warning : warning && warning.message;
  if (typeof message === "string" && message.includes("VM Modules is an experimental feature")) return;
  return originalEmitWarning.call(this, warning, ...args);
};
