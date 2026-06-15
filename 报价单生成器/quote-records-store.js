(function () {
  const recordsKey = "quoteRecords";
  const quoteDraftKey = "export-document-generator-v3";
  const calculatorDraftKey = "quotation-profit-calculator-v1";
  const pendingRecordKey = "quote-records-pending-open";
  let migrationPromise = null;

  function readJson(key, fallback) {
    try {
      const value = JSON.parse(localStorage.getItem(key));
      return value ?? fallback;
    } catch {
      return fallback;
    }
  }

  function writeJson(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function id() {
    return `qr-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function documentType(value) {
    if (value === "Quotation" || value === "quotation") return "quotation";
    if (value === "Proforma Invoice") return "pi";
    if (value === "Commercial Invoice") return "ci";
    if (value === "Packing List") return "pl";
    if (value === "pi" || value === "ci" || value === "pl") return value;
    return "quotation";
  }

  function documentName(value) {
    if (value === "pi") return "Proforma Invoice";
    if (value === "ci") return "Commercial Invoice";
    if (value === "pl") return "Packing List";
    return "Quotation";
  }

  function code(value) {
    if (value === "pi") return "PI";
    if (value === "ci") return "CI";
    if (value === "pl") return "PL";
    return "QT";
  }

  function newDocumentNo(type) {
    const now = new Date();
    return `${code(type)}-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}-${String(Date.now()).slice(-4)}`;
  }

  function today() {
    return new Date().toISOString().slice(0, 10);
  }

  function stripBase64Image(value) {
    return String(value || "").startsWith("data:") ? "" : value || "";
  }

  function stripLargeImages(data = {}) {
    const copy = { ...data };
    copy.logoUrl = stripBase64Image(copy.logoUrl);
    copy.items = (Array.isArray(data.items) ? data.items : []).map((item) => ({
      ...item,
      image: stripBase64Image(item.image),
    }));
    return copy;
  }

  function productSummaries(items) {
    return (Array.isArray(items) ? items : []).map((item, index) => ({
      productId: item.productId || item.id || `product-${index + 1}`,
      productName: item.productName || item.desc || "Product",
      imageId: item.imageId || "",
    }));
  }

  function compactRecord(record = {}) {
    const rawData = stripLargeImages(record.rawData || {});
    return {
      ...record,
      products: productSummaries(record.products?.length ? record.products : rawData.items || []),
      sellerInfo: {
        ...(record.sellerInfo || {}),
        logoUrl: stripBase64Image(record.sellerInfo?.logoUrl),
      },
      rawData,
    };
  }

  async function migrateLocalRecords() {
    const oldRecords = readJson(recordsKey, []);
    if (!Array.isArray(oldRecords) || !oldRecords.length) {
      localStorage.removeItem(recordsKey);
      return;
    }
    for (const oldRecord of oldRecords) {
      await window.saveQuote(compactRecord(oldRecord));
    }
    localStorage.removeItem(recordsKey);
  }

  function migrateOnce() {
    if (!migrationPromise) migrationPromise = migrateLocalRecords();
    return migrationPromise;
  }

  async function records() {
    await migrateOnce();
    const values = await window.listQuotes();
    return (Array.isArray(values) ? values : []).map(compactRecord);
  }

  function quoteRecordFromData(data, totals = {}, options = {}) {
    const now = new Date().toISOString();
    const safeData = stripLargeImages(data);
    const type = documentType(data.docType);
    return {
      id: options.id || data.recordId || id(),
      documentNo: data.docNo || newDocumentNo(type),
      documentType: type,
      customerName: data.buyerName || "",
      date: data.docDate || today(),
      totalAmount: Number(totals.total ?? 0),
      currency: data.currency || "USD",
      products: productSummaries(safeData.items),
      sellerInfo: {
        sellerName: data.sellerName || "",
        sellerAddress: data.sellerAddress || "",
        sellerContact: data.sellerContact || "",
        sellerEmail: data.sellerEmail || "",
        sellerWebsite: data.sellerWebsite || "",
        sellerPhone: data.sellerPhone || "",
        logoUrl: safeData.logoUrl || "",
      },
      buyerInfo: {
        buyerName: data.buyerName || "",
        buyerAddress: data.buyerAddress || "",
        buyerCountry: data.buyerCountry || "",
        buyerContact: data.buyerContact || "",
        buyerEmail: data.buyerEmail || "",
      },
      tradeTerms: {
        incoterm: data.incoterm || "",
        transportMode: data.transportMode || "",
        tradeDestination: data.tradeDestination || "",
        loadingPort: data.loadingPort || "",
        destinationPort: data.destinationPort || "",
        leadTime: data.leadTime || "",
        paymentTerms: data.paymentTerms || "",
        packing: data.packing || "",
        countryOfOrigin: data.countryOfOrigin || "",
        declaration: data.declaration || "",
        shipping: data.shipping ?? 0,
        discount: data.discount ?? 0,
        notes: data.notes || "",
        packageUnit: data.packageUnit || "CARTONS",
        shippingMark: data.shippingMark || "",
        signatureText: data.signatureText || "",
      },
      packagingData: {
        outerPackagingMode: data.outerPackagingMode || "",
        outerCartonId: data.outerCartonId || "",
        outerInnerPacksPerCarton: data.outerInnerPacksPerCarton ?? "",
        outerManualCartonQty: data.outerManualCartonQty ?? "",
        outerUsePallet: data.outerUsePallet ?? "",
        outerPalletId: data.outerPalletId || "",
        outerCartonsPerPallet: data.outerCartonsPerPallet ?? "",
        outerManualPalletQty: data.outerManualPalletQty ?? "",
        outerCartonQty: data.outerCartonQty ?? 0,
        outerPalletQty: data.outerPalletQty ?? 0,
        outerTotalWeightKg: data.outerTotalWeightKg ?? 0,
        outerTotalCbm: data.outerTotalCbm ?? 0,
        outerPackagingCostRmb: data.outerPackagingCostRmb ?? 0,
      },
      logisticsData: {
        orderLogisticsProfileId: data.orderLogisticsProfileId || "",
        orderLogisticsProfileName: data.orderLogisticsProfileName || "",
        orderLogisticsCostRmb: data.orderLogisticsCostRmb ?? 0,
        orderLogisticsAllocationMethod: data.orderLogisticsAllocationMethod || "",
      },
      calculatorData: data.calculatorData || readJson(calculatorDraftKey, null),
      rawData: safeData,
      createdAt: options.createdAt || now,
      updatedAt: now,
    };
  }

  function dataFromRecord(record) {
    const raw = record.rawData || {};
    return {
      ...raw,
      docType: raw.docType || documentName(record.documentType),
      docNo: record.documentNo || raw.docNo || newDocumentNo(record.documentType),
      docDate: record.date || raw.docDate || today(),
      buyerName: raw.buyerName || record.buyerInfo?.buyerName || record.customerName || "",
      items: raw.items || [],
      recordId: record.id || raw.recordId || "",
    };
  }

  async function upsert(record) {
    await migrateOnce();
    const existing = record.id ? await window.loadQuote(record.id) : null;
    const next = compactRecord({
      ...record,
      createdAt: existing?.createdAt || record.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    await window.saveQuote(next);
    return next;
  }

  async function remove(idValue) {
    await migrateOnce();
    await window.deleteQuote(idValue);
  }

  async function duplicate(idValue) {
    await migrateOnce();
    const source = await window.loadQuote(idValue);
    if (!source) return null;
    const type = source.documentType || "quotation";
    const nextNo = newDocumentNo(type);
    const nextDate = today();
    const rawData = {
      ...dataFromRecord(source),
      recordId: "",
      docNo: nextNo,
      docDate: nextDate,
      validUntil: "",
    };
    const now = new Date().toISOString();
    const next = compactRecord({
      ...source,
      id: id(),
      documentNo: nextNo,
      date: nextDate,
      rawData,
      createdAt: now,
      updatedAt: now,
    });
    await window.saveQuote(next);
    return next;
  }

  async function openRecord(idValue) {
    await migrateOnce();
    const record = await window.loadQuote(idValue);
    if (!record) return null;
    writeJson(quoteDraftKey, dataFromRecord(record));
    if (record.calculatorData) writeJson(calculatorDraftKey, record.calculatorData);
    else localStorage.removeItem(calculatorDraftKey);
    writeJson(pendingRecordKey, { id: record.id, openedAt: new Date().toISOString() });
    return record;
  }

  function pendingOpen() {
    return readJson(pendingRecordKey, null);
  }

  function clearPendingOpen() {
    localStorage.removeItem(pendingRecordKey);
  }

  window.QuoteRecordsStore = {
    records,
    upsert,
    remove,
    duplicate,
    openRecord,
    pendingOpen,
    clearPendingOpen,
    quoteRecordFromData,
    dataFromRecord,
    newDocumentNo,
    today,
    documentName,
    documentType,
    quoteDraftKey,
    calculatorDraftKey,
  };
})();
