const storageKey = "export-document-generator-v3";
const oldStorageKeys = ["export-document-generator-v1", "export-document-generator-v2"];
const itemTemplate = document.querySelector("#itemRowTemplate");
const appShell = document.querySelector(".app-shell");
const itemsBody = document.querySelector("#itemsBody");
const preview = document.querySelector("#documentPreview");
const form = document.querySelector("#documentForm");
const saveState = document.querySelector("#saveState");
const bulkInput = document.querySelector("#bulkInput");
const parseStatus = document.querySelector("#parseStatus");
const togglePreviewBtn = document.querySelector("#togglePreviewBtn");
const logoFile = document.querySelector("#logoFile");
const logoPreview = document.querySelector("#logoPreview");
const recordSaveStatus = document.querySelector("#recordSaveStatus");

const now = new Date();
function todayString() {
  return new Date().toISOString().slice(0, 10);
}

const defaults = {
  docType: "Quotation",
  docNo: `QT-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}-${String(Date.now()).slice(-4)}`,
  poNo: "",
  docDate: todayString(),
  validUntil: "",
  currency: "USD",
  exchangeRate: 7.2,
  priceMode: "direct",
  sellerName: "",
  sellerAddress: "",
  sellerContact: "",
  sellerEmail: "",
  sellerWebsite: "",
  sellerPhone: "",
  logoUrl: "",
  buyerName: "",
  buyerAddress: "",
  buyerCountry: "",
  buyerContact: "",
  buyerEmail: "",
  incoterm: "FOB",
  tradeDestination: "",
  transportMode: "",
  loadingPort: "",
  destinationPort: "",
  leadTime: "",
  paymentTerms: "",
  packing: "",
  countryOfOrigin: "China",
  shippingMark: "",
  packageUnit: "CARTONS",
  declaration: "",
  bankInfo: "",
  bankBeneficiary: "",
  bankName: "",
  bankAccount: "",
  bankSwift: "",
  bankAddress: "",
  shipping: 0,
  discount: 0,
  notes: "",
  signatureText: "Authorized Signature",
  items: [
    { image: "", desc: "", spec: "", material: "", hsCode: "", qty: 1, unit: "PCS", packages: 0, pallets: 0, netWeight: 0, grossWeight: 0, cbm: 0, rmbPrice: 0, price: 0 },
    { image: "", desc: "", spec: "", material: "", hsCode: "", qty: 1, unit: "PCS", packages: 0, pallets: 0, netWeight: 0, grossWeight: 0, cbm: 0, rmbPrice: 0, price: 0 },
  ],
};

let saveTimer;

function setLogoPreview(src) {
  const logoSrc = String(src || "");
  logoPreview.src = logoSrc;
  logoPreview.classList.toggle("is-empty", !logoSrc);
}

function setPreviewVisible(isVisible) {
  appShell.classList.toggle("preview-hidden", !isVisible);
  togglePreviewBtn.textContent = isVisible ? "隐藏预览" : "显示预览";
  togglePreviewBtn.setAttribute("aria-pressed", String(!isVisible));
  localStorage.setItem("quotation-preview-visible", isVisible ? "1" : "0");
}

function syncDocumentMode() {
  appShell.classList.toggle("commercial-invoice-mode", form.elements.docType?.value === "Commercial Invoice");
  appShell.classList.toggle("packing-list-mode", form.elements.docType?.value === "Packing List");
}

function addDays(date, days) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy.toISOString().slice(0, 10);
}

function number(value, fallback = 0) {
  const parsed = Number(String(value ?? "").replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function currentRate() {
  return Math.max(number(form.elements.exchangeRate?.value, defaults.exchangeRate), 0.0001);
}

function convertedPrice(rmbPrice, directPrice) {
  const priceMode = form.elements.priceMode?.value || defaults.priceMode;
  if (priceMode === "direct") return number(directPrice);
  return number(rmbPrice) / currentRate();
}

function trimDecimal(value, maxDigits = 6) {
  return number(value).toFixed(maxDigits).replace(/\.?0+$/, "");
}

function money(value, currency) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(number(value));
}

function unitMoney(value, currency) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 6,
  }).format(number(value));
}

function quantity(value) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
  }).format(number(value));
}

function quantityWithUnit(value, unit) {
  return [quantity(value), text(unit, "PCS")].filter(Boolean).join(" ");
}

function fixedUnit(value, unit, decimals = 0) {
  const formatted = decimals > 0 ? number(value).toFixed(decimals) : quantity(value);
  return `${formatted} ${unit}`;
}

function packageUnit(data) {
  return data.packageUnit === "PKGS" ? "PKGS" : "CARTONS";
}

function text(value, fallback = "-") {
  const clean = String(value || "").trim();
  return clean || fallback;
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function termBlock(title, value) {
  const clean = text(value, "");
  return clean ? `<div><h3>${escapeHtml(title)}</h3><p>${escapeHtml(clean)}</p></div>` : "";
}

function getData() {
  const formData = new FormData(form);
  const data = Object.fromEntries(formData.entries());
  data.recordId = form.dataset.recordId || "";
  data.docType = formData.get("docType") || defaults.docType;
  data.exchangeRate = currentRate();
  data.shipping = number(data.shipping);
  data.discount = number(data.discount);
  data.items = [...itemsBody.querySelectorAll(".item-row")].map((row) => {
    const rmbPrice = number(row.querySelector(".item-rmb-price").value);
    const directPrice = number(row.querySelector(".item-price").value);
    return {
      image: row.dataset.image || "",
      desc: row.querySelector(".item-desc").value,
      spec: row.querySelector(".item-spec").value,
      material: row.querySelector(".item-material").value,
      hsCode: row.querySelector(".item-hs-code").value,
      qty: number(row.querySelector(".item-qty").value),
      unit: row.querySelector(".item-unit").value,
      unitWeightGram: number(row.dataset.unitWeightGram),
      packagingProfileId: row.dataset.packagingProfileId || "",
      packagingProfileName: row.dataset.packagingProfileName || "",
      manualCartonQty: row.dataset.manualCartonQty || "",
      manualPalletQty: row.dataset.manualPalletQty || "",
      packages: number(row.querySelector(".item-package").value),
      pallets: number(row.querySelector(".item-pallets").value),
      netWeight: number(row.querySelector(".item-net-weight").value),
      grossWeight: number(row.querySelector(".item-gross-weight").value),
      cbm: number(row.querySelector(".item-cbm").value),
      cartonQty: number(row.querySelector(".item-package").value),
      palletQty: number(row.querySelector(".item-pallets").value),
      totalWeightKg: number(row.querySelector(".item-net-weight").value),
      grossWeightKg: number(row.querySelector(".item-gross-weight").value),
      totalCbm: number(row.querySelector(".item-cbm").value),
      rmbPrice,
      price: number(directPrice),
    };
  });
  return data;
}

function normalizeSavedItem(item) {
  const price = number(item.price);
  const rmbPrice = number(item.rmbPrice, price * currentRate());
  return {
    image: item.image || "",
    desc: item.desc || "",
    spec: item.spec || "",
    material: item.material || "",
    hsCode: item.hsCode || "",
    qty: number(item.qty, 1),
    unit: item.unit || "PCS",
    unitWeightGram: number(item.unitWeightGram),
    packagingProfileId: item.packagingProfileId || "",
    packagingProfileName: item.packagingProfileName || "",
    manualCartonQty: item.manualCartonQty ?? "",
    manualPalletQty: item.manualPalletQty ?? "",
    packages: number(item.packages ?? item.cartonQty),
    pallets: number(item.pallets ?? item.palletQty),
    netWeight: number(item.netWeight ?? item.totalWeightKg),
    grossWeight: number(item.grossWeight ?? item.grossWeightKg),
    cbm: number(item.cbm ?? item.totalCbm),
    cartonQty: number(item.cartonQty ?? item.packages),
    palletQty: number(item.palletQty ?? item.pallets),
    totalWeightKg: number(item.totalWeightKg ?? item.netWeight),
    grossWeightKg: number(item.grossWeightKg ?? item.grossWeight),
    totalCbm: number(item.totalCbm ?? item.cbm),
    rmbPrice,
    price,
  };
}

function setData(data) {
  const merged = { ...defaults, ...data };
  Object.entries(merged).forEach(([key, value]) => {
    if (key === "items") return;
    const field = form.elements[key];
    if (!field) return;
    field.value = value;
  });
  setLogoPreview(merged.logoUrl);

  itemsBody.innerHTML = "";
  const rows = Array.isArray(merged.items) && merged.items.length ? merged.items : defaults.items;
  rows.map(normalizeSavedItem).forEach(addItemRow);
}

function addItemRow(item = { image: "", desc: "", spec: "", material: "", hsCode: "", qty: 1, unit: "PCS", packages: 0, pallets: 0, netWeight: 0, grossWeight: 0, cbm: 0, rmbPrice: 0, price: 0 }) {
  const row = itemTemplate.content.firstElementChild.cloneNode(true);
  const imagePreview = row.querySelector(".item-image-preview");
  row.dataset.image = item.image || "";
  row.dataset.unitWeightGram = number(item.unitWeightGram);
  row.dataset.packagingProfileId = item.packagingProfileId || "";
  row.dataset.packagingProfileName = item.packagingProfileName || "";
  row.dataset.manualCartonQty = item.manualCartonQty ?? "";
  row.dataset.manualPalletQty = item.manualPalletQty ?? "";
  if (item.image) imagePreview.src = item.image;
  row.querySelector(".item-desc").value = item.desc || "";
  row.querySelector(".item-spec").value = item.spec || "";
  row.querySelector(".item-material").value = item.material || "";
  row.querySelector(".item-hs-code").value = item.hsCode || "";
  row.querySelector(".item-qty").value = number(item.qty, 1);
  row.querySelector(".item-unit").value = item.unit || "PCS";
  row.querySelector(".item-package").value = number(item.packages);
  row.querySelector(".item-pallets").value = number(item.pallets);
  row.querySelector(".item-net-weight").value = number(item.netWeight);
  row.querySelector(".item-gross-weight").value = number(item.grossWeight);
  row.querySelector(".item-cbm").value = number(item.cbm);
  row.querySelector(".item-rmb-price").value = trimDecimal(item.rmbPrice);
  row.querySelector(".item-price").value = trimDecimal(item.price);
  row.querySelector(".item-image").addEventListener("change", (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      row.dataset.image = String(reader.result || "");
      imagePreview.src = row.dataset.image;
      update();
    });
    reader.readAsDataURL(file);
  });
  row.querySelector(".remove-item").addEventListener("click", () => {
    if (itemsBody.children.length === 1) addItemRow();
    row.remove();
    update();
  });
  row.querySelector(".item-rmb-price").addEventListener("input", () => {
    if ((form.elements.priceMode?.value || defaults.priceMode) === "cnyToUsd") {
      convertRmbToUsd(row);
    }
  });
  row.querySelectorAll("input").forEach((input) => input.addEventListener("input", update));
  itemsBody.append(row);
  updateRow(row);
}

function updateRow(row) {
  const qty = number(row.querySelector(".item-qty").value);
  const priceField = row.querySelector(".item-price");
  const price = number(priceField.value);

  priceField.readOnly = false;
  priceField.title = "可自由填写；切换到人民币自动换算时，输入人民币会自动填入美元";

  row.querySelector(".item-total").value = (qty * price).toFixed(2);
  row.querySelector(".item-total").textContent = (qty * price).toFixed(2);
}

function convertRmbToUsd(row) {
  const priceField = row.querySelector(".item-price");
  const rmbPrice = number(row.querySelector(".item-rmb-price").value);
  priceField.value = trimDecimal(rmbPrice / currentRate());
}

function convertAllRmbToUsd() {
  if ((form.elements.priceMode?.value || defaults.priceMode) !== "cnyToUsd") return;
  [...itemsBody.querySelectorAll(".item-row")].forEach(convertRmbToUsd);
}

function calculate(data) {
  const subtotal = data.items.reduce((sum, item) => sum + number(item.qty) * number(item.price), 0);
  const total = Math.max(subtotal + data.shipping - data.discount, 0);
  return { subtotal, total };
}

function showRecordStatus(message, isError = false) {
  if (recordSaveStatus) {
    recordSaveStatus.textContent = message;
    recordSaveStatus.classList.toggle("error", isError);
  }
  if (saveState) saveState.textContent = message;
}

async function saveQuoteRecord({ asNew = false } = {}) {
  try {
    if (!window.QuoteRecordsStore) throw new Error("报价记录模块未加载");
    const data = getData();
    if (asNew) {
      data.recordId = "";
      data.docNo = QuoteRecordsStore.newDocumentNo(QuoteRecordsStore.documentType(data.docType));
      data.docDate = QuoteRecordsStore.today();
      form.dataset.recordId = "";
      setData(data);
    }
    const recordId = asNew ? "" : form.dataset.recordId;
    const record = QuoteRecordsStore.quoteRecordFromData(data, calculate(data), { id: recordId || undefined });
    const savedRecord = await QuoteRecordsStore.upsert(record);
    form.dataset.recordId = savedRecord.id;
    try {
      localStorage.setItem(storageKey, JSON.stringify({ ...getData(), recordId: savedRecord.id }));
    } catch (error) {
      console.warn(error);
    }
    showRecordStatus(asNew ? "已另存" : "已保存");
    window.setTimeout(() => {
      if (recordSaveStatus?.textContent === "已保存" || recordSaveStatus?.textContent === "已另存") {
        recordSaveStatus.textContent = "";
      }
    }, 2200);
    return savedRecord;
  } catch (error) {
    console.error(error);
    showRecordStatus("保存失败", true);
    window.alert(`保存失败：${error.message || error}`);
    return null;
  }
}

function packingTotals(items) {
  return items.reduce(
    (sum, item) => ({
      packages: sum.packages + number(item.packages),
      pallets: sum.pallets + number(item.pallets),
      netWeight: sum.netWeight + number(item.netWeight),
      grossWeight: sum.grossWeight + number(item.grossWeight),
      cbm: sum.cbm + number(item.cbm),
    }),
    { packages: 0, pallets: 0, netWeight: 0, grossWeight: 0, cbm: 0 },
  );
}

function splitColumns(line) {
  const columns = line
    .split(/\t|,|，|;|；|\|/)
    .map((part) => part.trim())
    .filter(Boolean);
  return columns.length >= 3 ? columns : null;
}

function extractNumbers(line) {
  const matches = [...line.matchAll(/(?:￥|RMB|CNY|USD|\$)?\s*(-?\d+(?:,\d{3})*(?:\.\d+)?)/gi)];
  return matches.map((match) => ({
    value: number(match[1]),
    index: match.index || 0,
    raw: match[0],
  }));
}

function extractSpec(textValue) {
  const specMatch = textValue.match(/(?:型号|规格|model|spec|size)[:：\s-]*([a-z0-9#._*xX×\-\/ ]{2,})/i);
  return specMatch ? specMatch[1].trim() : "";
}

function cleanDescription(line, qty, price) {
  return line
    .replace(/(?:数量|qty|pcs|个|件|套|只|条|箱|单价|价格|人民币单价|rmb|cny|usd|￥|\$)[:：\s-]*/gi, " ")
    .replace(String(qty), " ")
    .replace(String(price), " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseColumnLine(line) {
  const columns = splitColumns(line);
  if (!columns) return null;

  const numericColumns = columns
    .map((value, index) => ({ index, value: number(value, NaN) }))
    .filter((entry) => Number.isFinite(entry.value));
  if (numericColumns.length < 2) return null;

  const price = numericColumns[numericColumns.length - 1].value;
  const qty = numericColumns[numericColumns.length - 2].value;
  const firstNumeric = numericColumns[0].index;
  const textColumns = columns.slice(0, firstNumeric);
  return {
    image: "",
    desc: textColumns[0] || columns[0] || "Product",
    spec: textColumns.slice(1).join(" ") || extractSpec(line),
    material: "",
    hsCode: "",
    qty,
    rmbPrice: price,
    price: price / currentRate(),
  };
}

function parseFreeTextLine(line) {
  const nums = extractNumbers(line).filter((entry) => entry.value >= 0);
  if (nums.length < 2) return null;

  const priceEntry = nums[nums.length - 1];
  const qtyEntry = nums[nums.length - 2];
  const beforeQty = line.slice(0, qtyEntry.index).trim();
  const spec = extractSpec(line);
  const cleaned = cleanDescription(beforeQty || line, qtyEntry.value, priceEntry.value);

  return {
    image: "",
    desc: cleaned || "Product",
    spec,
    material: "",
    hsCode: "",
    qty: qtyEntry.value,
    rmbPrice: priceEntry.value,
    price: priceEntry.value / currentRate(),
  };
}

function parseBulkItems(rawText) {
  return rawText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => parseColumnLine(line) || parseFreeTextLine(line))
    .filter(Boolean);
}

function documentCode(docType) {
  if (docType === "Proforma Invoice") return "PI";
  if (docType === "Commercial Invoice") return "CI";
  if (docType === "Packing List") return "PL";
  return "QT";
}

function syncDocumentNumberPrefix() {
  const docNoField = form.elements.docNo;
  const prefix = documentCode(form.elements.docType?.value);
  const current = text(docNoField.value, defaults.docNo);
  const suffix = current.replace(/^(QT|PI|CI|PL)-?/i, "");
  docNoField.value = `${prefix}-${suffix || `${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, "0")}-${String(Date.now()).slice(-4)}`}`;
}

function safeFilePart(value, fallback) {
  return text(value, fallback)
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function buildPdfFileName(data) {
  const code = documentCode(data.docType);
  const buyer = safeFilePart(data.buyerName, "Customer");
  const date = safeFilePart(data.docDate || new Date().toISOString().slice(0, 10), "Date");
  return `${code}-${buyer}-${date}.pdf`;
}

function buildExcelFileName(data) {
  return buildPdfFileName(data).replace(/\.pdf$/i, ".xls");
}

function bankDetails(data) {
  const rows = [
    ["Beneficiary", data.bankBeneficiary],
    ["Bank Name", data.bankName],
    ["Account No.", data.bankAccount],
    ["SWIFT Code", data.bankSwift],
    ["Bank Address", data.bankAddress],
  ].filter(([, value]) => text(value, ""));
  if (!rows.length && data.bankInfo) return [["Bank Details", data.bankInfo]];
  return rows;
}

function uniqueHsCodes(items) {
  return [...new Set(items.map((item) => text(item.hsCode, "")).filter(Boolean))].join(", ");
}

function csvEscape(value) {
  const clean = String(value ?? "");
  return /[",\r\n\t]/.test(clean) ? `"${clean.replaceAll('"', '""')}"` : clean;
}

function downloadBlob(content, fileName, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function xmlEscape(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function excelCell(value, type = "String", style = "", mergeAcross = 0) {
  const data = type === "Number" ? number(value) : xmlEscape(value);
  const styleAttr = style ? ` ss:StyleID="${style}"` : "";
  const mergeAttr = mergeAcross ? ` ss:MergeAcross="${mergeAcross}"` : "";
  return `<Cell${styleAttr}${mergeAttr}><Data ss:Type="${type}">${data}</Data></Cell>`;
}

function excelRow(values, height = "") {
  const heightAttr = height ? ` ss:Height="${height}"` : "";
  return `<Row${heightAttr}>${values.map((value) => {
    if (Array.isArray(value)) return excelCell(value[0], value[1], value[2] || "", value[3] || 0);
    if (value && typeof value === "object") {
      return excelCell(value.value, value.type || "String", value.style || "", value.mergeAcross || 0);
    }
    return excelCell(value);
  }).join("")}</Row>`;
}

function excelSheet(name, rows) {
  return `
    <Worksheet ss:Name="${xmlEscape(name)}">
      <Table>
        <Column ss:Width="42"/>
        <Column ss:Width="92"/>
        <Column ss:Width="150"/>
        <Column ss:Width="110"/>
        <Column ss:Width="130"/>
        <Column ss:Width="70"/>
        <Column ss:Width="86"/>
        <Column ss:Width="86"/>
        <Column ss:Width="86"/>
        ${rows.join("")}
      </Table>
    </Worksheet>
  `;
}

function exportItemsCsv() {
  const data = getData();
  const rows = [
    ["Image", "Description", "Specification", "Material / Surface", "HS Code", "Qty", "RMB Unit Price", "Unit Price", "Amount"],
    ...data.items.map((item) => [
      item.image ? "Image Attached" : "",
      item.desc,
      item.spec,
      item.material,
      item.hsCode,
      number(item.qty),
      trimDecimal(item.rmbPrice),
      trimDecimal(item.price),
      (number(item.qty) * number(item.price)).toFixed(2),
    ]),
  ];
  const csv = rows.map((row) => row.map(csvEscape).join(",")).join("\r\n");
  downloadBlob(`\ufeff${csv}`, `${buildPdfFileName(data).replace(/\.pdf$/i, "")}-items.csv`, "text/csv;charset=utf-8");
}

function parseImportedTable(textValue) {
  const lines = textValue.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const rows = lines.map((line) => splitColumns(line) || line.split(/\t/).map((part) => part.trim()).filter(Boolean));
  const dataRows = rows.filter((row) => row.length >= 4 && !/description|product|qty|quantity|unit/i.test(row.join(" ")));
  return dataRows.map((row) => {
    const qty = number(row[4] ?? row[3], 1);
    const rmbPrice = number(row[5] ?? row[row.length - 2], 0);
    const price = number(row[6] ?? row[row.length - 1], rmbPrice / currentRate());
    return {
      image: "",
      desc: row[0] || "",
      spec: row[1] || "",
      material: row[2] || "",
      hsCode: row[3] || "",
      qty,
      rmbPrice,
      price,
    };
  }).filter((item) => item.desc || item.spec || item.qty || item.rmbPrice || item.price);
}

function exportQuoteExcel() {
  const data = getData();
  const totals = calculate(data);
  const isPackingList = data.docType === "Packing List";
  const isCommercialInvoice = data.docType === "Commercial Invoice";
  const isQuotation = data.docType === "Quotation";
  const plTotals = packingTotals(data.items);
  const currency = data.currency || "USD";
  const bankRows = bankDetails(data);
  const packageUnitLabel = packageUnit(data);
  const labelCell = (value) => ({ value, style: "Label" });
  const valueCell = (value, mergeAcross = 0) => ({ value, style: "Value", mergeAcross });
  const numberCell = (value, style = "Number") => ({ value, type: "Number", style });
  const termRows = (pairs) => {
    const filled = pairs.filter(([, value]) => text(value, ""));
    const rows = [];
    for (let index = 0; index < filled.length; index += 3) {
      const cells = filled.slice(index, index + 3).flatMap(([label, value]) => [labelCell(label), valueCell(value)]);
      while (cells.length < 9) cells.push("");
      rows.push(excelRow(cells));
    }
    return rows;
  };
  const rows = [
    excelRow([{ value: data.docType, style: "Title", mergeAcross: 8 }], 30),
    excelRow([labelCell("No."), valueCell(data.docNo), labelCell("PO No."), valueCell(data.poNo), labelCell("Date"), valueCell(data.docDate), labelCell("Currency"), valueCell(currency), ""]),
    excelRow([""]),
    excelRow([{ value: "SELLER", style: "Section", mergeAcross: 3 }, { value: "BUYER", style: "Section", mergeAcross: 4 }]),
    excelRow([labelCell("Company"), valueCell(data.sellerName, 2), "", labelCell("Company"), valueCell(data.buyerName, 3), ""]),
    excelRow([labelCell("Address"), valueCell(data.sellerAddress, 2), "", labelCell("Address"), valueCell(data.buyerAddress, 3), ""]),
    excelRow([labelCell("Contact"), valueCell(data.sellerContact, 2), "", labelCell("Country"), valueCell(data.buyerCountry, 3), ""]),
    excelRow([labelCell("Email"), valueCell(data.sellerEmail, 2), "", labelCell("Contact"), valueCell(data.buyerContact, 3), ""]),
    excelRow([labelCell("Website"), valueCell(data.sellerWebsite, 2), "", labelCell("Email"), valueCell(data.buyerEmail, 3), ""]),
    excelRow([labelCell("Phone / WhatsApp"), valueCell(data.sellerPhone, 2), "", "", "", "", "", "", ""]),
    excelRow([""]),
    ...(isPackingList && data.shippingMark
      ? [
          excelRow([{ value: "SHIPPING MARK", style: "Section", mergeAcross: 8 }]),
          excelRow([valueCell(data.shippingMark, 8)]),
          excelRow([""]),
        ]
      : []),
    excelRow(isPackingList
      ? [
          { value: "Description", style: "Header" },
          { value: "Qty", style: "Header" },
          { value: "Packages", style: "Header" },
          { value: "N.W.", style: "Header" },
          { value: "G.W.", style: "Header" },
          { value: "", style: "Header" },
          { value: "", style: "Header" },
          { value: "", style: "Header" },
          { value: "", style: "Header" },
        ]
      : isQuotation
        ? [
            { value: "#", style: "Header" },
            { value: "Image", style: "Header" },
            { value: "Description", style: "Header" },
            { value: "Specification", style: "Header" },
            { value: "Material / Surface", style: "Header" },
            { value: "Qty", style: "Header" },
            { value: "Unit Price", style: "Header" },
            { value: "Amount", style: "Header" },
            { value: "", style: "Header" },
          ]
      : [
          { value: "#", style: "Header" },
          { value: "Image", style: "Header" },
          { value: "Description", style: "Header" },
          { value: "Specification", style: "Header" },
          { value: "Material / Surface", style: "Header" },
          { value: "HS Code", style: "Header" },
          { value: "Qty", style: "Header" },
          { value: "Unit Price", style: "Header" },
          { value: "Amount", style: "Header" },
        ]),
    ...data.items.map((item, index) => excelRow(isPackingList
      ? [
          valueCell(item.desc),
          valueCell(quantityWithUnit(item.qty, item.unit)),
          valueCell(fixedUnit(item.packages, packageUnitLabel)),
          valueCell(fixedUnit(item.netWeight, "KGS", 3)),
          valueCell(fixedUnit(item.grossWeight, "KGS", 3)),
          valueCell(""),
          valueCell(""),
          valueCell(""),
          valueCell(""),
        ]
      : isQuotation
        ? [
            numberCell(index + 1),
            valueCell(item.image ? "Image Attached" : ""),
            valueCell(item.desc),
            valueCell(item.spec),
            valueCell(item.material),
            valueCell(quantityWithUnit(item.qty, item.unit)),
            numberCell(trimDecimal(item.price), "UnitPrice"),
            numberCell((number(item.qty) * number(item.price)).toFixed(2), "Money"),
            valueCell(""),
          ]
      : [
          numberCell(index + 1),
          valueCell(item.image ? "Image Attached" : ""),
          valueCell(item.desc),
          valueCell(item.spec),
          valueCell(item.material),
          valueCell(item.hsCode),
          valueCell(quantityWithUnit(item.qty, item.unit)),
          numberCell(trimDecimal(item.price), "UnitPrice"),
          numberCell((number(item.qty) * number(item.price)).toFixed(2), "Money"),
        ])),
  ];

  if (!isPackingList) {
    rows.push(
      excelRow([""]),
      excelRow(["", "", "", "", "", "", labelCell("Subtotal"), numberCell(totals.subtotal.toFixed(2), "Money"), ""]),
      excelRow(["", "", "", "", "", "", labelCell("Shipping"), numberCell(number(data.shipping).toFixed(2), "Money"), ""]),
      excelRow(["", "", "", "", "", "", labelCell("Discount"), numberCell(number(data.discount).toFixed(2), "Money"), ""]),
      excelRow(["", "", "", "", "", "", { value: "Total", style: "TotalLabel" }, numberCell(totals.total.toFixed(2), "TotalMoney"), ""]),
    );
  }
  if (isPackingList) {
    rows.push(
      excelRow([""]),
      excelRow(["", "", "", "", labelCell("Total Packages"), valueCell(`${quantity(plTotals.packages)} ${packageUnitLabel}`), "", "", ""]),
      excelRow(["", "", "", "", labelCell("Total Pallets"), valueCell(`${quantity(plTotals.pallets)} PALLETS`), "", "", ""]),
      excelRow(["", "", "", "", labelCell("Total N.W."), valueCell(`${plTotals.netWeight.toFixed(3)} KGS`), "", "", ""]),
      excelRow(["", "", "", "", labelCell("Total G.W."), valueCell(`${plTotals.grossWeight.toFixed(3)} KGS`), "", "", ""]),
      excelRow(["", "", "", "", labelCell("Total CBM"), valueCell(`${plTotals.cbm.toFixed(3)} CBM`), "", "", ""]),
    );
  }

  if (!isPackingList) {
    const terms = isCommercialInvoice
      ? [
          ["Trade Term", data.incoterm],
          ["Country of Origin", data.countryOfOrigin],
          ["Port of Loading", data.loadingPort],
          ["Port of Discharge", data.destinationPort],
          ["Destination", data.tradeDestination],
          ["Packing", data.packing],
          ["Declaration", data.declaration],
        ]
      : [
          ["Incoterm", data.incoterm],
          ["Transport Mode", data.transportMode],
          ["Payment Terms", data.paymentTerms],
          ["Loading Port", data.loadingPort],
          ["Destination Port", data.destinationPort],
          ["Destination", data.tradeDestination],
          ["Lead Time", data.leadTime],
          ["Packing", data.packing],
        ];
    const visibleTermRows = termRows(terms);
    rows.push(
      excelRow([""]),
      ...(visibleTermRows.length ? [excelRow([{ value: "TERMS", style: "Section", mergeAcross: 8 }]), ...visibleTermRows] : []),
      ...(!isCommercialInvoice && bankRows.length ? [excelRow([{ value: "BANK INFORMATION", style: "Section", mergeAcross: 8 }]), ...bankRows.map(([label, value]) => excelRow([labelCell(label), valueCell(value, 7), ""]))] : []),
      ...(text(data.notes, "") ? [excelRow([labelCell("Remarks"), valueCell(data.notes, 7), ""])] : []),
    );
  }
  rows.push(
    excelRow([""]),
    excelRow([{ value: [data.sellerWebsite, data.sellerEmail, data.sellerPhone].map((value) => text(value, "")).filter(Boolean).join(" | "), style: "Footer", mergeAcross: 8 }]),
    excelRow(["", "", "", "", "", "", labelCell("Signature"), valueCell(text(data.signatureText, `For ${text(data.sellerName, "Your Company Ltd.")}`)), ""]),
    excelRow(["", "", "", "", "", "", "", valueCell("Authorized Signature"), ""]),
  );

  const workbook = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook
  xmlns="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:o="urn:schemas-microsoft-com:office:office"
  xmlns:x="urn:schemas-microsoft-com:office:excel"
  xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
  <Styles>
    <Style ss:ID="Default" ss:Name="Normal">
      <Alignment ss:Vertical="Top" ss:WrapText="1"/>
      <Font ss:FontName="Arial" ss:Size="10"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#D9E0E7"/>
      </Borders>
    </Style>
    <Style ss:ID="Title">
      <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
      <Font ss:FontName="Arial" ss:Size="18" ss:Bold="1" ss:Color="#17202A"/>
    </Style>
    <Style ss:ID="Section">
      <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>
      <Font ss:FontName="Arial" ss:Size="10" ss:Bold="1" ss:Color="#0F766E"/>
      <Interior ss:Color="#DFF5F1" ss:Pattern="Solid"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#0F766E"/>
      </Borders>
    </Style>
    <Style ss:ID="Header">
      <Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:WrapText="1"/>
      <Font ss:FontName="Arial" ss:Size="10" ss:Bold="1" ss:Color="#FFFFFF"/>
      <Interior ss:Color="#17202A" ss:Pattern="Solid"/>
    </Style>
    <Style ss:ID="Label">
      <Alignment ss:Vertical="Top" ss:WrapText="1"/>
      <Font ss:FontName="Arial" ss:Size="10" ss:Bold="1" ss:Color="#65717F"/>
    </Style>
    <Style ss:ID="Value">
      <Alignment ss:Vertical="Top" ss:WrapText="1"/>
      <Font ss:FontName="Arial" ss:Size="10" ss:Color="#17202A"/>
    </Style>
    <Style ss:ID="Number">
      <Alignment ss:Horizontal="Right" ss:Vertical="Top"/>
      <Font ss:FontName="Arial" ss:Size="10"/>
      <NumberFormat ss:Format="#,##0.##"/>
    </Style>
    <Style ss:ID="UnitPrice">
      <Alignment ss:Horizontal="Right" ss:Vertical="Top"/>
      <Font ss:FontName="Arial" ss:Size="10"/>
      <NumberFormat ss:Format="#,##0.######"/>
    </Style>
    <Style ss:ID="Money">
      <Alignment ss:Horizontal="Right" ss:Vertical="Top"/>
      <Font ss:FontName="Arial" ss:Size="10"/>
      <NumberFormat ss:Format="#,##0.00"/>
    </Style>
    <Style ss:ID="TotalLabel">
      <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
      <Font ss:FontName="Arial" ss:Size="12" ss:Bold="1" ss:Color="#17202A"/>
      <Borders>
        <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#17202A"/>
      </Borders>
    </Style>
    <Style ss:ID="TotalMoney">
      <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
      <Font ss:FontName="Arial" ss:Size="12" ss:Bold="1" ss:Color="#17202A"/>
      <NumberFormat ss:Format="#,##0.00"/>
      <Borders>
        <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#17202A"/>
      </Borders>
    </Style>
    <Style ss:ID="Footer">
      <Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:WrapText="1"/>
      <Font ss:FontName="Arial" ss:Size="9" ss:Bold="1" ss:Color="#17202A"/>
    </Style>
  </Styles>
  ${excelSheet(documentCode(data.docType), rows)}
</Workbook>`;

  downloadBlob(`\ufeff${workbook}`, buildExcelFileName(data), "application/vnd.ms-excel;charset=utf-8");
}

function replaceItems(items) {
  itemsBody.innerHTML = "";
  items.forEach(addItemRow);
  update();
}

function renderPreview(data) {
  const currency = data.currency || "USD";
  const totals = calculate(data);
  const isPackingList = data.docType === "Packing List";
  const isCommercialInvoice = data.docType === "Commercial Invoice";
  const isQuotation = data.docType === "Quotation";
  const plTotals = packingTotals(data.items);
  const bankRows = bankDetails(data);
  const packageUnitLabel = packageUnit(data);
  const logoHtml = data.logoUrl
    ? `<img class="doc-logo" src="${escapeHtml(data.logoUrl)}" alt="${escapeHtml(text(data.sellerName, "Company logo"))}">`
    : "";
  const footerContact = [data.sellerWebsite, data.sellerEmail, data.sellerPhone].map((value) => text(value, "")).filter(Boolean);
  const rows = data.items
    .filter((item) => item.desc || item.spec || item.material || item.hsCode || item.qty || item.price || item.rmbPrice)
    .map(
      (item, index) => `
        <tr>
          ${
            isPackingList
              ? `
                <td>${escapeHtml(text(item.desc, "Product"))}</td>
                <td>${escapeHtml(quantityWithUnit(item.qty, item.unit))}</td>
                <td>${escapeHtml(fixedUnit(item.packages, packageUnitLabel))}</td>
                <td>${escapeHtml(fixedUnit(item.netWeight, "KGS", 3))}</td>
                <td>${escapeHtml(fixedUnit(item.grossWeight, "KGS", 3))}</td>
              `
              : isQuotation
                ? `
                  <td>${index + 1}</td>
                  <td>${item.image ? `<img class="doc-product-image" src="${escapeHtml(item.image)}" alt="${escapeHtml(text(item.desc, "Product"))}">` : ""}</td>
                  <td>
                    ${escapeHtml(text(item.desc, "Product"))}
                    ${item.spec ? `<br><span class="muted">${escapeHtml(item.spec)}</span>` : ""}
                    ${item.material ? `<br><span class="muted">${escapeHtml(item.material)}</span>` : ""}
                  </td>
                  <td>${escapeHtml(quantityWithUnit(item.qty, item.unit))}</td>
                  <td>${unitMoney(item.price, currency)}</td><td>${money(number(item.qty) * number(item.price), currency)}</td>
                `
              : `
                <td>${index + 1}</td>
                <td>${item.image ? `<img class="doc-product-image" src="${escapeHtml(item.image)}" alt="${escapeHtml(text(item.desc, "Product"))}">` : ""}</td>
                <td>
                  ${escapeHtml(text(item.desc, "Product"))}
                  ${item.spec ? `<br><span class="muted">${escapeHtml(item.spec)}</span>` : ""}
                  ${item.material ? `<br><span class="muted">${escapeHtml(item.material)}</span>` : ""}
                </td>
                <td>${escapeHtml(text(item.hsCode, ""))}</td>
                <td>${escapeHtml(quantityWithUnit(item.qty, item.unit))}</td>
                <td>${unitMoney(item.price, currency)}</td><td>${money(number(item.qty) * number(item.price), currency)}</td>
              `
          }
        </tr>`,
    )
    .join("");

  preview.innerHTML = `
    <header class="doc-head">
      <div class="doc-brand">
        ${logoHtml}
        <div>
          <div class="doc-title">${escapeHtml(data.docType)}</div>
          <p>${escapeHtml(text(data.sellerName, "Your Company Ltd."))}</p>
        </div>
      </div>
      <div class="doc-meta">
        <p><strong>No.</strong> ${escapeHtml(text(data.docNo))}</p>
        ${data.poNo ? `<p><strong>PO No.</strong> ${escapeHtml(data.poNo)}</p>` : ""}
        <p><strong>Date</strong> ${escapeHtml(text(data.docDate))}</p>
        ${data.docType === "Quotation" && data.validUntil ? `<p><strong>Valid Until</strong> ${escapeHtml(data.validUntil)}</p>` : ""}
      </div>
    </header>

    <section class="doc-parties">
      <div class="doc-block">
        <h3>Seller</h3>
        <p><strong>${escapeHtml(text(data.sellerName, "Your Company Ltd."))}</strong></p>
        <p>${escapeHtml(text(data.sellerAddress))}</p>
        <p>${escapeHtml(text(data.sellerContact))}</p>
        <p>${escapeHtml(text(data.sellerEmail))}</p>
      </div>
      <div class="doc-block">
        <h3>Buyer</h3>
        <p><strong>${escapeHtml(text(data.buyerName, "Customer Company"))}</strong></p>
        <p>${escapeHtml(text(data.buyerAddress))}</p>
        <p>${escapeHtml(text(data.buyerCountry))}</p>
        <p>${escapeHtml(text(data.buyerContact))}</p>
        <p>${escapeHtml(text(data.buyerEmail))}</p>
      </div>
    </section>

    ${isPackingList && data.shippingMark ? `<section class="doc-notes packing-mark"><h3>Shipping Mark</h3><p>${escapeHtml(data.shippingMark)}</p></section>` : ""}

    <table class="doc-items ${isPackingList ? "packing-table" : ""}">
      <thead>
        <tr>
          ${isPackingList
            ? "<th>Description</th><th>Qty</th><th>Packages</th><th>N.W.</th><th>G.W.</th>"
            : isQuotation
              ? "<th>#</th><th>Image</th><th>Description</th><th>Qty</th><th>Unit Price</th><th>Amount</th>"
            : "<th>#</th><th>Image</th><th>Description</th><th>HS Code</th><th>Qty</th><th>Unit Price</th><th>Amount</th>"
          }
        </tr>
      </thead>
      <tbody>${rows || `<tr><td colspan="${isPackingList ? 5 : isQuotation ? 6 : 7}">No items</td></tr>`}</tbody>
    </table>

    ${isPackingList ? `<section class="packing-summary">
      <div><span>Total Packages</span><strong>${quantity(plTotals.packages)} ${packageUnitLabel}</strong></div>
      <div><span>Total Pallets</span><strong>${quantity(plTotals.pallets)} PALLETS</strong></div>
      <div><span>Total N.W.</span><strong>${plTotals.netWeight.toFixed(3)} KGS</strong></div>
      <div><span>Total G.W.</span><strong>${plTotals.grossWeight.toFixed(3)} KGS</strong></div>
      <div><span>Total CBM</span><strong>${plTotals.cbm.toFixed(3)} CBM</strong></div>
    </section>` : ""}

    ${isPackingList ? "" : `<section class="doc-summary">
      <div class="summary-row"><span>Subtotal</span><strong>${money(totals.subtotal, currency)}</strong></div>
      <div class="summary-row"><span>Shipping</span><strong>${money(data.shipping, currency)}</strong></div>
      <div class="summary-row"><span>Discount</span><strong>${money(data.discount, currency)}</strong></div>
      <div class="summary-row total"><span>Total</span><strong>${money(totals.total, currency)}</strong></div>
    </section>`}

    ${isPackingList ? "" : `<section class="doc-terms">
      ${
        isCommercialInvoice
          ? `
            ${termBlock("Trade Term", data.incoterm)}
            ${termBlock("Country of Origin", data.countryOfOrigin)}
            ${termBlock("Port of Loading", data.loadingPort)}
            ${termBlock("Port of Discharge", data.destinationPort)}
            ${termBlock("Destination", data.tradeDestination)}
            ${termBlock("Packing", data.packing)}
          `
          : `
            ${termBlock("Incoterm", data.incoterm)}
            ${termBlock("Transport Mode", data.transportMode)}
            ${termBlock("Payment Terms", data.paymentTerms)}
            ${termBlock("Loading Port", data.loadingPort)}
            ${termBlock("Destination Port", data.destinationPort)}
            ${termBlock("Destination", data.tradeDestination)}
            ${termBlock("Lead Time", data.leadTime)}
            ${termBlock("Packing", data.packing)}
          `
      }
    </section>`}

    ${isCommercialInvoice && data.declaration ? `<section class="doc-notes"><h3>Declaration</h3><p>${escapeHtml(data.declaration)}</p></section>` : ""}
    ${!isPackingList && !isCommercialInvoice && bankRows.length ? `<section class="doc-notes"><h3>Bank Information</h3>${bankRows.map(([label, value]) => `<p><strong>${escapeHtml(label)}:</strong> ${escapeHtml(value)}</p>`).join("")}</section>` : ""}
    ${!isPackingList && data.notes ? `<section class="doc-notes"><h3>Remarks</h3><p>${escapeHtml(data.notes)}</p></section>` : ""}

    <footer class="doc-signature">
      <span class="doc-footer-contact">${escapeHtml(footerContact.join(" | "))}</span>
      <span class="signature-line">
        <strong>${escapeHtml(text(data.signatureText, `For ${text(data.sellerName, "Your Company Ltd.")}`))}</strong>
        <i></i>
        <span>Authorized Signature</span>
      </span>
    </footer>
  `;
}

function saveDraft(data) {
  clearTimeout(saveTimer);
  saveState.textContent = "正在保存...";
  saveTimer = setTimeout(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(data));
      saveState.textContent = "已保存草稿";
    } catch (error) {
      console.warn(error);
      saveState.textContent = "草稿过大未自动保存";
    }
  }, 250);
}

function update() {
  [...itemsBody.querySelectorAll(".item-row")].forEach(updateRow);
  const data = getData();
  itemsBody.querySelectorAll(".item-package-wrap").forEach((wrap) => {
    wrap.dataset.unit = packageUnit(data);
  });
  renderPreview(data);
  saveDraft(data);
}

function loadDraft() {
  try {
    const pending = QuoteRecordsStore.pendingOpen?.();
    const saved = JSON.parse(localStorage.getItem(storageKey));
    setData({ ...(saved || defaults), docDate: pending?.id ? (saved?.docDate || todayString()) : todayString() });
    form.dataset.recordId = pending?.id || saved?.recordId || "";
    QuoteRecordsStore.clearPendingOpen?.();
  } catch {
    setData({ ...defaults, docDate: todayString() });
    form.dataset.recordId = "";
  }
  update();
}

document.querySelector("#addItemBtn").addEventListener("click", () => {
  addItemRow();
  update();
});

document.querySelector("#exportExcelBtn").addEventListener("click", async () => {
  await saveQuoteRecord();
  exportQuoteExcel();
});
document.querySelector("#saveQuoteRecordBtn").addEventListener("click", () => {
  saveQuoteRecord();
});
document.querySelector("#saveQuoteRecordAsBtn").addEventListener("click", () => {
  saveQuoteRecord({ asNew: true });
});

  document.querySelectorAll('input[name="docType"]').forEach((input) => {
  input.addEventListener("change", () => {
    syncDocumentNumberPrefix();
    syncDocumentMode();
    update();
  });
});

togglePreviewBtn.addEventListener("click", () => {
  setPreviewVisible(appShell.classList.contains("preview-hidden"));
});

logoFile.addEventListener("change", (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.addEventListener("load", () => {
    const imageData = String(reader.result || "");
    form.elements.logoUrl.value = imageData;
    setLogoPreview(imageData);
    update();
  });
  reader.readAsDataURL(file);
});

document.querySelector("#parsePasteBtn").addEventListener("click", () => {
  const items = parseBulkItems(bulkInput.value);
  if (!items.length) {
    parseStatus.textContent = "没有识别到产品。请尽量按“产品 规格 数量 人民币单价”或 Excel 表格行粘贴。";
    return;
  }
  replaceItems(items);
  parseStatus.textContent = `已识别 ${items.length} 个产品，并按当前汇率自动换算美元单价。`;
});

document.querySelector("#clearPasteBtn").addEventListener("click", () => {
  bulkInput.value = "";
  parseStatus.textContent = "粘贴区已清空。";
});

document.querySelector("#printBtn").addEventListener("click", async () => {
  await saveQuoteRecord();
  const originalTitle = document.title;
  document.title = buildPdfFileName(getData()).replace(/\.pdf$/i, "");
  window.print();
  setTimeout(() => {
    document.title = originalTitle;
  }, 1000);
});

document.querySelector("#resetBtn").addEventListener("click", () => {
  const ok = window.confirm("确定要清空当前内容吗？");
  if (!ok) return;
  localStorage.removeItem(storageKey);
  oldStorageKeys.forEach((key) => localStorage.removeItem(key));
  setData({
    ...defaults,
    docNo: `QT-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, "0")}-${String(Date.now()).slice(-4)}`,
  });
  form.dataset.recordId = "";
  bulkInput.value = "";
  parseStatus.textContent = "已清空当前内容。";
  update();
});

form.addEventListener("input", update);
form.addEventListener("change", update);
form.elements.exchangeRate?.addEventListener("input", () => {
  convertAllRmbToUsd();
  update();
});
form.elements.priceMode?.addEventListener("change", () => {
  convertAllRmbToUsd();
  update();
});

loadDraft();
syncDocumentMode();
setPreviewVisible(localStorage.getItem("quotation-preview-visible") !== "0");
