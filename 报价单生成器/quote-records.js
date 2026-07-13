const list = document.querySelector("#recordsList");
const searchInput = document.querySelector("#recordSearch");
const typeFilter = document.querySelector("#recordTypeFilter");
const folderList = document.querySelector("#recordFolderList");

let folders = QuoteRecordsStore.folders();
let activeFolderId = "";
let latestRecords = [];

function money(value, currency) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency || "USD",
    minimumFractionDigits: 2,
  }).format(Number(value || 0));
}

function typeLabel(type) {
  if (type === "pi") return "PI";
  if (type === "ci") return "CI";
  if (type === "pl") return "PL";
  return "Quotation";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function productText(record) {
  return (record.products || [])
    .map((item) => item.productName || "")
    .join(" ");
}

function folderName(id) {
  return folders.find((folder) => folder.id === id)?.name || "未分类";
}

function folderCount(folderId) {
  if (folderId === "") return latestRecords.length;
  if (folderId === "__uncategorized") return latestRecords.filter((record) => !record.folderId).length;
  return latestRecords.filter((record) => record.folderId === folderId).length;
}

function matches(record) {
  const query = searchInput.value.trim().toLowerCase();
  const type = typeFilter.value;
  if (type && record.documentType !== type) return false;
  if (activeFolderId === "__uncategorized" && record.folderId) return false;
  if (activeFolderId && activeFolderId !== "__uncategorized" && record.folderId !== activeFolderId) return false;
  if (!query) return true;
  return [record.customerName, record.documentNo, productText(record), folderName(record.folderId), record.saveRemark]
    .join(" ")
    .toLowerCase()
    .includes(query);
}

function renderFolders() {
  const folderItems = [
    { id: "", name: "全部记录", count: folderCount("") },
    { id: "__uncategorized", name: "未分类", count: folderCount("__uncategorized") },
    ...folders.map((folder) => ({ id: folder.id, name: folder.name, count: folderCount(folder.id) })),
  ];

  folderList.innerHTML = folderItems
    .map((folder) => `
      <button class="record-folder-item${folder.id === activeFolderId ? " active" : ""}" type="button" data-folder-id="${escapeHtml(folder.id)}">
        <span>${escapeHtml(folder.name)}</span>
        <small>${folder.count}</small>
      </button>
    `)
    .join("");
}

function renderRecords() {
  const records = latestRecords
    .filter(matches)
    .sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));

  if (!records.length) {
    list.innerHTML = `<div class="empty-records">暂无报价记录</div>`;
    return;
  }

  list.innerHTML = records
    .map((record) => {
      const productNames = (record.products || [])
        .map((item) => item.productName || "Product")
        .filter(Boolean)
        .slice(0, 3)
        .join(" / ");
      return `
        <article class="record-card" data-id="${escapeHtml(record.id)}">
          <div>
            <div class="record-title">${escapeHtml(record.documentNo || "-")}</div>
            <div class="record-meta">
              <span>${escapeHtml(typeLabel(record.documentType))}</span>
              <span>${escapeHtml(record.customerName || "未填写客户")}</span>
              <span>${escapeHtml(record.date || "-")}</span>
              <span>${escapeHtml(money(record.totalAmount, record.currency))}</span>
            </div>
            <div class="record-products">${escapeHtml(productNames || "无产品明细")}</div>
            <div class="record-meta">
              <span>${escapeHtml(folderName(record.folderId))}</span>
              <span>${escapeHtml(record.saveRemark || "无保存备注")}</span>
            </div>
          </div>
          <div class="record-actions">
            <button class="ghost-button compact open-record" type="button">打开编辑</button>
            <button class="ghost-button compact copy-record" type="button">复制为新报价</button>
            <button class="ghost-button compact delete-record" type="button">删除</button>
          </div>
        </article>
      `;
    })
    .join("");
}

async function render() {
  list.innerHTML = `<div class="empty-records">正在加载报价记录...</div>`;
  try {
    folders = QuoteRecordsStore.folders();
    latestRecords = await QuoteRecordsStore.records();
    if (activeFolderId && activeFolderId !== "__uncategorized" && !folders.some((folder) => folder.id === activeFolderId)) {
      activeFolderId = "";
    }
    renderFolders();
    renderRecords();
  } catch (error) {
    console.error(error);
    list.innerHTML = `<div class="empty-records">报价记录加载失败</div>`;
  }
}

folderList.addEventListener("click", (event) => {
  const button = event.target.closest(".record-folder-item");
  if (!button) return;
  activeFolderId = button.dataset.folderId || "";
  renderFolders();
  renderRecords();
});

list.addEventListener("click", async (event) => {
  const card = event.target.closest(".record-card");
  if (!card) return;
  const id = card.dataset.id;
  try {
    if (event.target.closest(".open-record")) {
      const record = await QuoteRecordsStore.openRecord(id);
      if (record) window.location.href = "index.html";
    }
    if (event.target.closest(".copy-record")) {
      const record = await QuoteRecordsStore.duplicate(id);
      if (record) {
        await QuoteRecordsStore.openRecord(record.id);
        window.location.href = "index.html";
      }
    }
    if (event.target.closest(".delete-record")) {
      if (!window.confirm("确定删除这条报价记录吗？")) return;
      await QuoteRecordsStore.remove(id);
      await render();
    }
  } catch (error) {
    console.error(error);
    window.alert(`操作失败：${error.message || error}`);
  }
});

searchInput.addEventListener("input", renderRecords);
typeFilter.addEventListener("change", renderRecords);

document.querySelector("#addRecordFolderBtn").addEventListener("click", async () => {
  const name = window.prompt("新文件夹名称");
  if (!name?.trim()) return;
  const folder = QuoteRecordsStore.createFolder(name);
  activeFolderId = folder.id;
  await render();
});

document.querySelector("#renameRecordFolderBtn").addEventListener("click", async () => {
  if (!activeFolderId || activeFolderId === "__uncategorized") return window.alert("请先选择一个自建文件夹");
  const name = window.prompt("新的文件夹名称", folderName(activeFolderId));
  if (!name?.trim()) return;
  QuoteRecordsStore.renameFolder(activeFolderId, name);
  await render();
});

document.querySelector("#deleteRecordFolderBtn").addEventListener("click", async () => {
  if (!activeFolderId || activeFolderId === "__uncategorized") return window.alert("请先选择一个自建文件夹");
  if (!window.confirm("删除文件夹后，其中报价将移入未分类。继续吗？")) return;
  await QuoteRecordsStore.removeFolder(activeFolderId);
  activeFolderId = "__uncategorized";
  await render();
});

render();
