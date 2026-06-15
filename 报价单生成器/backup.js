(function () {
  const dbName = "ExportDocumentDB";
  const dbVersion = 2;
  const storeNames = ["quoteRecords", "customers", "products", "packagingProfiles", "logisticsProfiles"];
  const localStorageKeys = [
    "export-document-generator-v3",
    "quotation-profit-calculator-v1",
    "quotation-preview-visible",
    "export-packaging-items-v2",
    "export-packaging-profiles-v2",
    "export-packaging-language-v1",
    "logisticsProfiles",
  ];

  const exportButton = document.querySelector("#exportBackupBtn");
  const importFile = document.querySelector("#importBackupFile");
  const status = document.querySelector("#backupStatus");
  const summary = document.querySelector("#backupSummary");

  function setStatus(message, isError = false) {
    status.textContent = message;
    status.classList.toggle("error", isError);
  }

  function requestToPromise(request) {
    return new Promise((resolve, reject) => {
      request.addEventListener("success", () => resolve(request.result));
      request.addEventListener("error", () => reject(request.error));
    });
  }

  function openDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(dbName, dbVersion);
      request.addEventListener("upgradeneeded", () => {
        const db = request.result;
        storeNames.forEach((storeName) => {
          if (!db.objectStoreNames.contains(storeName)) {
            const store = db.createObjectStore(storeName, { keyPath: "id" });
            if (storeName === "quoteRecords") {
              store.createIndex("documentNo", "documentNo", { unique: false });
              store.createIndex("documentType", "documentType", { unique: false });
              store.createIndex("customerName", "customerName", { unique: false });
              store.createIndex("updatedAt", "updatedAt", { unique: false });
            }
          }
        });
      });
      request.addEventListener("success", () => resolve(request.result));
      request.addEventListener("error", () => reject(request.error));
    });
  }

  async function readStore(db, storeName) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, "readonly");
      const store = tx.objectStore(storeName);
      const request = store.getAll();
      request.addEventListener("success", () => resolve(Array.isArray(request.result) ? request.result : []));
      request.addEventListener("error", () => reject(request.error));
      tx.addEventListener("error", () => reject(tx.error));
      tx.addEventListener("abort", () => reject(tx.error));
    });
  }

  async function writeStore(db, storeName, rows) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, "readwrite");
      const store = tx.objectStore(storeName);
      store.clear();
      (Array.isArray(rows) ? rows : []).forEach((row) => {
        if (row && row.id !== undefined && row.id !== null && row.id !== "") store.put(row);
      });
      tx.addEventListener("complete", () => resolve());
      tx.addEventListener("error", () => reject(tx.error));
      tx.addEventListener("abort", () => reject(tx.error));
    });
  }

  async function exportIndexedDB() {
    const db = await openDB();
    const data = {};
    for (const storeName of storeNames) {
      data[storeName] = await readStore(db, storeName);
    }
    db.close();
    return data;
  }

  function exportLocalStorage() {
    return localStorageKeys.reduce((data, key) => {
      const value = localStorage.getItem(key);
      if (value !== null) data[key] = value;
      return data;
    }, {});
  }

  async function importIndexedDB(indexedDBData) {
    const db = await openDB();
    for (const storeName of storeNames) {
      await writeStore(db, storeName, indexedDBData?.[storeName] || []);
    }
    db.close();
  }

  function importLocalStorage(localStorageData) {
    localStorageKeys.forEach((key) => localStorage.removeItem(key));
    Object.entries(localStorageData || {}).forEach(([key, value]) => {
      if (localStorageKeys.includes(key)) localStorage.setItem(key, String(value));
    });
  }

  function timestamp() {
    const now = new Date();
    const date = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
    const time = `${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}${String(now.getSeconds()).padStart(2, "0")}`;
    return `${date}-${time}`;
  }

  function downloadJson(data) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `ExportDocumentBackup-${timestamp()}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function validateBackup(data) {
    if (!data || typeof data !== "object") throw new Error("备份文件格式不正确");
    if (data.app !== "ExportDocumentGenerator") throw new Error("不是本系统导出的备份文件");
    if (!data.indexedDB || typeof data.indexedDB !== "object") throw new Error("备份文件缺少 IndexedDB 数据");
    if (!data.localStorage || typeof data.localStorage !== "object") throw new Error("备份文件缺少 localStorage 数据");
  }

  async function buildSummary() {
    const dbData = await exportIndexedDB();
    const localData = exportLocalStorage();
    const rows = [
      ["报价记录", dbData.quoteRecords.length],
      ["客户资料", dbData.customers.length],
      ["产品资料", dbData.products.length],
      ["IndexedDB 包装方案", dbData.packagingProfiles.length],
      ["IndexedDB 物流方案", dbData.logisticsProfiles.length],
      ["本地草稿/设置", Object.keys(localData).length],
    ];
    summary.innerHTML = rows
      .map(([label, value]) => `<div><span>${label}</span><strong>${value}</strong></div>`)
      .join("");
  }

  exportButton.addEventListener("click", async () => {
    try {
      setStatus("正在生成备份文件...");
      const backup = {
        app: "ExportDocumentGenerator",
        version: 1,
        exportedAt: new Date().toISOString(),
        databaseName: dbName,
        indexedDB: await exportIndexedDB(),
        localStorage: exportLocalStorage(),
      };
      downloadJson(backup);
      setStatus("备份文件已导出。");
      await buildSummary();
    } catch (error) {
      console.error(error);
      setStatus(`导出失败：${error.message || error}`, true);
    }
  });

  importFile.addEventListener("change", async () => {
    const file = importFile.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const backup = JSON.parse(text);
      validateBackup(backup);
      const ok = window.confirm("导入会覆盖当前本机的报价记录、草稿、包装和物流数据。确定继续吗？");
      if (!ok) {
        importFile.value = "";
        return;
      }
      setStatus("正在恢复备份数据...");
      await importIndexedDB(backup.indexedDB);
      importLocalStorage(backup.localStorage);
      setStatus("备份数据已恢复。建议重新打开相关页面查看最新数据。");
      await buildSummary();
    } catch (error) {
      console.error(error);
      setStatus(`导入失败：${error.message || error}`, true);
    } finally {
      importFile.value = "";
    }
  });

  buildSummary().catch((error) => {
    console.error(error);
    setStatus(`读取数据概览失败：${error.message || error}`, true);
  });
})();
