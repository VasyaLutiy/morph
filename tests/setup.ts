import net from "node:net";

function blocked(): never {
  throw new Error("network blocked in tests");
}

// Node's typings carry no XMLHttpRequest/WebSocket and globalThis has no index
// signature, so reach all five globals through an untyped view of globalThis.
const g = globalThis as unknown as Record<string, unknown>;
g.fetch = blocked;
g.XMLHttpRequest = class {
  constructor() {
    blocked();
  }
};
g.WebSocket = class {
  constructor() {
    blocked();
  }
};

// Replace connect and createConnection on the shared default export of node:net
// (module.exports of the CommonJS module, so every importer sees the blockers).
const netModule = net as unknown as Record<string, unknown>;
netModule.connect = blocked;
netModule.createConnection = blocked;
