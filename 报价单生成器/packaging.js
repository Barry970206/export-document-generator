(function () {
  const itemStorageKey = "export-packaging-items-v2";
  const profileStorageKey = "export-packaging-profiles-v2";
  const languageStorageKey = "export-packaging-language-v1";

  const defaultPackagingItems = [
    {
      id: "inner-pe-bag",
      name: "PE Inner Bag",
      nameZh: "PE 内袋",
      type: "inner",
      lengthCm: 18,
      widthCm: 12,
      heightCm: 1,
      unitCostRmb: 0.08,
      maxWeightKg: null,
      capacityPcs: 100,
      capacityKg: null,
      tareWeightKg: 0.002,
      remark: "Inner poly bag",
    },
    {
      id: "inner-small-box",
      name: "Small Inner Box",
      nameZh: "小内盒",
      type: "inner",
      lengthCm: 12,
      widthCm: 8,
      heightCm: 5,
      unitCostRmb: 0.35,
      maxWeightKg: null,
      capacityPcs: 50,
      capacityKg: 2.5,
      tareWeightKg: 0.03,
      remark: "Inner box per pack",
    },
    {
      id: "carton-export-a",
      name: "Export Carton A",
      nameZh: "出口纸箱 A",
      type: "carton",
      lengthCm: 40,
      widthCm: 30,
      heightCm: 28,
      unitCostRmb: 5.8,
      maxWeightKg: 20,
      capacityPcs: null,
      capacityKg: null,
      tareWeightKg: 0.45,
      remark: "Standard export carton",
    },
    {
      id: "carton-heavy-duty",
      name: "Heavy Duty Carton",
      nameZh: "重型出口纸箱",
      type: "carton",
      lengthCm: 45,
      widthCm: 35,
      heightCm: 30,
      unitCostRmb: 8.5,
      maxWeightKg: 25,
      capacityPcs: null,
      capacityKg: null,
      tareWeightKg: 0.65,
      remark: "For heavier fasteners",
    },
    {
      id: "pallet-plywood",
      name: "Plywood Pallet",
      nameZh: "胶合板托盘",
      type: "pallet",
      lengthCm: 110,
      widthCm: 110,
      heightCm: 15,
      unitCostRmb: 95,
      maxWeightKg: 850,
      capacityPcs: null,
      capacityKg: null,
      tareWeightKg: 18,
      remark: "Export plywood pallet",
    },
  ];

  const defaultPackagingProfiles = [
    {
      id: "inner-box-only",
      name: "Inner Box Only",
      nameZh: "仅内盒包装",
      packageLevel: "product",
      innerPackageId: "inner-small-box",
      innerQtyPerPack: 50,
      cartonId: "",
      innerPacksPerCarton: null,
      palletId: "",
      cartonsPerPallet: null,
      usePallet: false,
      remark: "Inner box only",
    },
    {
      id: "pe-bag-only",
      name: "PE Bag Packing",
      nameZh: "PE袋包装",
      packageLevel: "product",
      innerPackageId: "inner-pe-bag",
      innerQtyPerPack: 10000,
      cartonId: "",
      innerPacksPerCarton: null,
      palletId: "",
      cartonsPerPallet: null,
      usePallet: false,
      remark: "PE bag only",
    },
    {
      id: "standard-export-carton",
      name: "Standard Export Carton",
      nameZh: "标准出口纸箱",
      packageLevel: "order",
      innerPackageId: "",
      innerQtyPerPack: null,
      cartonId: "carton-export-a",
      innerPacksPerCarton: null,
      palletId: "",
      cartonsPerPallet: null,
      usePallet: false,
      remark: "Order-level carton packing",
    },
    {
      id: "standard-pallet-packing",
      name: "Standard Pallet Packing",
      nameZh: "标准托盘包装",
      packageLevel: "order",
      innerPackageId: "",
      innerQtyPerPack: null,
      cartonId: "carton-export-a",
      innerPacksPerCarton: null,
      palletId: "pallet-plywood",
      cartonsPerPallet: 40,
      usePallet: true,
      remark: "Order-level carton + pallet packing",
    },
  ];

  const typeLabels = {
    zh: { inner: "内包装", carton: "纸箱", pallet: "托盘", accessory: "辅料" },
    en: { inner: "inner", carton: "carton", pallet: "pallet", accessory: "accessory" },
  };

  const packageLevelLabels = {
    zh: { product: "产品级包装", order: "订单级包装" },
    en: { product: "product", order: "order" },
  };

  function number(value, fallback = 0) {
    const parsed = Number(String(value ?? "").replace(/,/g, ""));
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function optionalNumber(value) {
    if (value === null || value === undefined || String(value).trim() === "") return null;
    const parsed = number(value, NaN);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function dateStamp() {
    return new Date().toISOString();
  }

  function idFromName(prefix, name) {
    const slug = String(name || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 42);
    return `${prefix}-${slug || Date.now()}`;
  }

  function defaultNameZh(list, id) {
    return list.find((entry) => entry.id === id)?.nameZh || "";
  }

  function withDates(record) {
    const now = dateStamp();
    return {
      createdAt: record.createdAt || now,
      updatedAt: record.updatedAt || now,
    };
  }

  function cbmFromDimensions(record) {
    return (number(record?.lengthCm) * number(record?.widthCm) * number(record?.heightCm)) / 1000000;
  }

  function normalizeItem(item) {
    const id = item.id || idFromName("pkg-item", item.name);
    const lengthCm = Math.max(number(item.lengthCm), 0);
    const widthCm = Math.max(number(item.widthCm), 0);
    const heightCm = Math.max(number(item.heightCm), 0);
    const type = item.type === "bag" ? "inner" : String(item.type || "carton").trim() || "carton";
    return {
      id,
      name: String(item.name || "").trim() || "Packaging Item",
      nameZh: String(item.nameZh || defaultNameZh(defaultPackagingItems, id)).trim(),
      type,
      lengthCm,
      widthCm,
      heightCm,
      unitCostRmb: Math.max(number(item.unitCostRmb), 0),
      maxWeightKg: optionalNumber(item.maxWeightKg),
      capacityPcs: optionalNumber(item.capacityPcs),
      capacityKg: optionalNumber(item.capacityKg),
      tareWeightKg: Math.max(number(item.tareWeightKg), 0),
      remark: String(item.remark || "").trim(),
      ...withDates(item),
    };
  }

  function normalizeProfile(profile) {
    const id = profile.id || idFromName("pkg-profile", profile.name);
    const inferredPackageLevel = profile.innerPackageId && !profile.cartonId && !profile.palletId ? "product" : "order";
    const packageLevel = profile.packageLevel === "product" || profile.packageLevel === "order" ? profile.packageLevel : inferredPackageLevel;
    return {
      id,
      name: String(profile.name || "").trim() || "Packaging Profile",
      nameZh: String(profile.nameZh || defaultNameZh(defaultPackagingProfiles, id)).trim(),
      packageLevel,
      innerPackageId: profile.innerPackageId || "",
      innerQtyPerPack: optionalNumber(profile.innerQtyPerPack),
      cartonId: profile.cartonId || "",
      innerPacksPerCarton: optionalNumber(profile.innerPacksPerCarton),
      palletId: profile.palletId || "",
      cartonsPerPallet: optionalNumber(profile.cartonsPerPallet),
      usePallet: Boolean(profile.usePallet),
      remark: String(profile.remark || "").trim(),
      ...withDates(profile),
    };
  }

  function readList(key, defaults, normalize) {
    try {
      const parsed = JSON.parse(localStorage.getItem(key));
      const source = Array.isArray(parsed) && parsed.length ? parsed : defaults;
      return source.map(normalize);
    } catch {
      return defaults.map(normalize);
    }
  }

  function saveList(key, list, normalize) {
    const now = dateStamp();
    const normalized = list.map((entry) => normalize({ ...entry, updatedAt: now }));
    localStorage.setItem(key, JSON.stringify(normalized));
    return normalized;
  }

  function findById(list, id) {
    return list.find((entry) => entry.id === id) || null;
  }

  function hasManualValue(value) {
    return value !== null && value !== undefined && String(value).trim() !== "";
  }

  function displayName(record, language = currentLanguage()) {
    if (!record) return "";
    return language === "zh" ? record.nameZh || record.name || "" : record.name || record.nameZh || "";
  }

  function typeName(type, language = currentLanguage()) {
    return typeLabels[language]?.[type] || type;
  }

  function packageLevelName(packageLevel, language = currentLanguage()) {
    return packageLevelLabels[language]?.[packageLevel] || packageLevel;
  }

  function currentLanguage() {
    return localStorage.getItem(languageStorageKey) || "zh";
  }

  function saveLanguage(language) {
    localStorage.setItem(languageStorageKey, language === "en" ? "en" : "zh");
  }

  function calculatePackaging(input, profile, items) {
    const quantity = Math.max(number(input?.quantity), 0);
    const unitWeightGram = Math.max(number(input?.unitWeightGram), 0);
    const totalWeightKg = (quantity * unitWeightGram) / 1000;
    const itemList = Array.isArray(items) ? items : [];
    const selectedProfile = profile || {};
    const innerPackage = findById(itemList, selectedProfile.innerPackageId);
    const carton = findById(itemList, selectedProfile.cartonId);
    const pallet = findById(itemList, selectedProfile.palletId);
    const innerQtyPerPack = Math.max(number(selectedProfile.innerQtyPerPack), 0);
    const innerCapacityPcs = Math.max(number(innerPackage?.capacityPcs), 0);
    const innerCapacityKg = Math.max(number(innerPackage?.capacityKg), 0);
    const innerMaxWeightKg = Math.max(number(innerPackage?.maxWeightKg), 0);
    const innerPacksPerCarton = Math.max(number(selectedProfile.innerPacksPerCarton), 0);
    let innerPackQty = 0;
    if (innerPackage && innerQtyPerPack > 0) {
      innerPackQty = Math.ceil(quantity / innerQtyPerPack);
    } else if (innerPackage && innerCapacityPcs > 0) {
      innerPackQty = Math.ceil(quantity / innerCapacityPcs);
    } else if (innerPackage && innerCapacityKg > 0) {
      innerPackQty = Math.ceil(totalWeightKg / innerCapacityKg);
    } else if (innerPackage && innerMaxWeightKg > 0) {
      innerPackQty = Math.ceil(totalWeightKg / innerMaxWeightKg);
    }
    const weightCartonQty = number(carton?.maxWeightKg) > 0 ? Math.ceil(totalWeightKg / number(carton.maxWeightKg)) : 0;
    const calculatedCartonQty = innerPackQty > 0 && innerPacksPerCarton > 0 ? Math.ceil(innerPackQty / innerPacksPerCarton) : weightCartonQty;
    const manualCartonQty = hasManualValue(input?.manualCartonQty) ? Math.max(Math.ceil(number(input.manualCartonQty)), 0) : null;
    const cartonQty = manualCartonQty !== null ? manualCartonQty : calculatedCartonQty;
    const usePallet = Boolean(selectedProfile.usePallet);
    const cartonsPerPallet = Math.max(number(selectedProfile.cartonsPerPallet), 0);
    const manualPalletQty = hasManualValue(input?.manualPalletQty) ? Math.max(Math.ceil(number(input.manualPalletQty)), 0) : null;
    const palletQty = !usePallet ? 0 : manualPalletQty !== null ? manualPalletQty : cartonsPerPallet > 0 ? Math.ceil(cartonQty / cartonsPerPallet) : 0;
    const cartonCbm = cartonQty * cbmFromDimensions(carton);
    const cartonLengthCm = number(carton?.lengthCm);
    const cartonWidthCm = number(carton?.widthCm);
    const cartonHeightCm = number(carton?.heightCm);
    const palletLengthCm = number(pallet?.lengthCm);
    const palletWidthCm = number(pallet?.widthCm);
    const palletHeightCm = number(pallet?.heightCm);
    const cartonsPerLayer =
      usePallet && cartonLengthCm > 0 && cartonWidthCm > 0 && palletLengthCm > 0 && palletWidthCm > 0
        ? Math.floor(palletLengthCm / cartonLengthCm) * Math.floor(palletWidthCm / cartonWidthCm)
        : 0;
    const layers = usePallet && cartonsPerLayer > 0 ? Math.ceil(cartonQty / cartonsPerLayer) : 0;
    const loadedPalletHeightCm = usePallet && palletQty > 0 ? palletHeightCm + layers * cartonHeightCm : 0;
    const palletCbm =
      usePallet && palletQty > 0 && palletLengthCm > 0 && palletWidthCm > 0 && loadedPalletHeightCm > 0
        ? (palletQty * palletLengthCm * palletWidthCm * loadedPalletHeightCm) / 1000000
        : 0;
    const totalCbm = usePallet && palletQty > 0 ? palletCbm : cartonCbm;
    const grossWeightKg =
      totalWeightKg +
      cartonQty * number(carton?.tareWeightKg) +
      palletQty * number(pallet?.tareWeightKg) +
      innerPackQty * number(innerPackage?.tareWeightKg);
    const packagingCost =
      innerPackQty * number(innerPackage?.unitCostRmb) +
      cartonQty * number(carton?.unitCostRmb) +
      palletQty * number(pallet?.unitCostRmb);

    return {
      totalWeightKg,
      innerPackQty,
      cartonQty,
      palletQty,
      cartonCbm,
      palletCbm,
      cartonsPerLayer,
      layers,
      loadedPalletHeightCm,
      totalCbm,
      grossWeightKg,
      packagingCost,
      packagingCostPerPiece: quantity > 0 ? packagingCost / quantity : 0,
      usePallet,
    };
  }

  const database = {
    getItems: () => readList(itemStorageKey, defaultPackagingItems, normalizeItem),
    getProfiles: () => readList(profileStorageKey, defaultPackagingProfiles, normalizeProfile),
    saveItems: (items) => saveList(itemStorageKey, items, normalizeItem),
    saveProfiles: (profiles) => saveList(profileStorageKey, profiles, normalizeProfile),
    reset: () => {
      localStorage.removeItem(itemStorageKey);
      localStorage.removeItem(profileStorageKey);
    },
    calculate: calculatePackaging,
    cbmFromDimensions,
    displayName,
    typeName,
    packageLevelName,
    currentLanguage,
    saveLanguage,
    number,
  };

  window.PackagingDatabase = database;

  function bootPackagingManager() {
    const manager = document.querySelector("[data-packaging-manager]");
    if (!manager) return;

    const itemBody = document.querySelector("#packagingItemsBody");
    const profileBody = document.querySelector("#packagingProfilesBody");
    const languageField = document.querySelector("#packagingLanguage");
    let items = database.getItems();
    let profiles = database.getProfiles();
    let saveTimer;

    languageField.value = database.currentLanguage();

    function clearNode(node) {
      while (node?.firstChild) node.firstChild.remove();
    }

    function trimNumber(value, maxDigits = 6) {
      return database.number(value).toFixed(maxDigits).replace(/\.?0+$/, "");
    }

    function appendSelectOption(select, value, label, selectedValue) {
      const option = document.createElement("option");
      option.value = value || "";
      option.textContent = label;
      option.selected = String(value || "") === String(selectedValue || "");
      select.append(option);
    }

    function inputCell(className, value, type = "text", extra = {}) {
      const input = document.createElement("input");
      input.className = className;
      input.type = type;
      input.value = value ?? "";
      Object.entries(extra).forEach(([key, optionValue]) => {
        input[key] = optionValue;
      });
      return input;
    }

    function selectCell(className, selectedValue, options) {
      const select = document.createElement("select");
      select.className = className;
      options.forEach((entry) => appendSelectOption(select, entry.value, entry.label, selectedValue));
      select.value = selectedValue || "";
      return select;
    }

    function checkboxCell(className, checked) {
      const label = document.createElement("label");
      label.className = "row-check";
      const input = document.createElement("input");
      input.className = className;
      input.type = "checkbox";
      input.checked = Boolean(checked);
      const textNode = document.createElement("span");
      textNode.textContent = "Yes";
      label.append(input, textNode);
      return label;
    }

    function removeButton(label) {
      const button = document.createElement("button");
      button.className = "icon-button";
      button.type = "button";
      button.title = label;
      button.setAttribute("aria-label", label);
      button.textContent = "x";
      return button;
    }

    function updateRowCbm(row) {
      const cbmField = row.querySelector(".packaging-item-cbm");
      if (!cbmField) return;
      const cbm =
        (database.number(row.querySelector(".packaging-item-length")?.value) *
          database.number(row.querySelector(".packaging-item-width")?.value) *
          database.number(row.querySelector(".packaging-item-height")?.value)) /
        1000000;
      cbmField.value = trimNumber(cbm, 6);
    }

    function applyTypeHints(row) {
      const type = row.querySelector(".packaging-item-type")?.value || "carton";
      row.dataset.packagingType = type;
      const hintMap = {
        inner: "内包装重点填写：容量 PCS、容量 KG、成本 RMB、自重 KG。",
        carton: "纸箱重点填写：长宽高、成本 RMB、最大承重 KG、自重 KG。",
        pallet: "托盘重点填写：长宽高、成本 RMB、最大承重 KG、自重 KG。",
        accessory: "辅料按实际需要填写成本、自重和备注。",
      };
      row.title = hintMap[type] || "";
    }

    function buildPackagingItemOptions(types = []) {
      const entries = [{ value: "", label: "None" }];
      items
        .filter((item) => !types.length || types.includes(item.type))
        .forEach((item) => entries.push({ value: item.id, label: `${database.displayName(item)} (${database.typeName(item.type)})` }));
      return entries;
    }

    function readItemRows() {
      const currentItems = new Map(items.map((item) => [item.id, item]));
      const nameField = database.currentLanguage() === "zh" ? "nameZh" : "name";
      return [...itemBody.querySelectorAll(".packaging-item-row")].map((row) => {
        const id = row.dataset.id;
        const current = currentItems.get(id) || {};
        return {
          ...current,
          id,
          name: nameField === "name" ? row.querySelector(".packaging-item-name").value : current.name,
          nameZh: nameField === "nameZh" ? row.querySelector(".packaging-item-name").value : current.nameZh,
          type: row.querySelector(".packaging-item-type").value,
          lengthCm: row.querySelector(".packaging-item-length").value,
          widthCm: row.querySelector(".packaging-item-width").value,
          heightCm: row.querySelector(".packaging-item-height").value,
          unitCostRmb: row.querySelector(".packaging-item-cost").value,
          maxWeightKg: row.querySelector(".packaging-item-weight").value,
          capacityPcs: row.querySelector(".packaging-item-capacity").value,
          capacityKg: row.querySelector(".packaging-item-capacity-kg").value,
          tareWeightKg: row.querySelector(".packaging-item-tare").value,
          remark: row.querySelector(".packaging-item-remark").value,
        };
      });
    }

    function savePackagingItems(nextItems) {
      items = database.saveItems(nextItems);
      return items;
    }

    function updatePackagingItems(nextItems, options = {}) {
      savePackagingItems(nextItems);
      if (options.renderItems) renderPackagingItems();
      renderPackagingProfiles();
    }

    function handlePackagingItemChange(row, options = {}) {
      updateRowCbm(row);
      applyTypeHints(row);
      updatePackagingItems(readItemRows(), options);
    }

    function saveFromRows() {
      const currentProfiles = new Map(profiles.map((profile) => [profile.id, profile]));
      const nameField = database.currentLanguage() === "zh" ? "nameZh" : "name";

      savePackagingItems(readItemRows());

      profiles = database.saveProfiles(
        [...profileBody.querySelectorAll(".packaging-profile-row")].map((row) => {
          const id = row.dataset.id;
          const current = currentProfiles.get(id) || {};
          return {
            ...current,
            id,
            name: nameField === "name" ? row.querySelector(".packaging-profile-name").value : current.name,
            nameZh: nameField === "nameZh" ? row.querySelector(".packaging-profile-name").value : current.nameZh,
            packageLevel: row.querySelector(".packaging-profile-level").value,
            innerPackageId: row.querySelector(".packaging-profile-inner").value,
            innerQtyPerPack: row.querySelector(".packaging-profile-inner-qty").value,
            cartonId: row.querySelector(".packaging-profile-carton").value,
            innerPacksPerCarton: row.querySelector(".packaging-profile-inner-packs").value,
            palletId: row.querySelector(".packaging-profile-pallet").value,
            cartonsPerPallet: row.querySelector(".packaging-profile-cartons").value,
            usePallet: row.querySelector(".packaging-profile-use-pallet").checked,
            remark: row.querySelector(".packaging-profile-remark").value,
          };
        }),
      );
    }

    function queueSave(refresh = false) {
      clearTimeout(saveTimer);
      saveTimer = setTimeout(() => {
        saveFromRows();
        if (refresh) render();
      }, 160);
    }

    function renderPackagingItems() {
      clearNode(itemBody);
      items.forEach((item) => {
        const row = document.createElement("div");
        row.className = "packaging-item-row";
        row.dataset.id = item.id;
        row.append(
          inputCell("packaging-item-name", database.displayName(item)),
          selectCell("packaging-item-type", item.type, [
            { value: "inner", label: database.typeName("inner") },
            { value: "carton", label: database.typeName("carton") },
            { value: "pallet", label: database.typeName("pallet") },
            { value: "accessory", label: database.typeName("accessory") },
          ]),
          inputCell("packaging-item-length", trimNumber(item.lengthCm, 2), "number", { min: "0", step: "0.01" }),
          inputCell("packaging-item-width", trimNumber(item.widthCm, 2), "number", { min: "0", step: "0.01" }),
          inputCell("packaging-item-height", trimNumber(item.heightCm, 2), "number", { min: "0", step: "0.01" }),
          inputCell("packaging-item-cbm", trimNumber(database.cbmFromDimensions(item), 6), "number", { readOnly: true, tabIndex: -1 }),
          inputCell("packaging-item-cost", trimNumber(item.unitCostRmb, 4), "number", { min: "0", step: "0.0001" }),
          inputCell("packaging-item-capacity", item.capacityPcs ?? "", "number", { min: "0", step: "1" }),
          inputCell("packaging-item-capacity-kg", item.capacityKg ?? "", "number", { min: "0", step: "0.001" }),
          inputCell("packaging-item-weight", item.maxWeightKg ?? "", "number", { min: "0", step: "0.001" }),
          inputCell("packaging-item-tare", trimNumber(item.tareWeightKg, 4), "number", { min: "0", step: "0.0001" }),
          inputCell("packaging-item-remark", item.remark),
          removeButton("删除包装物料"),
        );
        row.querySelectorAll("input").forEach((input) => {
          input.addEventListener("input", () => handlePackagingItemChange(row));
        });
        applyTypeHints(row);
        row.querySelector(".packaging-item-type").addEventListener("change", () => handlePackagingItemChange(row, { renderItems: true }));
        row.querySelector(".icon-button").addEventListener("click", () => {
          updatePackagingItems(items.filter((entry) => entry.id !== item.id), { renderItems: true });
        });
        itemBody.append(row);
      });
    }

    function renderPackagingProfiles() {
      clearNode(profileBody);
      profiles.forEach((profile) => {
        const row = document.createElement("div");
        row.className = "packaging-profile-row";
        row.dataset.id = profile.id;
        row.append(
          inputCell("packaging-profile-name", database.displayName(profile)),
          selectCell("packaging-profile-level", profile.packageLevel, [
            { value: "product", label: database.packageLevelName("product") },
            { value: "order", label: database.packageLevelName("order") },
          ]),
          selectCell("packaging-profile-inner", profile.innerPackageId, buildPackagingItemOptions(["inner"])),
          inputCell("packaging-profile-inner-qty", profile.innerQtyPerPack ?? "", "number", { min: "0", step: "1" }),
          selectCell("packaging-profile-carton", profile.cartonId, buildPackagingItemOptions(["carton"])),
          inputCell("packaging-profile-inner-packs", profile.innerPacksPerCarton ?? "", "number", { min: "0", step: "1" }),
          selectCell("packaging-profile-pallet", profile.palletId, buildPackagingItemOptions(["pallet"])),
          inputCell("packaging-profile-cartons", profile.cartonsPerPallet ?? "", "number", { min: "0", step: "1" }),
          checkboxCell("packaging-profile-use-pallet", profile.usePallet),
          inputCell("packaging-profile-remark", profile.remark),
          removeButton("删除包装方案"),
        );
        row.querySelectorAll("input").forEach((input) => input.addEventListener("input", () => queueSave(false)));
        row.querySelectorAll("select").forEach((select) => select.addEventListener("change", () => queueSave(false)));
        row.querySelector(".packaging-profile-use-pallet").addEventListener("change", () => queueSave(false));
        row.querySelector(".icon-button").addEventListener("click", () => {
          profiles = database.saveProfiles(profiles.filter((entry) => entry.id !== profile.id));
          render();
        });
        profileBody.append(row);
      });
    }

    function render() {
      renderPackagingItems();
      renderPackagingProfiles();
    }

    document.querySelector("#addPackagingItemBtn").addEventListener("click", () => {
      updatePackagingItems([
        ...items,
        {
          id: `pkg-item-${Date.now()}`,
          name: "New Packaging Item",
          nameZh: "新包装物料",
          type: "carton",
          lengthCm: 0,
          widthCm: 0,
          heightCm: 0,
          unitCostRmb: 0,
          maxWeightKg: null,
          capacityPcs: null,
          capacityKg: null,
          tareWeightKg: 0,
          remark: "",
        },
      ], { renderItems: true });
    });

    document.querySelector("#addPackagingProfileBtn").addEventListener("click", () => {
      items = database.getItems();
      profiles = database.saveProfiles([
        ...profiles,
        {
          id: `pkg-profile-${Date.now()}`,
          name: "New Packaging Profile",
          nameZh: "新包装方案",
          packageLevel: "product",
          innerPackageId: items.find((item) => item.type === "inner")?.id || "",
          innerQtyPerPack: "",
          cartonId: items.find((item) => item.type === "carton")?.id || "",
          innerPacksPerCarton: "",
          palletId: items.find((item) => item.type === "pallet")?.id || "",
          cartonsPerPallet: "",
          usePallet: false,
          remark: "",
        },
      ]);
      render();
    });

    languageField.addEventListener("change", () => {
      saveFromRows();
      database.saveLanguage(languageField.value);
      render();
    });

    render();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootPackagingManager);
  } else {
    bootPackagingManager();
  }
})();
