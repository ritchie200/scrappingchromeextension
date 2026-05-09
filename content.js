(function () {
  "use strict";

  const MAX_TEXT_CHARS = 250000;
  const SKIPPED_SELECTOR = [
    "script",
    "style",
    "noscript",
    "template",
    "svg",
    "canvas",
    "iframe",
    "object",
    "embed",
    "video",
    "audio",
    "meta",
    "link"
  ].join(",");

  function scanVisiblePage() {
    if (!window.VisibleNameParser || typeof window.VisibleNameParser.parseNamesFromText !== "function") {
      throw new Error("Name parser was not loaded.");
    }

    const visibleTextBlocks = collectVisibleTextBlocks();
    const visibleText = visibleTextBlocks.join("\n");

    return {
      names: window.VisibleNameParser.parseNamesFromText(visibleText),
      pageTitle: document.title || "",
      pageUrl: window.location.href,
      scannedAt: new Date().toISOString(),
      visibleTextBlockCount: visibleTextBlocks.length,
      textLength: visibleText.length
    };
  }

  function collectVisibleTextBlocks() {
    const root = document.body || document.documentElement;
    const blocks = [];
    let collectedChars = 0;

    if (!root) {
      return blocks;
    }

    const walker = document.createTreeWalker(
      root,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode(node) {
          const parent = node.parentElement;

          if (!parent || shouldSkipElement(parent)) {
            return NodeFilter.FILTER_REJECT;
          }

          const text = normalizeTextBlock(node.nodeValue || "");

          if (!text || !isElementVisible(parent)) {
            return NodeFilter.FILTER_REJECT;
          }

          return NodeFilter.FILTER_ACCEPT;
        }
      }
    );

    while (walker.nextNode()) {
      const block = normalizeTextBlock(walker.currentNode.nodeValue || "");

      if (!block) {
        continue;
      }

      blocks.push(block);
      collectedChars += block.length;

      if (collectedChars >= MAX_TEXT_CHARS) {
        break;
      }
    }

    return blocks;
  }

  function isElementVisible(element) {
    let current = element;

    while (current && current.nodeType === Node.ELEMENT_NODE) {
      if (shouldSkipElement(current)) {
        return false;
      }

      if (current.hidden || current.getAttribute("aria-hidden") === "true") {
        return false;
      }

      const style = window.getComputedStyle(current);

      if (
        style.display === "none" ||
        style.visibility === "hidden" ||
        style.visibility === "collapse" ||
        Number(style.opacity) === 0
      ) {
        return false;
      }

      current = current.parentElement;
    }

    const rects = element.getClientRects();

    if (!rects || rects.length === 0) {
      return false;
    }

    return Array.from(rects).some((rect) => rect.width > 0 && rect.height > 0);
  }

  function shouldSkipElement(element) {
    return element.matches(SKIPPED_SELECTOR);
  }

  function normalizeTextBlock(value) {
    return value
      .replace(/\s+/g, " ")
      .trim();
  }

  window.VisibleContactNameScanner = {
    scanVisiblePage,
    collectVisibleTextBlocks
  };
})();
