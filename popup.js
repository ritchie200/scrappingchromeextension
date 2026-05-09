(function () {
  "use strict";

  const scanButton = document.getElementById("scanButton");
  const copyButton = document.getElementById("copyButton");
  const exportButton = document.getElementById("exportButton");
  const clearButton = document.getElementById("clearButton");
  const statusMessage = document.getElementById("statusMessage");
  const resultsList = document.getElementById("resultsList");
  const countBadge = document.getElementById("countBadge");

  let results = [];
  let sourcePage = {
    title: "",
    url: ""
  };

  scanButton.addEventListener("click", scanCurrentPage);
  copyButton.addEventListener("click", copySelectedNames);
  exportButton.addEventListener("click", exportSelectedNames);
  clearButton.addEventListener("click", clearResults);
  resultsList.addEventListener("change", updateSelection);

  renderResults();

  async function scanCurrentPage() {
    setBusy(true);
    setStatus("Scanning visible page text...");

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      if (!tab || typeof tab.id !== "number") {
        throw new Error("No active tab was found.");
      }

      if (!isScannableUrl(tab.url || "")) {
        throw new Error("This page type cannot be scanned. Open an http or https page and try again.");
      }

      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["utils/nameParser.js"]
      });

      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["content.js"]
      });

      const [{ result: scanResult } = {}] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => window.VisibleContactNameScanner.scanVisiblePage()
      });

      if (!scanResult || !Array.isArray(scanResult.names)) {
        throw new Error("The page scan did not return usable results.");
      }

      sourcePage = {
        title: scanResult.pageTitle || tab.title || "",
        url: scanResult.pageUrl || tab.url || ""
      };

      results = scanResult.names.map((item, index) => ({
        id: `${normaliseForId(item.name)}-${index}`,
        name: item.name,
        confidence: item.confidence,
        score: item.score,
        selected: true
      }));

      renderResults();

      if (results.length === 0) {
        setStatus("No names found in visible page text.");
      } else {
        setStatus(`Scan complete. Found ${results.length} possible ${pluralise("name", results.length)}.`);
      }
    } catch (error) {
      setStatus(error.message || "Something went wrong while scanning the page.", true);
    } finally {
      setBusy(false);
    }
  }

  async function copySelectedNames() {
    const selected = getSelectedResults();

    if (selected.length === 0) {
      setStatus("Select at least one name to copy.", true);
      return;
    }

    const text = selected.map((item) => item.name).join("\n");

    try {
      await writeToClipboard(text);
      setStatus(`Copied ${selected.length} selected ${pluralise("name", selected.length)}.`);
    } catch (error) {
      setStatus(error.message || "Could not copy selected names.", true);
    }
  }

  function exportSelectedNames() {
    const selected = getSelectedResults();

    if (selected.length === 0) {
      setStatus("Select at least one name to export.", true);
      return;
    }

    const headers = ["Name", "Confidence", "Source Page Title", "Source Page URL", "Exported At"];
    const exportedAt = new Date().toISOString();
    const rows = selected.map((item) => [
      item.name,
      item.confidence,
      sourcePage.title,
      sourcePage.url,
      exportedAt
    ]);

    const csv = [headers, ...rows]
      .map((row) => row.map(escapeCsvValue).join(","))
      .join("\r\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = objectUrl;
    link.download = `visible-contact-names-${formatDateForFile(new Date())}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();

    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 250);
    setStatus(`Exported ${selected.length} selected ${pluralise("name", selected.length)}.`);
  }

  function clearResults() {
    results = [];
    sourcePage = {
      title: "",
      url: ""
    };
    renderResults();
    setStatus("Results cleared.");
  }

  function updateSelection(event) {
    const target = event.target;

    if (!target.classList.contains("result-checkbox")) {
      return;
    }

    const index = Number(target.dataset.index);

    if (Number.isInteger(index) && results[index]) {
      results[index].selected = target.checked;
      updateActionState();
    }
  }

  function renderResults() {
    resultsList.replaceChildren();
    countBadge.textContent = String(results.length);

    if (results.length === 0) {
      const empty = document.createElement("li");
      empty.className = "empty-state";
      empty.textContent = "No scan results yet.";
      resultsList.appendChild(empty);
      updateActionState();
      return;
    }

    results.forEach((item, index) => {
      const row = document.createElement("li");
      row.className = "result-row";

      const checkbox = document.createElement("input");
      checkbox.className = "result-checkbox";
      checkbox.type = "checkbox";
      checkbox.checked = item.selected;
      checkbox.dataset.index = String(index);
      checkbox.id = item.id;
      checkbox.setAttribute("aria-label", `Select ${item.name}`);

      const name = document.createElement("label");
      name.className = "name-text";
      name.htmlFor = item.id;
      name.textContent = item.name;

      const confidence = document.createElement("span");
      confidence.className = `confidence ${item.confidence}`;
      confidence.textContent = item.confidence;
      confidence.title = `Confidence score: ${item.score}`;

      row.append(checkbox, name, confidence);
      resultsList.appendChild(row);
    });

    updateActionState();
  }

  function updateActionState() {
    const hasResults = results.length > 0;
    const hasSelection = getSelectedResults().length > 0;

    copyButton.disabled = !hasSelection;
    exportButton.disabled = !hasSelection;
    clearButton.disabled = !hasResults;
  }

  function setBusy(isBusy) {
    scanButton.disabled = isBusy;
    scanButton.textContent = isBusy ? "Scanning..." : "Scan Page";
  }

  function setStatus(message, isError = false) {
    statusMessage.textContent = message;
    statusMessage.classList.toggle("error", isError);
  }

  function getSelectedResults() {
    return results.filter((item) => item.selected);
  }

  async function writeToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }

    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "readonly");
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    document.body.appendChild(textarea);
    textarea.select();

    const copied = document.execCommand("copy");
    textarea.remove();

    if (!copied) {
      throw new Error("Clipboard access was blocked by the browser.");
    }
  }

  function isScannableUrl(url) {
    return /^https?:\/\//i.test(url);
  }

  function escapeCsvValue(value) {
    const safeValue = String(value || "");
    return `"${safeValue.replace(/"/g, '""')}"`;
  }

  function formatDateForFile(date) {
    return date.toISOString().slice(0, 10);
  }

  function normaliseForId(value) {
    return String(value || "name")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "name";
  }

  function pluralise(word, count) {
    return count === 1 ? word : `${word}s`;
  }
})();
