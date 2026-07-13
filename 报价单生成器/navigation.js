(function () {
  const current = location.pathname.split("/").pop() || "index.html";
  const navLinks = [...document.querySelectorAll(".nav-button")];
  navLinks.forEach((link) => {
    const target = new URL(link.href, location.href).pathname.split("/").pop();
    if (target === current) link.setAttribute("aria-current", "page");
  });

  const docTypeInputs = [...document.querySelectorAll('input[name="docType"]')];
  if (docTypeInputs.length) {
    const labels = {
      Quotation: "报价单",
      "Proforma Invoice": "PI",
      "Commercial Invoice": "CI",
      "Packing List": "PL",
    };
    const floatingDocSwitch = document.createElement("nav");
    floatingDocSwitch.className = "floating-doc-switch";
    floatingDocSwitch.setAttribute("aria-label", "文件类型快捷切换");

    const buttons = docTypeInputs.map((input) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "floating-doc-button";
      button.textContent = labels[input.value] || input.value;
      button.dataset.docType = input.value;
      button.addEventListener("click", () => {
        docTypeInputs.forEach((item) => {
          item.checked = item === input;
        });
        input.dispatchEvent(new Event("change", { bubbles: true }));
        input.dispatchEvent(new Event("input", { bubbles: true }));
        updateDocSwitch();
      });
      floatingDocSwitch.append(button);
      return button;
    });

    const updateDocSwitch = () => {
      const active = docTypeInputs.find((input) => input.checked)?.value || "";
      buttons.forEach((button) => {
        const selected = button.dataset.docType === active;
        button.classList.toggle("active", selected);
        button.setAttribute("aria-current", selected ? "true" : "false");
      });
    };

    docTypeInputs.forEach((input) => input.addEventListener("change", updateDocSwitch));
    updateDocSwitch();
    document.body.append(floatingDocSwitch);
  }

  const update = () => document.body.classList.toggle("is-scrolled", window.scrollY > 24);
  update();
  window.addEventListener("scroll", update, { passive: true });
})();
