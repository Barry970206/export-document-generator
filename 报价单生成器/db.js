(function () {
  const dbName = "ExportDocumentDB";
  const dbVersion = 2;
  const stores = ["quoteRecords", "customers", "products", "packagingProfiles", "logisticsProfiles"];

  function openDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(dbName, dbVersion);
      request.addEventListener("upgradeneeded", () => {
        const db = request.result;
        stores.forEach((storeName) => {
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

  async function withStore(storeName, mode, callback) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, mode);
      const store = tx.objectStore(storeName);
      let result;
      tx.addEventListener("complete", () => resolve(result));
      tx.addEventListener("error", () => reject(tx.error));
      tx.addEventListener("abort", () => reject(tx.error));
      result = callback(store);
    });
  }

  function requestToPromise(request) {
    return new Promise((resolve, reject) => {
      request.addEventListener("success", () => resolve(request.result));
      request.addEventListener("error", () => reject(request.error));
    });
  }

  async function saveQuote(record) {
    await withStore("quoteRecords", "readwrite", (store) => store.put(record));
    return record;
  }

  async function loadQuote(id) {
    return withStore("quoteRecords", "readonly", (store) => requestToPromise(store.get(id)));
  }

  async function deleteQuote(id) {
    return withStore("quoteRecords", "readwrite", (store) => store.delete(id));
  }

  async function listQuotes() {
    const quotes = await withStore("quoteRecords", "readonly", (store) => requestToPromise(store.getAll()));
    return Array.isArray(quotes) ? quotes : [];
  }

  window.ExportDocumentDB = {
    saveQuote,
    loadQuote,
    deleteQuote,
    listQuotes,
  };

  window.saveQuote = saveQuote;
  window.loadQuote = loadQuote;
  window.deleteQuote = deleteQuote;
  window.listQuotes = listQuotes;
})();
