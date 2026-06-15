const list = document.querySelector("#recordsList");
const searchInput = document.querySelector("#recordSearch");
const typeFilter = document.querySelector("#recordTypeFilter");

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

function matches(record) {
  const query = searchInput.value.trim().toLowerCase();
  const type = typeFilter.value;
  if (type && record.documentType !== type) return false;
  if (!query) return true;
  return [record.customerName, record.documentNo, productText(record)]
    .join(" ")
    .toLowerCase()
    .includes(query);
}

async function render() {
  list.innerHTML = `<div class="empty-records">正在加载报价记录...</div>`;
  try {
    const records = (await QuoteRecordsStore.records())
      .filter(matches)
      .sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));

    if (!records.length) {
      list.innerHTML = `<div class="empty-records">暂无报价记录</div>`;
      return;
    }

    list.innerHTML = records
      .map((record) => {
        const products = record.products || [];
        const productNames = products
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
  } catch (error) {
    console.error(error);
    list.innerHTML = `<div class="empty-records">报价记录加载失败</div>`;
  }
}

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

searchInput.addEventListener("input", render);
typeFilter.addEventListener("change", render);
render();
