(function () {
  const storageKey = "logisticsProfiles";

  const incoterms = ["EXW", "FOB", "CFR", "CIF", "DAP", "DDP"];
  const transportModes = ["快递", "空运", "海运拼箱", "海运整柜", "铁路", "海派", "空派", "卡航", "专线"];
  const billingMethods = ["按重量(KG)", "按体积(CBM)", "直接总价"];
  const currencies = ["CNY", "USD", "EUR", "GBP", "HKD", "JPY"];

  const defaultProfile = {
    name: "新物流方案",
    countryRegion: "",
    destinationPort: "",
    supplier: "",
    incoterm: "FOB",
    transportMode: "快递",
    billingMethod: "按重量(KG)",
    currency: "CNY",
    unitPrice: 0,
    minimumCharge: 0,
    totalCost: 0,
    remark: "",
  };

  function dateStamp() {
    return new Date().toISOString();
  }

  function number(value, fallback = 0) {
    const parsed = Number(String(value ?? "").replace(/,/g, ""));
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function idFromName(name) {
    const slug = String(name || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 42);
    return `logistics-${slug || Date.now()}`;
  }

  function normalizeProfile(profile) {
    const now = dateStamp();
    const incoterm = incoterms.includes(profile.incoterm) ? profile.incoterm : defaultProfile.incoterm;
    const transportMode = transportModes.includes(profile.transportMode) ? profile.transportMode : defaultProfile.transportMode;
    const billingMethod = billingMethods.includes(profile.billingMethod) ? profile.billingMethod : defaultProfile.billingMethod;
    const currency = currencies.includes(profile.currency) ? profile.currency : defaultProfile.currency;
    const createdAt = profile.createdAt || now;
    const updatedAt = profile.updatedAt || profile.updatedTime || createdAt || now;

    return {
      id: profile.id || idFromName(profile.name),
      name: String(profile.name || defaultProfile.name).trim() || defaultProfile.name,
      countryRegion: String(profile.countryRegion || "").trim(),
      destinationPort: String(profile.destinationPort || "").trim(),
      supplier: String(profile.supplier || profile.logisticsSupplier || "").trim(),
      incoterm,
      transportMode,
      billingMethod,
      currency,
      unitPrice: Math.max(number(profile.unitPrice), 0),
      minimumCharge: Math.max(number(profile.minimumCharge), 0),
      totalCost: Math.max(number(profile.totalCost), 0),
      remark: String(profile.remark || "").trim(),
      createdAt,
      updatedAt,
    };
  }

  function readProfiles() {
    try {
      const parsed = JSON.parse(localStorage.getItem(storageKey));
      return Array.isArray(parsed) ? parsed.map(normalizeProfile) : [];
    } catch {
      return [];
    }
  }

  function saveProfiles(list) {
    const normalized = list.map(normalizeProfile);
    localStorage.setItem(storageKey, JSON.stringify(normalized));
    return normalized;
  }

  function createProfile(overrides = {}) {
    const now = dateStamp();
    return normalizeProfile({
      ...defaultProfile,
      ...overrides,
      id: overrides.id || `logistics-${Date.now()}`,
      createdAt: overrides.createdAt || now,
      updatedAt: overrides.updatedAt || now,
    });
  }

  window.LogisticsDatabase = {
    getProfiles: readProfiles,
    saveProfiles,
    storageKey,
    incoterms,
    transportModes,
    billingMethods,
    currencies,
  };

  function bootLogisticsManager() {
    const manager = document.querySelector("[data-logistics-manager]");
    if (!manager) return;

    const listNode = document.querySelector("#logisticsProfilesList");
    const searchInput = document.querySelector("#logisticsSearch");
    const status = document.querySelector("#logisticsStatus");
    const form = document.querySelector("#logisticsEditorForm");
    const addButton = document.querySelector("#addLogisticsProfileBtn");
    const saveButton = document.querySelector("#saveLogisticsProfileBtn");
    const copyButton = document.querySelector("#copyLogisticsProfileBtn");
    const deleteButton = document.querySelector("#deleteLogisticsProfileBtn");
    const fields = {
      name: document.querySelector("#logisticsName"),
      countryRegion: document.querySelector("#logisticsCountry"),
      destinationPort: document.querySelector("#logisticsDestinationPort"),
      supplier: document.querySelector("#logisticsSupplier"),
      incoterm: document.querySelector("#logisticsIncoterm"),
      transportMode: document.querySelector("#logisticsTransportMode"),
      billingMethod: document.querySelector("#logisticsBillingMethod"),
      currency: document.querySelector("#logisticsCurrency"),
      unitPrice: document.querySelector("#logisticsUnitPrice"),
      minimumCharge: document.querySelector("#logisticsMinimumCharge"),
      totalCost: document.querySelector("#logisticsTotalCost"),
      updatedAt: document.querySelector("#logisticsUpdatedAt"),
      remark: document.querySelector("#logisticsRemark"),
    };
    let profiles = saveProfiles(readProfiles());
    let selectedId = profiles[0]?.id || "";
    let saveTimer;

    function clearNode(node) {
      while (node?.firstChild) node.firstChild.remove();
    }

    function formatNumber(value) {
      return number(value).toFixed(4).replace(/\.?0+$/, "") || "0";
    }

    function formatDateTime(value) {
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return "";
      const pad = (part) => String(part).padStart(2, "0");
      return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
    }

    function fillSelect(select, options) {
      clearNode(select);
      options.forEach((value) => {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = value;
        select.append(option);
      });
    }

    function selectedProfile() {
      return profiles.find((profile) => profile.id === selectedId) || null;
    }

    function filteredProfiles() {
      return profiles.filter(matchesSearch);
    }

    function setEditorDisabled(disabled) {
      Object.values(fields).forEach((field) => {
        field.disabled = disabled;
      });
      saveButton.disabled = disabled;
      copyButton.disabled = disabled;
      deleteButton.disabled = disabled;
    }

    function readEditor(markUpdated = false) {
      const current = selectedProfile();
      if (!current) return null;
      return normalizeProfile({
        ...current,
        name: fields.name.value,
        countryRegion: fields.countryRegion.value,
        destinationPort: fields.destinationPort.value,
        supplier: fields.supplier.value,
        incoterm: fields.incoterm.value,
        transportMode: fields.transportMode.value,
        billingMethod: fields.billingMethod.value,
        currency: fields.currency.value,
        unitPrice: fields.unitPrice.value,
        minimumCharge: fields.minimumCharge.value,
        totalCost: fields.totalCost.value,
        remark: fields.remark.value,
        updatedAt: markUpdated ? dateStamp() : current.updatedAt,
      });
    }

    function writeEditor(profile) {
      if (!profile) {
        form.reset();
        fields.updatedAt.value = "";
        setEditorDisabled(true);
        return;
      }
      setEditorDisabled(false);
      fields.name.value = profile.name;
      fields.countryRegion.value = profile.countryRegion;
      fields.destinationPort.value = profile.destinationPort;
      fields.supplier.value = profile.supplier;
      fields.incoterm.value = profile.incoterm;
      fields.transportMode.value = profile.transportMode;
      fields.billingMethod.value = profile.billingMethod;
      fields.currency.value = profile.currency;
      fields.unitPrice.value = formatNumber(profile.unitPrice);
      fields.minimumCharge.value = formatNumber(profile.minimumCharge);
      fields.totalCost.value = formatNumber(profile.totalCost);
      fields.updatedAt.value = formatDateTime(profile.updatedAt);
      fields.remark.value = profile.remark;
    }

    function saveCurrent(markUpdated = false, renderAfterSave = false) {
      const edited = readEditor(markUpdated);
      if (!edited) return;
      profiles = saveProfiles(profiles.map((profile) => (profile.id === edited.id ? edited : profile)));
      fields.updatedAt.value = formatDateTime(edited.updatedAt);
      if (renderAfterSave) render();
      else {
        renderList();
        updateStatus();
      }
    }

    function queueSave() {
      clearTimeout(saveTimer);
      saveTimer = setTimeout(() => saveCurrent(true), 140);
    }

    function matchesSearch(profile) {
      const keyword = searchInput.value.trim().toLowerCase();
      if (!keyword) return true;
      return [
        profile.name,
        profile.countryRegion,
        profile.destinationPort,
        profile.supplier,
        profile.incoterm,
        profile.transportMode,
        profile.billingMethod,
        profile.currency,
        profile.remark,
        formatDateTime(profile.updatedAt),
      ]
        .join(" ")
        .toLowerCase()
        .includes(keyword);
    }

    function updateStatus() {
      const visibleCount = filteredProfiles().length;
      status.textContent = `已保存 ${profiles.length} 个物流方案，当前显示 ${visibleCount} 个。数据键名：${storageKey}`;
    }

    function renderList() {
      clearNode(listNode);
      const visibleProfiles = filteredProfiles();
      if (!visibleProfiles.length) {
        const empty = document.createElement("p");
        empty.className = "logistics-empty";
        empty.textContent = profiles.length ? "没有匹配的物流方案。" : "暂无物流方案，请点击右上角新增。";
        listNode.append(empty);
        return;
      }
      visibleProfiles.forEach((profile) => {
        const button = document.createElement("button");
        button.className = "logistics-list-item";
        button.type = "button";
        button.setAttribute("aria-current", profile.id === selectedId ? "true" : "false");

        const title = document.createElement("strong");
        title.textContent = profile.name;

        const meta = document.createElement("div");
        meta.className = "logistics-list-meta";
        [profile.countryRegion || "未填国家", profile.incoterm, profile.transportMode].forEach((value) => {
          const item = document.createElement("span");
          item.textContent = value;
          item.title = value;
          meta.append(item);
        });

        button.append(title, meta);
        button.addEventListener("click", () => {
          clearTimeout(saveTimer);
          saveCurrent(false);
          selectedId = profile.id;
          render();
        });
        listNode.append(button);
      });
    }

    function render() {
      if (selectedId && !profiles.some((profile) => profile.id === selectedId)) {
        selectedId = profiles[0]?.id || "";
      }
      if (selectedId && searchInput.value.trim() && !filteredProfiles().some((profile) => profile.id === selectedId)) {
        selectedId = filteredProfiles()[0]?.id || selectedId;
      }
      renderList();
      writeEditor(selectedProfile());
      updateStatus();
    }

    addButton.addEventListener("click", () => {
      clearTimeout(saveTimer);
      saveCurrent(false);
      const profile = createProfile();
      profiles = saveProfiles([...profiles, profile]);
      selectedId = profile.id;
      searchInput.value = "";
      render();
    });

    saveButton.addEventListener("click", () => saveCurrent(true, true));

    copyButton.addEventListener("click", () => {
      clearTimeout(saveTimer);
      saveCurrent(false);
      const source = selectedProfile();
      if (!source) return;
      const profile = createProfile({
        ...source,
        id: `logistics-${Date.now()}`,
        name: `${source.name} - 复制`,
        createdAt: dateStamp(),
        updatedAt: dateStamp(),
      });
      profiles = saveProfiles([...profiles, profile]);
      selectedId = profile.id;
      searchInput.value = "";
      render();
    });

    deleteButton.addEventListener("click", () => {
      const current = selectedProfile();
      if (!current) return;
      profiles = saveProfiles(profiles.filter((profile) => profile.id !== current.id));
      selectedId = filteredProfiles()[0]?.id || profiles[0]?.id || "";
      render();
    });

    searchInput.addEventListener("input", () => {
      clearTimeout(saveTimer);
      saveCurrent(false);
      render();
    });

    form.addEventListener("input", queueSave);
    form.addEventListener("change", queueSave);

    fillSelect(fields.incoterm, incoterms);
    fillSelect(fields.transportMode, transportModes);
    fillSelect(fields.billingMethod, billingMethods);
    fillSelect(fields.currency, currencies);
    render();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootLogisticsManager);
  } else {
    bootLogisticsManager();
  }
})();
