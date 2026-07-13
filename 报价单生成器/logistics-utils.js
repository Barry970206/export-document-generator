(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.LogisticsUtils = factory();
  }
})(typeof window !== "undefined" ? window : globalThis, function () {
  const incoterms = ["EXW", "FOB", "CFR", "CIF", "DAP", "DDP"];
  const transportModes = ["快递", "空运", "海运拼箱", "海运整柜", "铁路", "海派", "空派", "卡航", "专线"];
  const billingMethods = ["按重量(KG)", "按体积(CBM)", "直接总价"];
  const currencies = ["CNY", "USD", "EUR", "GBP", "HKD", "JPY"];
  const defaultExchangeRate = 7.2;
  const defaultCostItems = [
    { name: "海运费", currency: "USD", unit: "/20GP" },
    { name: "港杂费", currency: "CNY", unit: "/20GP" },
    { name: "THC", currency: "CNY", unit: "/20GP" },
    { name: "文件费", currency: "CNY", unit: "/票" },
    { name: "报关费", currency: "CNY", unit: "/票" },
  ];

  function number(value, fallback = 0) {
    const parsed = Number(String(value ?? "").replace(/,/g, ""));
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function roundMoney(value) {
    return Math.round(number(value) * 10000) / 10000;
  }

  function currencyRate(currency, settings = {}) {
    const normalized = String(currency || "CNY").toUpperCase();
    if (normalized === "CNY") return 1;
    if (normalized === "USD") return number(settings.exchangeRate, defaultExchangeRate) || defaultExchangeRate;
    const customRates = settings.exchangeRates || {};
    return number(customRates[normalized], number(settings.exchangeRate, defaultExchangeRate)) || 1;
  }

  function normalizeCostItem(item = {}, index = 0, fallbackCurrency = "CNY") {
    const currency = currencies.includes(String(item.currency || fallbackCurrency).toUpperCase())
      ? String(item.currency || fallbackCurrency).toUpperCase()
      : "CNY";
    return {
      id: String(item.id || `cost-${Date.now()}-${index}`),
      name: String(item.name || "其他费用").trim() || "其他费用",
      currency,
      amount: Math.max(number(item.amount), 0),
      unit: String(item.unit || item.billingUnit || "").trim(),
      quantity: Math.max(number(item.quantity, 1), 0) || 1,
      remark: String(item.remark || "").trim(),
    };
  }

  function normalizeLogisticsProfile(profile = {}) {
    const now = new Date().toISOString();
    const currency = currencies.includes(String(profile.currency || "").toUpperCase()) ? String(profile.currency).toUpperCase() : "CNY";
    const hasCostItems = Array.isArray(profile.costItems);
    const costItems = (hasCostItems
      ? profile.costItems
      : number(profile.totalCost) > 0
        ? [{ id: "legacy-total", name: "原物流总成本", currency, amount: number(profile.totalCost), unit: "总价", quantity: 1 }]
        : defaultCostItems.map((item, index) => ({ id: `default-${index + 1}`, amount: 0, quantity: 1, ...item })))
      .map((item, index) => normalizeCostItem(item, index, currency));
    const exchangeRate = Math.max(number(profile.exchangeRate, defaultExchangeRate), 0) || defaultExchangeRate;
    const normalized = {
      ...profile,
      id: profile.id || `logistics-${Date.now()}`,
      name: String(profile.name || "新物流方案").trim() || "新物流方案",
      countryRegion: String(profile.countryRegion || "").trim(),
      originPort: String(profile.originPort || "").trim(),
      destinationPort: String(profile.destinationPort || "").trim(),
      supplier: String(profile.supplier || profile.logisticsSupplier || "").trim(),
      carrier: String(profile.carrier || "").trim(),
      sailingSchedule: String(profile.sailingSchedule || "").trim(),
      containerType: String(profile.containerType || "20GP").trim() || "20GP",
      incoterm: incoterms.includes(profile.incoterm) ? profile.incoterm : "FOB",
      transportMode: transportModes.includes(profile.transportMode) ? profile.transportMode : "海运整柜",
      billingMethod: billingMethods.includes(profile.billingMethod) ? profile.billingMethod : "直接总价",
      currency,
      exchangeRate,
      unitPrice: Math.max(number(profile.unitPrice), 0),
      minimumCharge: Math.max(number(profile.minimumCharge), 0),
      costItems,
      remark: String(profile.remark || "").trim(),
      createdAt: profile.createdAt || now,
      updatedAt: profile.updatedAt || profile.updatedTime || profile.createdAt || now,
    };
    normalized.totalCost = calculateLogisticsCostSummary(normalized, { exchangeRate }).totalRmb;
    return normalized;
  }

  function calculateLogisticsCostSummary(profile = {}, settings = {}) {
    const exchangeRate = Math.max(number(settings.exchangeRate, profile.exchangeRate || defaultExchangeRate), 0) || defaultExchangeRate;
    const rows = (Array.isArray(profile.costItems) ? profile.costItems : []).map((item, index) => {
      const normalized = normalizeCostItem(item, index, profile.currency || "CNY");
      const originalTotal = roundMoney(normalized.amount * normalized.quantity);
      const rate = currencyRate(normalized.currency, { ...settings, exchangeRate });
      const totalRmb = roundMoney(originalTotal * rate);
      return {
        ...normalized,
        originalTotal,
        exchangeRate: rate,
        totalRmb,
      };
    });
    const foreignTotals = rows.reduce((totals, row) => {
      if (row.currency !== "CNY") totals[row.currency] = roundMoney(number(totals[row.currency]) + row.originalTotal);
      return totals;
    }, {});
    const localTotalRmb = roundMoney(rows.filter((row) => row.currency === "CNY").reduce((sum, row) => sum + row.totalRmb, 0));
    const totalRmb = roundMoney(rows.reduce((sum, row) => sum + row.totalRmb, 0));
    return { rows, foreignTotals, localTotalRmb, totalRmb, exchangeRate };
  }

  return {
    incoterms,
    transportModes,
    billingMethods,
    currencies,
    defaultExchangeRate,
    defaultCostItems,
    number,
    normalizeCostItem,
    normalizeLogisticsProfile,
    calculateLogisticsCostSummary,
  };
});
