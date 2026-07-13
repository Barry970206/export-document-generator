const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const appDir = fs
  .readdirSync(root, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => path.join(root, entry.name))
  .find((dir) => fs.existsSync(path.join(dir, "calculator.js")) && fs.existsSync(path.join(dir, "logistics.js")));

assert.ok(appDir, "Cannot find app directory");

const logisticsUtils = require(path.join(appDir, "logistics-utils.js"));

const profile = logisticsUtils.normalizeLogisticsProfile({
  id: "sea-20gp",
  name: "Sea 20GP",
  currency: "CNY",
  totalCost: 999999,
  costItems: [
    { name: "海运费", currency: "USD", amount: 4217, unit: "/20GP", quantity: 1 },
    { name: "港杂", currency: "CNY", amount: 187, unit: "/20GP", quantity: 1 },
    { name: "THC", currency: "CNY", amount: 650, unit: "/20GP", quantity: 1 },
    { name: "CHC", currency: "CNY", amount: 25, unit: "/20GP", quantity: 1 },
    { name: "文件", currency: "CNY", amount: 450, unit: "/票", quantity: 1 },
    { name: "报关", currency: "CNY", amount: 100, unit: "/票", quantity: 1 },
    { name: "陆运", currency: "CNY", amount: 3100, unit: "/20GP", quantity: 1 },
  ],
});

const summary = logisticsUtils.calculateLogisticsCostSummary(profile, { exchangeRate: 7.2 });

assert.equal(profile.totalCost, 34874.4);
assert.equal(summary.totalRmb, 34874.4);
assert.equal(summary.foreignTotals.USD, 4217);
assert.equal(summary.localTotalRmb, 4512);
assert.equal(summary.rows[0].totalRmb, 30362.4);
assert.equal(summary.rows[0].unit, "/20GP");
assert.equal(summary.rows[0].quantity, 1);

const legacy = logisticsUtils.normalizeLogisticsProfile({
  name: "Legacy",
  currency: "USD",
  totalCost: 100,
});
assert.equal(legacy.costItems[0].currency, "USD");
assert.equal(logisticsUtils.calculateLogisticsCostSummary(legacy, { exchangeRate: 7.2 }).totalRmb, 720);

console.log("logistics-utils tests passed");
