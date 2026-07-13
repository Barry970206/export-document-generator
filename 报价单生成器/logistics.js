(function () {
  const storageKey = "logisticsProfiles";
  const utils = window.LogisticsUtils;
  const { incoterms, transportModes, billingMethods, currencies, defaultCostItems } = utils;

  const defaultProfile = {
    name: "新物流方案",
    countryRegion: "",
    originPort: "",
    destinationPort: "",
    supplier: "",
    carrier: "",
    sailingSchedule: "",
    containerType: "20GP",
    incoterm: "FOB",
    transportMode: "海运整柜",
    billingMethod: "直接总价",
    currency: "CNY",
    exchangeRate: utils.defaultExchangeRate,
    unitPrice: 0,
    minimumCharge: 0,
    totalCost: 0,
    costItems: defaultCostItems.map((item, index) => ({ id: `default-${index + 1}`, amount: 0, quantity: 1, ...item })),
    remark: "",
  };

  function dateStamp() {
    return new Date().toISOString();
  }

  function number(value, fallback = 0) {
    return utils.number(value, fallback);
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
    return utils.normalizeLogisticsProfile({
      ...defaultProfile,
      ...profile,
      id: profile.id || idFromName(profile.name),
    });
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
    const addCostButton = document.querySelector("#addLogisticsCostBtn");
    const costItemsNode = document.querySelector("#logisticsCostItems");
    const fields = {
      name: document.querySelector("#logisticsName"),
      countryRegion: document.querySelector("#logisticsCountry"),
      originPort: document.querySelector("#logisticsOriginPort"),
      destinationPort: document.querySelector("#logisticsDestinationPort"),
      supplier: document.querySelector("#logisticsSupplier"),
      carrier: document.querySelector("#logisticsCarrier"),
      sailingSchedule: document.querySelector("#logisticsSailingSchedule"),
      containerType: document.querySelector("#logisticsContainerType"),
      incoterm: document.querySelector("#logisticsIncoterm"),
      transportMode: document.querySelector("#logisticsTransportMode"),
      billingMethod: document.querySelector("#logisticsBillingMethod"),
      currency: document.querySelector("#logisticsCurrency"),
      exchangeRate: document.querySelector("#logisticsExchangeRate"),
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
        if (field) field.disabled = disabled;
      });
      saveButton.disabled = disabled;
      copyButton.disabled = disabled;
      deleteButton.disabled = disabled;
      addCostButton.disabled = disabled;
    }

    function readEditor(markUpdated = false) {
      const current = selectedProfile();
      if (!current) return null;
      return normalizeProfile({
        ...current,
        name: fields.name.value,
        countryRegion: fields.countryRegion.value,
        originPort: fields.originPort.value,
        destinationPort: fields.destinationPort.value,
        supplier: fields.supplier.value,
        carrier: fields.carrier.value,
        sailingSchedule: fields.sailingSchedule.value,
        containerType: fields.containerType.value,
        incoterm: fields.incoterm.value,
        transportMode: fields.transportMode.value,
        billingMethod: fields.billingMethod.value,
        currency: fields.currency.value,
        exchangeRate: fields.exchangeRate.value,
        unitPrice: fields.unitPrice.value,
        minimumCharge: fields.minimumCharge.value,
        costItems: [...costItemsNode.querySelectorAll(".logistics-cost-row")].map((row) => ({
          id: row.dataset.id,
          name: row.querySelector(".logistics-cost-name").value,
          currency: row.querySelector(".logistics-cost-currency").value,
          amount: row.querySelector(".logistics-cost-amount").value,
          unit: row.querySelector(".logistics-cost-unit").value,
          quantity: row.querySelector(".logistics-cost-quantity").value,
          remark: row.querySelector(".logistics-cost-remark").value,
        })),
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
      fields.originPort.value = profile.originPort || "";
      fields.destinationPort.value = profile.destinationPort;
      fields.supplier.value = profile.supplier;
      fields.carrier.value = profile.carrier || "";
      fields.sailingSchedule.value = profile.sailingSchedule || "";
      fields.containerType.value = profile.containerType || "20GP";
      fields.incoterm.value = profile.incoterm;
      fields.transportMode.value = profile.transportMode;
      fields.billingMethod.value = profile.billingMethod;
      fields.currency.value = profile.currency;
      fields.exchangeRate.value = formatNumber(profile.exchangeRate || utils.defaultExchangeRate);
      fields.unitPrice.value = formatNumber(profile.unitPrice);
      fields.minimumCharge.value = formatNumber(profile.minimumCharge);
      fields.totalCost.value = formatNumber(profile.totalCost);
      renderCostItems(profile.costItems);
      fields.updatedAt.value = formatDateTime(profile.updatedAt);
      fields.remark.value = profile.remark;
    }

    function renderCurrencyOptions(selected) {
      return currencies.map((currency) => `<option value="${currency}"${currency === selected ? " selected" : ""}>${currency}</option>`).join("");
    }

    function renderCostItems(items) {
      clearNode(costItemsNode);
      (items || []).forEach((rawItem) => {
        const item = utils.normalizeCostItem(rawItem);
        const row = document.createElement("div");
        row.className = "logistics-cost-row";
        row.dataset.id = item.id;
        row.innerHTML = `
          <input class="logistics-cost-name" type="text" aria-label="费用名称">
          <select class="logistics-cost-currency" aria-label="币种">${renderCurrencyOptions(item.currency)}</select>
          <input class="logistics-cost-amount" type="number" min="0" step="0.01" aria-label="单价">
          <input class="logistics-cost-unit" type="text" aria-label="计费单位" placeholder="/20GP 或 /票">
          <input class="logistics-cost-quantity" type="number" min="0" step="0.01" aria-label="数量">
          <output class="logistics-cost-rmb" aria-label="折算人民币">0</output>
          <input class="logistics-cost-remark" type="text" aria-label="备注" placeholder="备注">
          <button class="icon-button logistics-cost-remove" type="button" aria-label="删除费用">×</button>
        `;
        row.querySelector(".logistics-cost-name").value = item.name;
        row.querySelector(".logistics-cost-amount").value = formatNumber(item.amount);
        row.querySelector(".logistics-cost-unit").value = item.unit;
        row.querySelector(".logistics-cost-quantity").value = formatNumber(item.quantity);
        row.querySelector(".logistics-cost-remark").value = item.remark || "";
        costItemsNode.append(row);
      });
      refreshCostTotal();
    }

    function readCostRowsForSummary() {
      return [...costItemsNode.querySelectorAll(".logistics-cost-row")].map((row) => ({
        id: row.dataset.id,
        name: row.querySelector(".logistics-cost-name").value,
        currency: row.querySelector(".logistics-cost-currency").value,
        amount: row.querySelector(".logistics-cost-amount").value,
        unit: row.querySelector(".logistics-cost-unit").value,
        quantity: row.querySelector(".logistics-cost-quantity").value,
        remark: row.querySelector(".logistics-cost-remark").value,
      }));
    }

    function refreshCostTotal() {
      const summary = utils.calculateLogisticsCostSummary(
        { costItems: readCostRowsForSummary(), exchangeRate: fields.exchangeRate.value },
        { exchangeRate: fields.exchangeRate.value },
      );
      [...costItemsNode.querySelectorAll(".logistics-cost-row")].forEach((row, index) => {
        row.querySelector(".logistics-cost-rmb").textContent = formatNumber(summary.rows[index]?.totalRmb || 0);
      });
      fields.totalCost.value = formatNumber(summary.totalRmb);
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
      refreshCostTotal();
      saveTimer = setTimeout(() => saveCurrent(true), 140);
    }

    addCostButton.addEventListener("click", () => {
      const profile = selectedProfile();
      if (!profile) return;
      const next = [...readCostRowsForSummary(), { id: `cost-${Date.now()}`, name: "其他费用", currency: "CNY", amount: 0, unit: "", quantity: 1 }];
      renderCostItems(next);
      queueSave();
    });

    costItemsNode.addEventListener("click", (event) => {
      if (!event.target.closest(".logistics-cost-remove")) return;
      event.target.closest(".logistics-cost-row").remove();
      refreshCostTotal();
      saveCurrent(true, true);
    });

    costItemsNode.addEventListener("input", queueSave);
    costItemsNode.addEventListener("change", queueSave);

    function matchesSearch(profile) {
      const keyword = searchInput.value.trim().toLowerCase();
      if (!keyword) return true;
      return [
        profile.name,
        profile.countryRegion,
        profile.originPort,
        profile.destinationPort,
        profile.supplier,
        profile.carrier,
        profile.sailingSchedule,
        profile.containerType,
        profile.incoterm,
        profile.transportMode,
        profile.billingMethod,
        profile.currency,
        ...(profile.costItems || []).map((item) => `${item.name} ${item.currency} ${item.unit}`),
        profile.remark,
        formatDateTime(profile.updatedAt),
      ]
        .join(" ")
        .toLowerCase()
        .includes(keyword);
    }

    function updateStatus() {
      const visibleCount = filteredProfiles().length;
      status.textContent = `已保存 ${profiles.length} 个物流方案，当前显示 ${visibleCount} 个。多币种费用会在核算页按报价汇率折算为 RMB。`;
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
        [profile.countryRegion || "未填国家", profile.destinationPort || "未填目的港", `${profile.containerType || ""} ${formatNumber(profile.totalCost)} RMB`].forEach((value) => {
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
