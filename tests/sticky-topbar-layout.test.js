const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const css = fs.readFileSync(path.join(__dirname, "..", "报价单生成器", "styles.css"), "utf8");
const topbarRule = css.match(/\.topbar\s*\{[^}]*transition:\s*([^;]+);[^}]*\}/s)?.[1] || "";
const scrolledRule = css.match(/\.is-scrolled\s+\.topbar\s*\{([^}]*)\}/s)?.[1] || "";

assert.equal(/\bpadding(?:-(?:top|bottom))?\b/.test(scrolledRule), false, "scroll state must not change sticky topbar height");
assert.equal(/\bpadding\b/.test(topbarRule), false, "sticky topbar must not animate layout dimensions while scrolling");

console.log("sticky-topbar-layout tests passed");
