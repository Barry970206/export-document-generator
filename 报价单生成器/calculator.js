const quoteStorageKey = "export-document-generator-v3";
const calculatorStorageKey = "quotation-profit-calculator-v1";
const logisticsStorageKey = "logisticsProfiles";
const form = document.querySelector("#profitForm");
const itemsBody = document.querySelector("#profitItemsBody");
const itemTemplate = document.querySelector("#profitItemTemplate");
const generateStatus = document.querySelector("#generateStatus");
const packagingStore = window.PackagingDatabase;

let packagingItems = packagingStore.getItems();
let packagingProfiles = packagingStore.getProfiles();
let logisticsProfiles = getLogisticsProfiles();

const defaults = {
  docType: "Quotation",
  currency: "USD",
  exchangeRate: 7.2,
  priceMode: "cnyToUsd",
  countryOfOrigin: "China",
  packageUnit: "CARTONS",
  signatureText: "Authorized Signature",
  logoUrl: "",
};

const sampleItem = {
  productName: "Pan Head Machine Screw",
  qty: 5000,
  unit: "PCS",
  unitWeightGram: 0,
  purchasePrice: 0,
  packingCost: 0,
  freightInsurance: 0,
};

const orderLogistics = {
  profile: document.querySelector("#orderLogisticsProfile"),
  billingMethod: document.querySelector("#orderLogisticsBillingMethod"),
  currency: document.querySelector("#orderLogisticsCurrency"),
  unitPrice: document.querySelector("#orderLogisticsUnitPrice"),
  minimumCharge: document.querySelector("#orderLogisticsMinimumCharge"),
  profileTotalCost: document.querySelector("#orderLogisticsProfileTotalCost"),
  costRmb: document.querySelector("#orderLogisticsCostRmb"),
  costSource: document.querySelector("#orderLogisticsCostSource"),
  allocationMethod: document.querySelector("#orderLogisticsAllocationMethod"),
  totalWeightKg: document.querySelector("#orderTotalWeightKg"),
  totalCbm: document.querySelector("#orderTotalCbm"),
};

const orderOuterPackaging = {
  mode: document.querySelector("#outerPackagingMode"),
  cartonId: document.querySelector("#outerCartonId"),
  innerPacksPerCarton: document.querySelector("#outerInnerPacksPerCarton"),
  manualCartonQty: document.querySelector("#outerManualCartonQty"),
  usePallet: document.querySelector("#outerUsePallet"),
  palletId: document.querySelector("#outerPalletId"),
  cartonsPerPallet: document.querySelector("#outerCartonsPerPallet"),
  manualPalletQty: document.querySelector("#outerManualPalletQty"),
  orderWeightKg: document.querySelector("#outerOrderWeightKg"),
  totalInnerPackQty: document.querySelector("#outerTotalInnerPackQty"),
  cartonQty: document.querySelector("#outerCartonQty"),
  palletQty: document.querySelector("#outerPalletQty"),
  totalCbm: document.querySelector("#outerTotalCbm"),
  packagingCostRmb: document.querySelector("#outerPackagingCostRmb"),
};

function number(value, fallback = 0) {
  const parsed = Number(String(value ?? "").replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function formatNumber(value, decimals = 2) {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(number(value));
}

function setText(id, value) {
  const node = document.querySelector(`#${id}`);
  if (node) node.textContent = value;
}

function roundUpUsd(value) {
  if (value <= 0) return 0;
  if (value < 1) return Math.ceil(value * 10000) / 10000;
  if (value < 10) return Math.ceil(value * 100) / 100;
  return Math.ceil(value * 10) / 10;
}

function profileById(id) {
  if (!id) return null;
  return packagingProfiles.find((profile) => profile.id === id) || null;
}

function profileName(id) {
  return packagingStore.displayName(profileById(id));
}

function normalizeLogisticsProfile(profile) {
  return window.LogisticsUtils.normalizeLogisticsProfile(profile || {});
}

function getLogisticsProfiles() {
  try {
    const parsed = JSON.parse(localStorage.getItem(logisticsStorageKey));
    return Array.isArray(parsed) ? parsed.map(normalizeLogisticsProfile) : [];
  } catch {
    return [];
  }
}

function logisticsProfileById(id) {
  if (!id) return null;
  return logisticsProfiles.find((profile) => profile.id === id) || null;
}

function logisticsAmountToRmb(amount, currency, settings) {
  const normalizedCurrency = String(currency || "CNY").toUpperCase();
  if (normalizedCurrency === "USD") return amount * settings.exchangeRate;
  return amount;
}

function optionalNumber(value) {
  if (value === null || value === undefined || String(value).trim() === "") return null;
  return Math.max(Math.ceil(number(value)), 0);
}

function packagingItemById(id) {
  return packagingItems.find((item) => item.id === id) || null;
}

function profileItemById(profile, keys) {
  const keyList = Array.isArray(keys) ? keys : [keys];
  for (const key of keyList) {
    const item = packagingItemById(profile?.[key]);
    if (item) return item;
  }
  return null;
}

function cbmFromPackagingItem(item) {
  return item ? packagingStore.cbmFromDimensions(item) : 0;
}

function palletizedCbm(carton, pallet, cartonQty, palletQty) {
  const safeCartonQty = Math.max(number(cartonQty), 0);
  const safePalletQty = Math.max(number(palletQty), 0);
  if (safePalletQty <= 0) return safeCartonQty * cbmFromPackagingItem(carton);

  const cartonLengthCm = number(carton?.lengthCm);
  const cartonWidthCm = number(carton?.widthCm);
  const cartonHeightCm = number(carton?.heightCm);
  const palletLengthCm = number(pallet?.lengthCm);
  const palletWidthCm = number(pallet?.widthCm);
  const palletHeightCm = number(pallet?.heightCm);
  const cartonsPerLayer =
    cartonLengthCm > 0 && cartonWidthCm > 0 && palletLengthCm > 0 && palletWidthCm > 0
      ? Math.floor(palletLengthCm / cartonLengthCm) * Math.floor(palletWidthCm / cartonWidthCm)
      : 0;
  const cartonsOnEachPallet = Math.ceil(safeCartonQty / safePalletQty);
  const layers = cartonsPerLayer > 0 && cartonsOnEachPallet > 0 ? Math.ceil(cartonsOnEachPallet / cartonsPerLayer) : 0;
  const loadedPalletHeightCm = palletHeightCm + layers * cartonHeightCm;
  return palletLengthCm > 0 && palletWidthCm > 0 && loadedPalletHeightCm > 0
    ? (safePalletQty * palletLengthCm * palletWidthCm * loadedPalletHeightCm) / 1000000
    : safeCartonQty * cbmFromPackagingItem(carton) + safePalletQty * cbmFromPackagingItem(pallet);
}

function appendSelectOption(select, value, label, selectedValue) {
  const option = document.createElement("option");
  option.value = value || "";
  option.textContent = label;
  option.selected = String(value || "") === String(selectedValue || "");
  select.append(option);
}

function fillProfileSelect(select, selectedValue) {
  while (select.firstChild) select.firstChild.remove();
  appendSelectOption(select, "", "不使用包装方案", selectedValue);
  packagingProfiles.forEach((profile) => appendSelectOption(select, profile.id, packagingStore.displayName(profile), selectedValue));
}

function fillOrderLogisticsSelect(selectedValue) {
  const select = orderLogistics.profile;
  while (select.firstChild) select.firstChild.remove();
  appendSelectOption(select, "", "不使用物流方案", selectedValue);
  logisticsProfiles.forEach((profile) => {
    const label = [profile.name, profile.countryRegion, profile.incoterm, profile.transportMode].filter(Boolean).join(" / ");
    appendSelectOption(select, profile.id, label, selectedValue);
  });
}

function fillPackagingItemSelect(select, type, selectedValue, emptyLabel) {
  while (select.firstChild) select.firstChild.remove();
  appendSelectOption(select, "", emptyLabel, selectedValue);
  packagingItems
    .filter((item) => item.type === type)
    .forEach((item) => appendSelectOption(select, item.id, packagingStore.displayName(item), selectedValue));
}

function fillOuterPackagingSelects(selected = {}) {
  fillPackagingItemSelect(orderOuterPackaging.cartonId, "carton", selected.cartonId || orderOuterPackaging.cartonId?.value || "", "不指定外箱");
  fillPackagingItemSelect(orderOuterPackaging.palletId, "pallet", selected.palletId || orderOuterPackaging.palletId?.value || "", "不使用托盘");
}

function profitStatus(rate, profit) {
  if (profit < 0) return { label: "亏损", className: "status-loss" };
  if (rate < 10) return { label: "偏低", className: "status-low" };
  if (rate <= 20) return { label: "正常", className: "status-normal" };
  return { label: "优秀", className: "status-excellent" };
}

function globalSettings() {
  return {
    exchangeRate: Math.max(number(form.elements.exchangeRate?.value, defaults.exchangeRate), 0.0001),
    targetProfitRate: Math.min(Math.max(number(form.elements.targetProfitRate?.value), 0), 99.99),
  };
}

function orderLogisticsSettings() {
  return {
    profileId: orderLogistics.profile?.value || "",
    billingMethod: orderLogistics.billingMethod?.value || "按重量(KG)",
    allocationMethod: orderLogistics.allocationMethod?.value || "weight",
  };
}

function outerPackagingSettings() {
  return {
    mode: orderOuterPackaging.mode?.value || "independent",
    cartonId: orderOuterPackaging.cartonId?.value || "",
    innerPacksPerCarton: Math.max(number(orderOuterPackaging.innerPacksPerCarton?.value), 0),
    manualCartonQty: optionalNumber(orderOuterPackaging.manualCartonQty?.value),
    usePallet: orderOuterPackaging.usePallet?.value === "1",
    palletId: orderOuterPackaging.palletId?.value || "",
    cartonsPerPallet: Math.max(number(orderOuterPackaging.cartonsPerPallet?.value), 0),
    manualPalletQty: optionalNumber(orderOuterPackaging.manualPalletQty?.value),
  };
}

function readItem(row) {
  return {
    productName: row.querySelector(".profit-product-name").value.trim(),
    spec: row.querySelector(".profit-spec").value.trim(),
    material: row.querySelector(".profit-material").value.trim(),
    qty: Math.max(number(row.querySelector(".profit-qty").value), 0),
    unit: row.querySelector(".profit-unit").value.trim() || "PCS",
    unitWeightGram: Math.max(number(row.querySelector(".profit-unit-weight").value), 0),
    packagingProfileId: row.querySelector(".profit-packaging-profile").value,
    manualCartonQty: row.querySelector(".profit-manual-cartons").value,
    manualPalletQty: row.querySelector(".profit-manual-pallets").value,
    purchasePrice: Math.max(number(row.querySelector(".profit-purchase").value), 0),
    packingCost: Math.max(number(row.querySelector(".profit-packing").value), 0),
    freightInsurance: Math.max(number(row.querySelector(".profit-freight").value), 0),
  };
}

function emptyPackaging(totalWeightKg = 0) {
  return {
    totalWeightKg,
    innerPackQty: 0,
    cartonQty: 0,
    palletQty: 0,
    totalCbm: 0,
    grossWeightKg: totalWeightKg,
    packagingCost: 0,
    packagingCostPerPiece: 0,
    innerPackagingCost: 0,
    innerPackagingCostPerPiece: 0,
    outerPackagingCost: 0,
    outerPackagingCostPerPiece: 0,
  };
}

function calculateIndependentPackaging(item) {
  const packagingProfile = profileById(item.packagingProfileId);
  if (packagingProfile) {
    const packaging = packagingStore.calculate(
      {
        quantity: item.qty,
        unitWeightGram: item.unitWeightGram,
        manualCartonQty: item.manualCartonQty,
        manualPalletQty: item.manualPalletQty,
      },
      packagingProfile,
      packagingItems,
    );
    const innerPackaging = calculateInnerPackaging(item);
    const innerPackagingCost = innerPackaging.innerPackagingCost;
    const outerPackagingCost = Math.max(number(packaging.packagingCost) - innerPackagingCost, 0);
    const packagingCost = innerPackagingCost + outerPackagingCost;
    return {
      ...packaging,
      grossWeightKg: packaging.grossWeightKg ?? packaging.totalWeightKg,
      innerPackQty: Math.max(number(packaging.innerPackQty), innerPackaging.innerPackQty),
      packagingCost,
      packagingCostPerPiece: item.qty > 0 ? packagingCost / item.qty : 0,
      innerPackagingCost,
      innerPackagingCostPerPiece: item.qty > 0 ? innerPackagingCost / item.qty : 0,
      outerPackagingCost,
      outerPackagingCostPerPiece: item.qty > 0 ? outerPackagingCost / item.qty : 0,
    };
  }

  const totalWeightKg = (item.qty * item.unitWeightGram) / 1000;
  return emptyPackaging(totalWeightKg);
}

function calculateInnerPackaging(item) {
  const totalWeightKg = (item.qty * item.unitWeightGram) / 1000;
  const packagingProfile = profileById(item.packagingProfileId);
  if (!packagingProfile) return emptyPackaging(totalWeightKg);

  const innerPackage = profileItemById(packagingProfile, ["innerPackageId", "innerPackage", "innerPackageID"]);
  const innerQtyPerPack = Math.max(number(packagingProfile.innerQtyPerPack), 0);
  const innerCapacityPcs = Math.max(number(innerPackage?.capacityPcs), 0);
  const innerCapacityKg = Math.max(number(innerPackage?.capacityKg), 0);
  const innerMaxWeightKg = Math.max(number(innerPackage?.maxWeightKg), 0);
  let innerPackQty = 0;

  if (innerPackage && innerQtyPerPack > 0) {
    innerPackQty = Math.ceil(item.qty / innerQtyPerPack);
  } else if (innerPackage && innerCapacityPcs > 0) {
    innerPackQty = Math.ceil(item.qty / innerCapacityPcs);
  } else if (innerPackage && innerCapacityKg > 0) {
    innerPackQty = Math.ceil(totalWeightKg / innerCapacityKg);
  } else if (innerPackage && innerMaxWeightKg > 0) {
    innerPackQty = Math.ceil(totalWeightKg / innerMaxWeightKg);
  }

  const innerPackagingCost = innerPackQty * number(innerPackage?.unitCostRmb);
  return {
    ...emptyPackaging(totalWeightKg),
    innerPackQty,
    packagingCost: innerPackagingCost,
    packagingCostPerPiece: item.qty > 0 ? innerPackagingCost / item.qty : 0,
    innerPackagingCost,
    innerPackagingCostPerPiece: item.qty > 0 ? innerPackagingCost / item.qty : 0,
  };
}

function calculateBaseItem(item, outerSettings) {
  const packaging = outerSettings.mode === "combined" ? calculateInnerPackaging(item) : calculateIndependentPackaging(item);
  return {
    ...item,
    packaging,
    packagingProfileName: profileName(item.packagingProfileId),
    productAmountRmb: item.purchasePrice * item.qty,
    logisticsCostRmb: 0,
    logisticsCostPerPieceRmb: 0,
  };
}

function calculateOrderOuterPackaging(baseResults, settings) {
  const orderTotalWeightKg = baseResults.reduce((sum, item) => sum + item.packaging.totalWeightKg, 0);
  const totalInnerPackQty = baseResults.reduce((sum, item) => sum + item.packaging.innerPackQty, 0);
  const pallet = packagingItemById(settings.palletId);
  const independentCartonQty = baseResults.reduce((sum, item) => sum + item.packaging.cartonQty, 0);

  if (settings.mode !== "combined") {
    const independentPalletQty = !settings.usePallet
      ? baseResults.reduce((sum, item) => sum + item.packaging.palletQty, 0)
      : settings.manualPalletQty !== null
        ? settings.manualPalletQty
        : settings.cartonsPerPallet > 0
          ? Math.ceil(independentCartonQty / settings.cartonsPerPallet)
          : 0;
    const itemCbm = baseResults.reduce((sum, item) => sum + item.packaging.totalCbm, 0);
    const carton = packagingItemById(settings.cartonId);
    const recalculatedPalletCbm = settings.usePallet && carton ? palletizedCbm(carton, pallet, independentCartonQty, independentPalletQty) : itemCbm;
    const palletCost = settings.usePallet ? independentPalletQty * number(pallet?.unitCostRmb) : 0;
    return {
      mode: settings.mode,
      orderTotalWeightKg,
      totalInnerPackQty,
      cartonQty: independentCartonQty,
      palletQty: independentPalletQty,
      totalCbm: settings.usePallet ? recalculatedPalletCbm : itemCbm,
      outerPackagingCost: palletCost,
    };
  }

  const carton = packagingItemById(settings.cartonId);
  const cartonCapacityPcs = Math.max(number(carton?.capacityPcs), 0);
  const cartonCapacityKg = Math.max(number(carton?.capacityKg), 0);
  const activeQuantity = baseResults.reduce((sum, item) => sum + number(item.qty), 0);
  const cartonQty =
    settings.manualCartonQty !== null
      ? settings.manualCartonQty
      : settings.innerPacksPerCarton > 0
        ? Math.ceil(totalInnerPackQty / settings.innerPacksPerCarton)
        : cartonCapacityPcs > 0
          ? Math.ceil(activeQuantity / cartonCapacityPcs)
          : cartonCapacityKg > 0
            ? Math.ceil(orderTotalWeightKg / cartonCapacityKg)
            : number(carton?.maxWeightKg) > 0
              ? Math.ceil(orderTotalWeightKg / number(carton.maxWeightKg))
              : 0;
  const palletQty = !settings.usePallet
    ? 0
    : settings.manualPalletQty !== null
      ? settings.manualPalletQty
      : settings.cartonsPerPallet > 0
        ? Math.ceil(cartonQty / settings.cartonsPerPallet)
        : 0;
  const cartonCost = cartonQty * number(carton?.unitCostRmb);
  const palletCost = palletQty * number(pallet?.unitCostRmb);
  const totalCbm = settings.usePallet && palletQty > 0 ? palletizedCbm(carton, pallet, cartonQty, palletQty) : cartonQty * cbmFromPackagingItem(carton);

  return {
    mode: settings.mode,
    orderTotalWeightKg,
    totalInnerPackQty,
    cartonQty,
    palletQty,
    totalCbm,
    outerPackagingCost: cartonCost + palletCost,
  };
}

function applyCombinedOuterPackaging(baseResults, orderOuterResult) {
  if (orderOuterResult.mode !== "combined") return baseResults;
  const orderWeight = orderOuterResult.orderTotalWeightKg;
  return baseResults.map((item) => {
    const weightShare = orderWeight > 0 ? item.packaging.totalWeightKg / orderWeight : 0;
    const outerCost = orderOuterResult.outerPackagingCost * weightShare;
    const outerCostPerPiece = item.qty > 0 ? outerCost / item.qty : 0;
    const cartonQty = orderOuterResult.cartonQty * weightShare;
    const palletQty = orderOuterResult.palletQty * weightShare;
    const totalCbm = orderOuterResult.totalCbm * weightShare;
    const packagingCost = item.packaging.innerPackagingCost + outerCost;
    return {
      ...item,
      packaging: {
        ...item.packaging,
        cartonQty,
        palletQty,
        totalCbm,
        packagingCost,
        packagingCostPerPiece: item.qty > 0 ? packagingCost / item.qty : 0,
        outerPackagingCost: outerCost,
        outerPackagingCostPerPiece: outerCostPerPiece,
      },
    };
  });
}

function calculateOrderLogistics(baseResults, settings) {
  const selected = orderLogisticsSettings();
  const profile = logisticsProfileById(selected.profileId);
  const orderTotalWeightKg = baseResults.reduce((sum, item) => sum + item.packaging.totalWeightKg, 0);
  const orderTotalCbm = baseResults.reduce((sum, item) => sum + item.packaging.totalCbm, 0);
  const currency = profile?.currency || "CNY";
  const unitPrice = profile?.unitPrice || 0;
  const minimumCharge = profile?.minimumCharge || 0;
  const costSummary = profile ? window.LogisticsUtils.calculateLogisticsCostSummary(profile, { exchangeRate: settings.exchangeRate }) : null;
  const profileTotalCost = costSummary?.totalRmb || 0;
  let rawCost = 0;
  let costSource = profile ? "未填写有效物流费用" : "未选择物流方案";

  if (profile) {
    if (profileTotalCost > 0) {
      rawCost = profileTotalCost;
      costSource = "使用费用明细折算总价";
    } else if (selected.billingMethod === "按重量(KG)") {
      rawCost = orderTotalWeightKg * unitPrice;
      if (minimumCharge > 0) rawCost = Math.max(rawCost, minimumCharge);
      costSource = "按重量计算";
    } else if (selected.billingMethod === "按体积(CBM)") {
      rawCost = orderTotalCbm * unitPrice;
      if (minimumCharge > 0) rawCost = Math.max(rawCost, minimumCharge);
      costSource = "按体积计算";
    } else if (selected.billingMethod === "直接总价") {
      rawCost = profileTotalCost;
      costSource = "使用方案总价";
    }
  }

  const logisticsCostRmb = profileTotalCost > 0 || selected.billingMethod === "直接总价" ? rawCost : logisticsAmountToRmb(rawCost, currency, settings);
  return {
    profile,
    billingMethod: selected.billingMethod,
    allocationMethod: selected.allocationMethod,
    orderTotalWeightKg,
    orderTotalCbm,
    logisticsCostRmb,
    currency,
    unitPrice,
    minimumCharge,
    profileTotalCost,
    costSummary,
    costSource,
  };
}

function applyLogisticsAllocation(baseResults, orderLogisticsResult) {
  const totalQty = baseResults.reduce((sum, item) => sum + item.qty, 0);
  const totalWeight = orderLogisticsResult.orderTotalWeightKg;
  const totalAmount = baseResults.reduce((sum, item) => sum + item.productAmountRmb, 0);

  return baseResults.map((item) => {
    let basis = 0;
    let totalBasis = 0;
    if (orderLogisticsResult.allocationMethod === "quantity") {
      basis = item.qty;
      totalBasis = totalQty;
    } else if (orderLogisticsResult.allocationMethod === "amount") {
      basis = item.productAmountRmb;
      totalBasis = totalAmount;
    } else {
      basis = item.packaging.totalWeightKg;
      totalBasis = totalWeight;
    }

    const logisticsCostRmb = totalBasis > 0 ? (orderLogisticsResult.logisticsCostRmb * basis) / totalBasis : 0;
    return {
      ...item,
      logisticsCostRmb,
      logisticsCostPerPieceRmb: item.qty > 0 ? logisticsCostRmb / item.qty : 0,
    };
  });
}

function calculatePricedItem(item, settings) {
  const unitCost =
    item.purchasePrice +
    item.packingCost +
    item.packaging.packagingCostPerPiece +
    item.freightInsurance +
    item.logisticsCostPerPieceRmb;
  const totalCost = unitCost * item.qty;
  const costUsd = unitCost / settings.exchangeRate;
  const targetUsd = unitCost > 0 ? unitCost / (1 - settings.targetProfitRate / 100) / settings.exchangeRate : 0;
  const suggestedUsd = roundUpUsd(targetUsd);
  const suggestedRmb = suggestedUsd * settings.exchangeRate;
  const unitProfit = suggestedRmb - unitCost;
  const totalProfit = unitProfit * item.qty;
  const totalRmb = suggestedRmb * item.qty;
  const actualProfitRate = suggestedRmb > 0 ? (unitProfit / suggestedRmb) * 100 : 0;

  return {
    ...item,
    unitCost,
    totalCost,
    costUsd,
    targetUsd,
    minimumUsd: costUsd,
    suggestedUsd,
    suggestedRmb,
    unitProfit,
    totalProfit,
    totalRmb,
    actualProfitRate,
    status: profitStatus(actualProfitRate, unitProfit).label,
  };
}

function writeRowResult(row, result) {
  row.querySelector(".profit-packaging-cost-piece").textContent = formatNumber(result.packaging.packagingCostPerPiece, 4);
  row.querySelector(".profit-packaging-cost-detail").textContent = formatNumber(result.packaging.packagingCostPerPiece, 4);
  row.querySelector(".profit-logistics-cost-piece").textContent = formatNumber(result.logisticsCostPerPieceRmb, 4);
  row.querySelector(".profit-unit-cost").textContent = formatNumber(result.unitCost, 4);
  row.querySelector(".profit-minimum-usd").textContent = formatNumber(result.costUsd, 4);
  row.querySelector(".profit-suggested-usd").textContent = formatNumber(result.suggestedUsd, 4);
  row.querySelector(".profit-rate").textContent = `${formatNumber(result.actualProfitRate, 2)}%`;
  row.querySelector(".profit-total-weight").textContent = formatNumber(result.packaging.totalWeightKg, 3);
  row.querySelector(".profit-inner-pack-qty").textContent = formatNumber(result.packaging.innerPackQty, 0);
  row.querySelector(".profit-carton-qty").textContent = formatNumber(result.packaging.cartonQty, 2).replace(/\.00$/, "");
  row.querySelector(".profit-pallet-qty").textContent = formatNumber(result.packaging.palletQty, 2).replace(/\.00$/, "");
  row.querySelector(".profit-packaging-total").textContent = formatNumber(result.packaging.packagingCost, 2);
  row.querySelector(".profit-total-cbm").textContent = formatNumber(result.packaging.totalCbm, 3);

  const status = profitStatus(result.actualProfitRate, result.unitProfit);
  row.dataset.status = status.className;
}

function writeOrderLogisticsResult(result) {
  orderLogistics.totalWeightKg.textContent = formatNumber(result.orderTotalWeightKg, 3);
  orderLogistics.totalCbm.textContent = formatNumber(result.orderTotalCbm, 3);
  orderLogistics.currency.value = result.currency;
  orderLogistics.unitPrice.value = number(result.unitPrice);
  orderLogistics.minimumCharge.value = number(result.minimumCharge);
  orderLogistics.profileTotalCost.value = number(result.profileTotalCost);
  orderLogistics.costRmb.textContent = formatNumber(result.logisticsCostRmb, 2);
  orderLogistics.costSource.textContent = result.costSource;
}

function writeOrderOuterPackagingResult(result) {
  orderOuterPackaging.orderWeightKg.textContent = formatNumber(result.orderTotalWeightKg, 3);
  orderOuterPackaging.totalInnerPackQty.textContent = formatNumber(result.totalInnerPackQty, 0);
  orderOuterPackaging.cartonQty.textContent = formatNumber(result.cartonQty, 2).replace(/\.00$/, "");
  orderOuterPackaging.palletQty.textContent = formatNumber(result.palletQty, 2).replace(/\.00$/, "");
  orderOuterPackaging.totalCbm.textContent = formatNumber(result.totalCbm, 3);
  orderOuterPackaging.packagingCostRmb.textContent = formatNumber(result.outerPackagingCost, 2);
}

function applySelectedLogisticsProfile() {
  const profile = logisticsProfileById(orderLogistics.profile.value);
  if (!profile) {
    orderLogistics.currency.value = "CNY";
    orderLogistics.unitPrice.value = 0;
    orderLogistics.minimumCharge.value = 0;
    orderLogistics.profileTotalCost.value = 0;
    return;
  }
  orderLogistics.billingMethod.value = profile.billingMethod;
  orderLogistics.currency.value = profile.currency;
  orderLogistics.unitPrice.value = number(profile.unitPrice);
  orderLogistics.minimumCharge.value = number(profile.minimumCharge);
  orderLogistics.profileTotalCost.value = number(profile.totalCost);
}

function calculate() {
  packagingItems = packagingStore.getItems();
  packagingProfiles = packagingStore.getProfiles();
  logisticsProfiles = getLogisticsProfiles();
  const settings = globalSettings();
  const outerSettings = outerPackagingSettings();
  const rows = [...itemsBody.querySelectorAll(".profit-item-row")];
  const baseResults = rows.map((row) => calculateBaseItem(readItem(row), outerSettings));
  const activeBaseResults = baseResults.filter(
    (item) =>
      item.productName ||
      item.unitWeightGram ||
      item.purchasePrice ||
      item.packingCost ||
      item.freightInsurance ||
      item.manualCartonQty ||
      item.manualPalletQty,
  );
  const orderOuterResult = calculateOrderOuterPackaging(activeBaseResults, outerSettings);
  const packagedActiveResults = applyCombinedOuterPackaging(activeBaseResults, orderOuterResult);
  const orderLogisticsResult = calculateOrderLogistics(packagedActiveResults, settings);
  const allocatedById = new Map(
    applyLogisticsAllocation(packagedActiveResults, orderLogisticsResult).map((item, index) => [`${index}`, item]),
  );
  const activeRows = rows.filter((_, index) => activeBaseResults.includes(baseResults[index]));
  const pricedResults = activeRows.map((row, index) => {
    const result = calculatePricedItem(allocatedById.get(`${index}`), settings);
    writeRowResult(row, result);
    return result;
  });

  rows.forEach((row, index) => {
    if (!activeBaseResults.includes(baseResults[index])) {
      const result = calculatePricedItem({ ...baseResults[index], logisticsCostRmb: 0, logisticsCostPerPieceRmb: 0 }, settings);
      writeRowResult(row, result);
    }
  });

  writeOrderOuterPackagingResult(orderOuterResult);
  writeOrderLogisticsResult(orderLogisticsResult);

  const totalQty = pricedResults.reduce((sum, item) => sum + item.qty, 0);
  const totalCost = pricedResults.reduce((sum, item) => sum + item.totalCost, 0);
  const totalRmb = pricedResults.reduce((sum, item) => sum + item.totalRmb, 0);
  const totalUsd = pricedResults.reduce((sum, item) => sum + item.suggestedUsd * item.qty, 0);
  const totalProfit = pricedResults.reduce((sum, item) => sum + item.totalProfit, 0);
  const overallProfitRate = totalRmb > 0 ? (totalProfit / totalRmb) * 100 : 0;
  const status = profitStatus(overallProfitRate, totalProfit);
  const badge = document.querySelector("#profitBadge");

  setText("productCount", String(pricedResults.length));
  setText("totalQty", formatNumber(totalQty, 0));
  setText("totalCost", formatNumber(totalCost, 2));
  setText("totalUsd", `$${formatNumber(totalUsd, 2)}`);
  setText("totalRmb", formatNumber(totalRmb, 2));
  setText("totalProfit", formatNumber(totalProfit, 2));
  setText("overallProfitRate", `${formatNumber(overallProfitRate, 2)}%`);

  if (badge) {
    badge.textContent = status.label;
    badge.className = `profit-badge ${status.className}`;
  }

  const result = {
    settings,
    orderOuterPackaging: orderOuterResult,
    outerPackagingSettings: outerSettings,
    orderLogistics: orderLogisticsResult,
    results: pricedResults,
    totalQty,
    totalCost,
    totalRmb,
    totalUsd,
    totalProfit,
    overallProfitRate,
    status: status.label,
  };
  saveCalculatorDraft();
  return result;
}

function addItemRow(item = sampleItem) {
  const row = itemTemplate.content.firstElementChild.cloneNode(true);
  const selectedProfileId = item.packagingProfileId || "";
  row.querySelector(".profit-product-name").value = item.productName || "";
  row.querySelector(".profit-spec").value = item.spec || "";
  row.querySelector(".profit-material").value = item.material || "";
  row.querySelector(".profit-qty").value = number(item.qty, 1);
  row.querySelector(".profit-unit").value = item.unit || "PCS";
  row.querySelector(".profit-unit-weight").value = number(item.unitWeightGram);
  fillProfileSelect(row.querySelector(".profit-packaging-profile"), selectedProfileId);
  row.querySelector(".profit-manual-cartons").value = item.manualCartonQty ?? "";
  row.querySelector(".profit-manual-pallets").value = item.manualPalletQty ?? "";
  row.querySelector(".profit-purchase").value = number(item.purchasePrice);
  row.querySelector(".profit-packing").value = number(item.packingCost);
  row.querySelector(".profit-freight").value = number(item.freightInsurance);
  row.querySelector(".profit-packaging-profile").addEventListener("change", calculate);
  row.querySelectorAll("input, textarea").forEach((input) => input.addEventListener("input", calculate));
  row.querySelector(".remove-profit-item").addEventListener("click", () => {
    if (itemsBody.children.length === 1) addItemRow({ productName: "", qty: 1, unit: "PCS", unitWeightGram: 0, purchasePrice: 0, packingCost: 0, freightInsurance: 0 });
    row.remove();
    calculate();
  });
  itemsBody.append(row);
  calculate();
}

function documentNumber() {
  const now = new Date();
  return `QT-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}-${String(Date.now()).slice(-4)}`;
}

function existingQuoteDraft() {
  try {
    return JSON.parse(localStorage.getItem(quoteStorageKey)) || {};
  } catch {
    return {};
  }
}

function existingCalculatorDraft() {
  try {
    return JSON.parse(localStorage.getItem(calculatorStorageKey)) || null;
  } catch {
    return null;
  }
}

function calculatorRows() {
  return [...itemsBody.querySelectorAll(".profit-item-row")].map(readItem);
}

function calculatorDraftData() {
  const settings = globalSettings();
  return {
    exchangeRate: settings.exchangeRate,
    targetProfitRate: settings.targetProfitRate,
    outerPackagingMode: orderOuterPackaging.mode.value,
    outerCartonId: orderOuterPackaging.cartonId.value,
    outerInnerPacksPerCarton: orderOuterPackaging.innerPacksPerCarton.value,
    outerManualCartonQty: orderOuterPackaging.manualCartonQty.value,
    outerUsePallet: orderOuterPackaging.usePallet.value,
    outerPalletId: orderOuterPackaging.palletId.value,
    outerCartonsPerPallet: orderOuterPackaging.cartonsPerPallet.value,
    outerManualPalletQty: orderOuterPackaging.manualPalletQty.value,
    orderLogisticsProfileId: orderLogistics.profile.value,
    orderLogisticsBillingMethod: orderLogistics.billingMethod.value,
    orderLogisticsAllocationMethod: orderLogistics.allocationMethod.value,
    items: calculatorRows(),
  };
}

function saveCalculatorDraft() {
  const draft = calculatorDraftData();
  localStorage.setItem(calculatorStorageKey, JSON.stringify(draft));
  return draft;
}

async function generateQuote() {
  const result = calculate();
  if (!result.results.length) {
    generateStatus.textContent = "请先添加至少一个产品。";
    return;
  }

  const saved = existingQuoteDraft();
  const packingNames = [...new Set(result.results.map((item) => item.packagingProfileName).filter(Boolean))].join(" / ");
  const isCombinedOuterPackaging = result.outerPackagingSettings.mode === "combined";
  const quoteData = {
    ...defaults,
    ...saved,
    docType: "Quotation",
    docNo: saved.docNo || documentNumber(),
    docDate: saved.docDate || new Date().toISOString().slice(0, 10),
    currency: "USD",
    exchangeRate: result.settings.exchangeRate,
    priceMode: "cnyToUsd",
    packing: packingNames || saved.packing || "",
    notes: saved.notes || "",
    orderLogisticsProfileId: orderLogistics.profile.value,
    orderLogisticsProfileName: result.orderLogistics.profile?.name || "",
    orderLogisticsCostRmb: result.orderLogistics.logisticsCostRmb,
    orderLogisticsAllocationMethod: result.orderLogistics.allocationMethod,
    outerPackagingMode: result.outerPackagingSettings.mode,
    outerCartonId: result.outerPackagingSettings.cartonId,
    outerInnerPacksPerCarton: result.outerPackagingSettings.innerPacksPerCarton,
    outerManualCartonQty: result.outerPackagingSettings.manualCartonQty ?? "",
    outerUsePallet: result.outerPackagingSettings.usePallet ? "1" : "0",
    outerPalletId: result.outerPackagingSettings.palletId,
    outerCartonsPerPallet: result.outerPackagingSettings.cartonsPerPallet,
    outerManualPalletQty: result.outerPackagingSettings.manualPalletQty ?? "",
    outerCartonQty: result.orderOuterPackaging.cartonQty,
    outerPalletQty: result.orderOuterPackaging.palletQty,
    outerTotalWeightKg: result.orderOuterPackaging.orderTotalWeightKg,
    outerTotalCbm: result.orderOuterPackaging.totalCbm,
    outerPackagingCostRmb: result.orderOuterPackaging.outerPackagingCost,
    items: result.results.map((item, index) => ({
      image: "",
      desc: item.productName || "Product",
      spec: item.spec || "",
      material: item.material || "",
      hsCode: "",
      qty: item.qty || 1,
      unit: item.unit,
      unitWeightGram: item.unitWeightGram,
      packagingProfileId: item.packagingProfileId,
      packagingProfileName: item.packagingProfileName,
      logisticsCostRmb: item.logisticsCostRmb,
      logisticsCostPerPieceRmb: item.logisticsCostPerPieceRmb,
      manualCartonQty: item.manualCartonQty,
      manualPalletQty: item.manualPalletQty,
      cartonQty: item.packaging.cartonQty,
      palletQty: item.packaging.palletQty,
      totalWeightKg: item.packaging.totalWeightKg,
      grossWeightKg: item.packaging.grossWeightKg,
      totalCbm: item.packaging.totalCbm,
      packages: isCombinedOuterPackaging ? (index === 0 ? result.orderOuterPackaging.cartonQty : 0) : item.packaging.cartonQty,
      pallets: isCombinedOuterPackaging ? (index === 0 ? result.orderOuterPackaging.palletQty : 0) : item.packaging.palletQty,
      netWeight: item.packaging.totalWeightKg,
      grossWeight: item.packaging.grossWeightKg,
      cbm: isCombinedOuterPackaging ? (index === 0 ? result.orderOuterPackaging.totalCbm : 0) : item.packaging.totalCbm,
      rmbPrice: item.suggestedRmb,
      price: item.suggestedUsd,
    })),
  };

  quoteData.calculatorData = saveCalculatorDraft();
  localStorage.setItem(quoteStorageKey, JSON.stringify(quoteData));
  try {
    await QuoteRecordsStore.upsert(QuoteRecordsStore.quoteRecordFromData(quoteData, { total: result.totalUsd }));
  } catch (error) {
    console.error(error);
  }
  generateStatus.textContent = `已生成 ${result.results.length} 个产品的报价单草稿，正在打开报价单页面...`;
  window.location.href = "index.html";
}

async function saveCalculatorRecord() {
  const result = calculate();
  if (!result.results.length) {
    generateStatus.textContent = "请先添加至少一个产品，再保存草稿。";
    return;
  }

  const saved = existingQuoteDraft();
  const packingNames = [...new Set(result.results.map((item) => item.packagingProfileName).filter(Boolean))].join(" / ");
  const isCombinedOuterPackaging = result.outerPackagingSettings.mode === "combined";
  const quoteData = {
    ...defaults,
    ...saved,
    docType: "Quotation",
    docNo: saved.docNo || documentNumber(),
    docDate: saved.docDate || new Date().toISOString().slice(0, 10),
    currency: "USD",
    exchangeRate: result.settings.exchangeRate,
    priceMode: "cnyToUsd",
    packing: packingNames || saved.packing || "",
    notes: saved.notes || "",
    orderLogisticsProfileId: orderLogistics.profile.value,
    orderLogisticsProfileName: result.orderLogistics.profile?.name || "",
    orderLogisticsCostRmb: result.orderLogistics.logisticsCostRmb,
    orderLogisticsAllocationMethod: result.orderLogistics.allocationMethod,
    outerPackagingMode: result.outerPackagingSettings.mode,
    outerCartonId: result.outerPackagingSettings.cartonId,
    outerInnerPacksPerCarton: result.outerPackagingSettings.innerPacksPerCarton,
    outerManualCartonQty: result.outerPackagingSettings.manualCartonQty ?? "",
    outerUsePallet: result.outerPackagingSettings.usePallet ? "1" : "0",
    outerPalletId: result.outerPackagingSettings.palletId,
    outerCartonsPerPallet: result.outerPackagingSettings.cartonsPerPallet,
    outerManualPalletQty: result.outerPackagingSettings.manualPalletQty ?? "",
    outerCartonQty: result.orderOuterPackaging.cartonQty,
    outerPalletQty: result.orderOuterPackaging.palletQty,
    outerTotalWeightKg: result.orderOuterPackaging.orderTotalWeightKg,
    outerTotalCbm: result.orderOuterPackaging.totalCbm,
    outerPackagingCostRmb: result.orderOuterPackaging.outerPackagingCost,
    calculatorData: saveCalculatorDraft(),
    items: result.results.map((item, index) => ({
      image: "",
      desc: item.productName || "Product",
      spec: item.spec || "",
      material: item.material || "",
      hsCode: "",
      qty: item.qty || 1,
      unit: item.unit,
      unitWeightGram: item.unitWeightGram,
      packagingProfileId: item.packagingProfileId,
      packagingProfileName: item.packagingProfileName,
      logisticsCostRmb: item.logisticsCostRmb,
      logisticsCostPerPieceRmb: item.logisticsCostPerPieceRmb,
      manualCartonQty: item.manualCartonQty,
      manualPalletQty: item.manualPalletQty,
      cartonQty: item.packaging.cartonQty,
      palletQty: item.packaging.palletQty,
      totalWeightKg: item.packaging.totalWeightKg,
      grossWeightKg: item.packaging.grossWeightKg,
      totalCbm: item.packaging.totalCbm,
      packages: isCombinedOuterPackaging ? (index === 0 ? result.orderOuterPackaging.cartonQty : 0) : item.packaging.cartonQty,
      pallets: isCombinedOuterPackaging ? (index === 0 ? result.orderOuterPackaging.palletQty : 0) : item.packaging.palletQty,
      netWeight: item.packaging.totalWeightKg,
      grossWeight: item.packaging.grossWeightKg,
      cbm: isCombinedOuterPackaging ? (index === 0 ? result.orderOuterPackaging.totalCbm : 0) : item.packaging.totalCbm,
      rmbPrice: item.suggestedRmb,
      price: item.suggestedUsd,
    })),
  };
  localStorage.setItem(quoteStorageKey, JSON.stringify(quoteData));
  try {
    const record = QuoteRecordsStore.quoteRecordFromData(quoteData, { total: result.totalUsd });
    const savedRecord = await QuoteRecordsStore.upsert(record);
    generateStatus.textContent = `已保存到报价记录：${savedRecord.documentNo}`;
  } catch (error) {
    console.error(error);
    generateStatus.textContent = `保存失败：${error.message || error}`;
  }
}

function hydrateFromDraft() {
  const calculatorDraft = existingCalculatorDraft();
  if (calculatorDraft?.exchangeRate) form.elements.exchangeRate.value = calculatorDraft.exchangeRate;
  if (calculatorDraft?.targetProfitRate !== undefined) form.elements.targetProfitRate.value = calculatorDraft.targetProfitRate;
  fillOuterPackagingSelects({
    cartonId: calculatorDraft?.outerCartonId || "",
    palletId: calculatorDraft?.outerPalletId || "",
  });
  if (calculatorDraft?.outerPackagingMode) orderOuterPackaging.mode.value = calculatorDraft.outerPackagingMode;
  if (calculatorDraft?.outerInnerPacksPerCarton !== undefined) orderOuterPackaging.innerPacksPerCarton.value = calculatorDraft.outerInnerPacksPerCarton;
  if (calculatorDraft?.outerManualCartonQty !== undefined) orderOuterPackaging.manualCartonQty.value = calculatorDraft.outerManualCartonQty;
  if (calculatorDraft?.outerUsePallet !== undefined) orderOuterPackaging.usePallet.value = calculatorDraft.outerUsePallet;
  if (calculatorDraft?.outerCartonsPerPallet !== undefined) orderOuterPackaging.cartonsPerPallet.value = calculatorDraft.outerCartonsPerPallet;
  if (calculatorDraft?.outerManualPalletQty !== undefined) orderOuterPackaging.manualPalletQty.value = calculatorDraft.outerManualPalletQty;
  fillOrderLogisticsSelect(calculatorDraft?.orderLogisticsProfileId || "");
  if (calculatorDraft?.orderLogisticsBillingMethod) orderLogistics.billingMethod.value = calculatorDraft.orderLogisticsBillingMethod;
  if (calculatorDraft?.orderLogisticsAllocationMethod) orderLogistics.allocationMethod.value = calculatorDraft.orderLogisticsAllocationMethod;

  if (Array.isArray(calculatorDraft?.items) && calculatorDraft.items.length) {
    calculatorDraft.items.forEach(addItemRow);
    return;
  }

  const saved = existingQuoteDraft();
  if (saved.exchangeRate) form.elements.exchangeRate.value = saved.exchangeRate;
  fillOuterPackagingSelects({
    cartonId: saved.outerCartonId || "",
    palletId: saved.outerPalletId || "",
  });
  if (saved.outerPackagingMode) orderOuterPackaging.mode.value = saved.outerPackagingMode;
  if (saved.outerInnerPacksPerCarton !== undefined) orderOuterPackaging.innerPacksPerCarton.value = saved.outerInnerPacksPerCarton;
  if (saved.outerManualCartonQty !== undefined) orderOuterPackaging.manualCartonQty.value = saved.outerManualCartonQty;
  if (saved.outerUsePallet !== undefined) orderOuterPackaging.usePallet.value = saved.outerUsePallet;
  if (saved.outerCartonsPerPallet !== undefined) orderOuterPackaging.cartonsPerPallet.value = saved.outerCartonsPerPallet;
  if (saved.outerManualPalletQty !== undefined) orderOuterPackaging.manualPalletQty.value = saved.outerManualPalletQty;
  if (saved.orderLogisticsProfileId) {
    fillOrderLogisticsSelect(saved.orderLogisticsProfileId);
  }
  const quoteItems = Array.isArray(saved.items) ? saved.items : [];
  if (!quoteItems.length) {
    addItemRow(sampleItem);
    return;
  }

  quoteItems.forEach((item) =>
    addItemRow({
      productName: item.desc || "",
      spec: item.spec || "",
      material: item.material || "",
      qty: item.qty || 1,
      unit: item.unit || "PCS",
      unitWeightGram: item.unitWeightGram || 0,
      packagingProfileId: item.packagingProfileId || "",
      manualCartonQty: item.manualCartonQty ?? "",
      manualPalletQty: item.manualPalletQty ?? "",
      purchasePrice: 0,
      packingCost: 0,
      freightInsurance: 0,
    }),
  );
}

form.addEventListener("input", calculate);
form.addEventListener("change", calculate);
orderLogistics.profile.addEventListener("change", () => {
  applySelectedLogisticsProfile();
  calculate();
});
orderLogistics.billingMethod.addEventListener("change", calculate);
orderLogistics.allocationMethod.addEventListener("change", calculate);
document.querySelector("#addProductBtn").addEventListener("click", () => {
  addItemRow({ productName: "", qty: 1, unit: "PCS", unitWeightGram: 0, purchasePrice: 0, packingCost: 0, freightInsurance: 0 });
});
document.querySelector("#saveCalculatorRecordBtn").addEventListener("click", saveCalculatorRecord);
document.querySelector("#generateQuoteBtn").addEventListener("click", generateQuote);

fillOrderLogisticsSelect("");
hydrateFromDraft();
applySelectedLogisticsProfile();
calculate();
