# Quotation Workflow Enhancements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve calculator-to-quote data transfer, declaration rendering, logistics cost breakdowns, quote organization, export feedback, and navigation while preserving existing local data.

**Architecture:** Add small normalization functions at each persistence boundary so old data remains readable and all new saves use structured fields. Keep the existing dependency-free frontend, extend the current IndexedDB/localStorage stores, and centralize shared navigation behavior in one script.

**Tech Stack:** HTML5, CSS, browser JavaScript, localStorage, IndexedDB, browser print dialog

## Global Constraints

- Preserve all existing quote, calculator, packaging, and logistics records.
- Preserve the current uncommitted Packing List changes in `app.js`, `index.html`, and `styles.css`.
- Declaration displays for Quotation, PI, and CI only when nonblank; it never displays for Packing List.
- PDF status must not claim that a file was saved because the browser print dialog does not expose that result.
- No server, cloud sync, framework, or new runtime dependency.

---

### Task 1: Calculator Product Fields

**Files:**
- Modify: `报价单生成器/calculator.html`
- Modify: `报价单生成器/calculator.js`

**Interfaces:**
- Consumes: existing calculator item rows and `quotation-profit-calculator-v1`
- Produces: calculator items with `productName`, `spec`, and `material`; quote items mapped to `desc`, `spec`, and `material`

- [ ] **Step 1: Add a browser regression test fixture**

Create a test routine callable from DevTools that inserts an item containing:

```js
{
  productName: "USB cable",
  spec: "C-01",
  material: "PVC",
  qty: 300
}
```

and asserts the generated quote draft contains three separate values.

- [ ] **Step 2: Run the fixture before implementation**

Expected: FAIL because `spec` and `material` are currently written as empty strings.

- [ ] **Step 3: Add the two fields to each calculator row**

Extend row serialization and restoration with:

```js
spec: row.querySelector(".item-spec").value.trim(),
material: row.querySelector(".item-material").value.trim(),
```

Map quote generation and calculator-record saving with:

```js
desc: item.productName || "Product",
spec: item.spec || "",
material: item.material || "",
```

When importing an old quote into the calculator, keep `desc` as `productName` and restore `spec` and `material` independently.

- [ ] **Step 4: Re-run the fixture**

Expected: PASS for fresh rows, saved calculator drafts, generated quote drafts, and old records missing the new fields.

- [ ] **Step 5: Commit**

```powershell
git add -- '报价单生成器/calculator.html' '报价单生成器/calculator.js'
git commit -m "feat: preserve calculator product details"
```

### Task 2: Conditional Declaration and Seller Footer

**Files:**
- Modify: `报价单生成器/app.js`
- Modify: `报价单生成器/styles.css`

**Interfaces:**
- Consumes: `getData()` output
- Produces: consistent HTML/Excel visibility rules

- [ ] **Step 1: Add rendering assertions**

Cover Quotation, PI, CI, and PL with blank/nonblank Declaration, plus seller-contact combinations where only `buyerEmail` is filled.

- [ ] **Step 2: Run assertions before implementation**

Expected: FAIL for Quotation/PI Declaration and confirm no contact footer is rendered from buyer data.

- [ ] **Step 3: Implement shared visibility rules**

Use:

```js
const showDeclaration = !isPackingList && text(data.declaration, "") !== "";
const footerContact = [data.sellerWebsite, data.sellerEmail, data.sellerPhone]
  .map((value) => text(value, ""))
  .filter(Boolean);
```

Render the Declaration block and Excel row only when `showDeclaration`. Render `.doc-footer-contact` only when `footerContact.length`, and omit the Excel footer row when empty.

- [ ] **Step 4: Run rendering assertions**

Expected: PASS for all document types and blank seller footer cases.

- [ ] **Step 5: Commit**

Stage only the Task 2 hunks because these files contain pre-existing user changes:

```powershell
git diff -- '报价单生成器/app.js' '报价单生成器/styles.css'
git add -p -- '报价单生成器/app.js' '报价单生成器/styles.css'
git commit -m "fix: align declaration and footer visibility"
```

### Task 3: Structured Logistics Cost Items

**Files:**
- Modify: `报价单生成器/logistics.html`
- Modify: `报价单生成器/logistics.js`
- Modify: `报价单生成器/calculator.js`
- Modify: `报价单生成器/styles.css`

**Interfaces:**
- Produces: `normalizeCostItems(profile)` and `profile.costItems`
- Preserves: `unitPrice`, `minimumCharge`, and derived `totalCost`

- [ ] **Step 1: Add normalization checks**

Assert that an old `{ totalCost: 800 }` becomes exactly one `原物流总成本` item, repeated normalization remains one item, and a new profile receives four zero-value defaults.

- [ ] **Step 2: Run checks before implementation**

Expected: FAIL because `costItems` is not defined.

- [ ] **Step 3: Implement normalization and totals**

Use stable defaults:

```js
const defaultCostNames = ["海运费", "港杂费", "文件费", "报关费"];
const totalCost = costItems.reduce((sum, item) => sum + Math.max(number(item.amount), 0), 0);
```

Preserve unknown profile properties by spreading the source profile before normalized properties.

- [ ] **Step 4: Build the cost editor**

Render editable rows with name, amount, and delete controls; add an “新增其他费用” button. Make total cost read-only and recompute it on every edit. Include cost item names in search.

- [ ] **Step 5: Update calculator consumption**

Continue reading `profile.totalCost`; ensure calculator profile normalization derives it from `costItems` when present.

- [ ] **Step 6: Verify migration and interaction**

Expected: old and new profiles calculate identical totals, custom items persist after reload, and invalid/negative values become zero.

- [ ] **Step 7: Commit**

```powershell
git add -- '报价单生成器/logistics.html' '报价单生成器/logistics.js' '报价单生成器/calculator.js'
git add -p -- '报价单生成器/styles.css'
git commit -m "feat: add detailed logistics costs"
```

### Task 4: Quote Folders and Save Remarks

**Files:**
- Modify: `报价单生成器/quote-records-store.js`
- Modify: `报价单生成器/quote-records.html`
- Modify: `报价单生成器/quote-records.js`
- Modify: `报价单生成器/index.html`
- Modify: `报价单生成器/app.js`
- Modify: `报价单生成器/styles.css`

**Interfaces:**
- Produces: `folders()`, `createFolder(name)`, `renameFolder(id, name)`, `removeFolder(id)`
- Extends records with `folderId` and `saveRemark`
- `saveQuoteRecord({ asNew })` resolves to `{ status: "saved"|"cancelled", record? }` or rejects

- [ ] **Step 1: Add store-level checks**

Verify old records normalize to empty `folderId`/`saveRemark`, folder deletion moves records to uncategorized, and duplicate records preserve organization fields.

- [ ] **Step 2: Run checks before implementation**

Expected: FAIL because folder APIs do not exist.

- [ ] **Step 3: Add folder persistence**

Store folders under `quoteRecordFolders` in localStorage with normalized shape:

```js
{ id, name, createdAt, updatedAt }
```

Deleting a folder updates every affected IndexedDB quote with `folderId: ""` before removing the folder.

- [ ] **Step 4: Add the save dialog**

Add an accessible `<dialog>` to `index.html` containing folder selection, inline new-folder creation, remark text, confirm, and cancel. Escape/cancel resolves without writing.

- [ ] **Step 5: Make saving return explicit outcomes**

Only mutate `recordId` and status after `QuoteRecordsStore.upsert()` succeeds. On failure, show the error and reject so callers can stop exports.

- [ ] **Step 6: Upgrade the records page**

Add folder filter and folder management controls. Search this combined text:

```js
[record.customerName, record.documentNo, productText(record), folderName, record.saveRemark]
```

Show folder and remark on each card.

- [ ] **Step 7: Verify record workflows**

Expected: save, save-as, edit, search, filter, rename, and delete-folder flows all preserve records and existing data.

- [ ] **Step 8: Commit**

```powershell
git add -- '报价单生成器/quote-records-store.js' '报价单生成器/quote-records.html' '报价单生成器/quote-records.js'
git add -p -- '报价单生成器/index.html' '报价单生成器/app.js' '报价单生成器/styles.css'
git commit -m "feat: organize quote records with folders"
```

### Task 5: Backup Coverage

**Files:**
- Modify: `报价单生成器/backup.js`

**Interfaces:**
- Consumes/produces: `quoteRecordFolders` in backup `localStorage`

- [ ] **Step 1: Export a backup before implementation**

Expected: `quoteRecordFolders` is absent.

- [ ] **Step 2: Add `quoteRecordFolders` to the allowed localStorage keys**

Validate restored content through the folder store normalization on the next records-page load.

- [ ] **Step 3: Export and restore a fixture**

Expected: folders, record assignments, remarks, and structured logistics fees survive a round trip.

- [ ] **Step 4: Commit**

```powershell
git add -- '报价单生成器/backup.js'
git commit -m "feat: include quote folders in backups"
```

### Task 6: Reliable Save and PDF Feedback

**Files:**
- Modify: `报价单生成器/app.js`
- Modify: `报价单生成器/index.html`
- Modify: `报价单生成器/styles.css`

**Interfaces:**
- Consumes: explicit save outcomes from Task 4
- Produces: status messages through `recordSaveStatus`

- [ ] **Step 1: Add failure-path checks**

Stub `QuoteRecordsStore.upsert` to reject and `window.print` to throw; assert print is skipped on save failure/cancel and each failure message is visible.

- [ ] **Step 2: Run checks before implementation**

Expected: FAIL because the current handler prints after an unsuccessful internal save.

- [ ] **Step 3: Gate export on save result**

Implement:

```js
const result = await saveQuoteRecord();
if (result.status !== "saved") return;
try {
  window.print();
  setRecordStatus("打印窗口已关闭；是否保存文件取决于打印窗口中的操作。");
} catch (error) {
  setRecordStatus(`PDF 导出窗口打开失败：${error.message || error}`, true);
}
```

Apply the same save-failure protection to Excel export.

- [ ] **Step 4: Run failure and success checks**

Expected: PASS with no false “PDF saved” claim.

- [ ] **Step 5: Commit**

Stage only Task 6 hunks:

```powershell
git add -p -- '报价单生成器/app.js' '报价单生成器/index.html' '报价单生成器/styles.css'
git commit -m "fix: report save and PDF export failures"
```

### Task 7: Shared Sticky Navigation

**Files:**
- Create: `报价单生成器/navigation.js`
- Modify: `报价单生成器/index.html`
- Modify: `报价单生成器/calculator.html`
- Modify: `报价单生成器/packaging.html`
- Modify: `报价单生成器/logistics.html`
- Modify: `报价单生成器/quote-records.html`
- Modify: `报价单生成器/backup.html`
- Modify: `报价单生成器/styles.css`

**Interfaces:**
- Produces: `.is-scrolled` on `<body>` and `aria-current="page"` on the active navigation link

- [ ] **Step 1: Add manual/browser assertions**

Check each page at desktop and 390px width for sticky position, current-page state, horizontal navigation overflow, keyboard access, and print hiding.

- [ ] **Step 2: Add navigation behavior**

Load `navigation.js` on all pages. Determine the current filename, set matching navigation state, and toggle compact mode with:

```js
const update = () => document.body.classList.toggle("is-scrolled", window.scrollY > 24);
```

- [ ] **Step 3: Add shared responsive CSS**

Use `position: sticky; top: 0; z-index`, compact paddings in `.is-scrolled`, `overflow-x: auto` for narrow `.topbar-actions`, and hide `.topbar` under `@media print`.

- [ ] **Step 4: Run assertions**

Expected: navigation remains usable without obscuring content and does not appear in print.

- [ ] **Step 5: Commit**

```powershell
git add -- '报价单生成器/navigation.js' '报价单生成器/calculator.html' '报价单生成器/packaging.html' '报价单生成器/logistics.html' '报价单生成器/quote-records.html' '报价单生成器/backup.html'
git add -p -- '报价单生成器/index.html' '报价单生成器/styles.css'
git commit -m "feat: add shared sticky navigation"
```

### Task 8: Full Regression Verification

**Files:**
- Verify all modified files

- [ ] **Step 1: Run static checks**

```powershell
git diff --check
node --check '报价单生成器/app.js'
node --check '报价单生成器/calculator.js'
node --check '报价单生成器/logistics.js'
node --check '报价单生成器/quote-records-store.js'
node --check '报价单生成器/quote-records.js'
node --check '报价单生成器/backup.js'
node --check '报价单生成器/navigation.js'
```

Expected: all commands exit 0.

- [ ] **Step 2: Run browser regression**

Use the local launcher and verify all 13 acceptance scenarios in the design spec, including current Packing List fields and Excel output.

- [ ] **Step 3: Inspect the final diff**

Confirm no unrelated user changes were removed and no generated browser profiles, PDFs, or assets were staged.

- [ ] **Step 4: Commit any test-only adjustments**

```powershell
git status --short
```

Expected: only the user’s pre-existing uncommitted files/assets remain, unless they were intentionally incorporated without overwriting their changes.
