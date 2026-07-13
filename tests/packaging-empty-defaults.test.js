const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function loadPackagingDatabase(initial = {}) {
  const values = new Map(Object.entries(initial));
  const localStorage = {
    getItem: (key) => (values.has(key) ? values.get(key) : null),
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  };
  const sandbox = {
    window: {},
    localStorage,
    document: { readyState: "loading", addEventListener() {} },
    console,
  };
  const source = fs.readFileSync(path.join(__dirname, "..", "报价单生成器", "packaging.js"), "utf8");
  vm.runInNewContext(source, sandbox);
  return sandbox.window.PackagingDatabase;
}

const fresh = loadPackagingDatabase();
assert.deepEqual(Array.from(fresh.getItems()), [], "first launch must not include packaging materials");
assert.deepEqual(Array.from(fresh.getProfiles()), [], "first launch must not include packaging profiles");

const afterDelete = loadPackagingDatabase({
  "export-packaging-items-v2": "[]",
  "export-packaging-profiles-v2": "[]",
});
assert.deepEqual(Array.from(afterDelete.getItems()), [], "saved empty materials must remain empty");
assert.deepEqual(Array.from(afterDelete.getProfiles()), [], "saved empty profiles must remain empty");

const migrated = loadPackagingDatabase({
  "export-packaging-items-v2": JSON.stringify([
    { id: "inner-pe-bag", name: "PE Inner Bag", type: "inner" },
    { id: "carton-export-a", name: "Export Carton A", type: "carton" },
    { id: "custom-carton", name: "My Carton", type: "carton" },
  ]),
  "export-packaging-profiles-v2": JSON.stringify([
    { id: "standard-export-carton", name: "Standard Export Carton" },
    { id: "custom-profile", name: "My Profile" },
  ]),
});
assert.deepEqual(Array.from(migrated.getItems(), (item) => item.id), ["custom-carton"], "legacy example materials must be removed");
assert.deepEqual(Array.from(migrated.getProfiles(), (profile) => profile.id), ["custom-profile"], "legacy example profiles must be removed");

console.log("packaging-empty-defaults tests passed");
