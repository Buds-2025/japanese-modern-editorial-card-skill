#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2);
    const values = [];
    while (argv[i + 1] && !argv[i + 1].startsWith("--")) {
      values.push(argv[i + 1]);
      i += 1;
    }
    args[key] = values.length > 1 ? values : values[0] ?? true;
  }
  return args;
}

function expandHtmlInputs(input) {
  const raw = Array.isArray(input) ? input : [input];
  const files = [];
  for (const item of raw.filter(Boolean)) {
    if (!String(item).includes("*")) {
      files.push(path.resolve(item));
      continue;
    }
    const resolved = path.resolve(item);
    const dir = path.dirname(resolved);
    const pattern = new RegExp(`^${path.basename(resolved).replaceAll(".", "\\.").replaceAll("*", ".*")}$`);
    for (const name of fs.readdirSync(dir)) {
      if (pattern.test(name)) files.push(path.join(dir, name));
    }
  }
  return files;
}

function textOnly(html) {
  return html.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

function hasTerminalPunctuation(value) {
  return /\p{P}$/u.test(textOnly(value));
}

function hasInvalidChineseQuote(value) {
  const text = textOnly(value);
  const standaloneApostrophe = /(?<![A-Za-z])['‘’](?![A-Za-z])/u;
  return /[“”]/u.test(text) || (/[\u3400-\u9fff]/u.test(text) && (/"/u.test(text) || standaloneApostrophe.test(text)));
}

function checkVisibleTextRules(value, file, issues, label) {
  const text = textOnly(value);
  if (!text) return;
  if (hasTerminalPunctuation(text)) {
    issues.push({ file, type: "terminal-punctuation", message: `${label} ends with punctuation: ${text}` });
  }
  if (hasInvalidChineseQuote(text)) {
    issues.push({ file, type: "chinese-quote-style", message: `${label} must use 「」 for quotation marks in Chinese text: ${text}` });
  }
}

function isEnglishDate(value) {
  const match = textOnly(value).match(/^(Jan\.|Feb\.|Mar\.|Apr\.|May|Jun\.|Jul\.|Aug\.|Sep\.|Oct\.|Nov\.|Dec\.)\s([1-9]|[12]\d|3[01])(st|nd|rd|th)$/u);
  if (!match) return false;
  const day = Number(match[2]);
  const monthDays = { "Jan.": 31, "Feb.": 29, "Mar.": 31, "Apr.": 30, May: 31, "Jun.": 30, "Jul.": 31, "Aug.": 31, "Sep.": 30, "Oct.": 31, "Nov.": 30, "Dec.": 31 };
  if (day > monthDays[match[1]]) return false;
  const suffix = day % 100 >= 11 && day % 100 <= 13 ? "th" : ({ 1: "st", 2: "nd", 3: "rd" }[day % 10] ?? "th");
  return match[3] === suffix;
}

function checkStatic(html, file, issues, expectedProductionDate) {
  const visibleHtml = html.replace(/<!--[\s\S]*?-->/g, "");
  if (/data:image\/svg\+xml|\.svg(?:["?#])/i.test(html)) {
    issues.push({ file, type: "svg-final-image", message: "Final HTML references SVG image data or .svg files; rasterize images to PNG/JPEG/WebP before rendering." });
  }
  for (const match of html.matchAll(/<h[12][^>]*>([\s\S]*?)<\/h[12]>/g)) checkVisibleTextRules(match[1], file, issues, "Title");
  for (const match of html.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/g)) checkVisibleTextRules(match[1], file, issues, "Text");
  const forbidden = /主题标题|主题大标题承载区|金句区|详细内容承载|FEATURE TITLE|VOICE FIELD|TITLE A|TITLE B|IMAGE GROUP\s*\/\s*TEXT GROUP|DETAIL ZONE MAY INCLUDE|A quiet opening title|Image and text answer each other|NOTE\s+\d+/i;
  if (forbidden.test(visibleHtml)) {
    issues.push({ file, type: "template-placeholder", message: "Rendered HTML still contains template placeholder copy." });
  }
  const section = html.match(/<section\b[^>]*class="[^"]*\bposter\b[^"]*"[^>]*>/i)?.[0] ?? "";
  const subjectId = section.match(/\bdata-jp-subject-id="([^"]+)"/i)?.[1];
  const isJapaneseTheme = section.match(/\bdata-jp-is-japanese-theme="([^"]+)"/i)?.[1] === "true";
  if (!subjectId) {
    issues.push({ file, type: "subject-missing", message: "Poster has no declared subject identity." });
  } else {
    for (const image of html.matchAll(/<img\b[^>]*\bdata-jp-subject-id="([^"]+)"[^>]*>/gi)) {
      if (image[1] !== subjectId) issues.push({ file, type: "image-subject-mismatch", message: `Image subject ${image[1]} differs from poster subject ${subjectId}.` });
    }
    for (const image of html.matchAll(/<img\b[^>]*>/gi)) {
      if (!/\bdata-jp-subject-id="[^"]+"/i.test(image[0])) issues.push({ file, type: "image-subject-missing", message: "An image is missing its subject binding." });
    }
  }
  if (/id="vertical-06"/i.test(section) && !isJapaneseTheme && (/<[^>]*\blang="ja"/i.test(visibleHtml) || /[\u3040-\u30ff]/u.test(visibleHtml))) {
    issues.push({ file, type: "unexpected-japanese", message: "Template 06 may contain Japanese text only for a Japanese theme." });
  }
  const headerDate = visibleHtml.match(/<header class="jp-page-header">[\s\S]*?<p class="jp-page jp-red-mark">([^<]+)<\/p>/i)?.[1]?.trim();
  if (!isEnglishDate(headerDate ?? "")) {
    issues.push({ file, type: "header-date", message: "The upper-right header must contain an English month and ordinal day." });
  } else if (expectedProductionDate && headerDate !== expectedProductionDate) {
    issues.push({ file, type: "header-production-date", message: `The upper-right header must match the shared production date: ${expectedProductionDate}.` });
  }
  const issue = visibleHtml.match(/<header class="jp-page-header">\s*<p class="jp-issue">([^<]+)<\/p>/i)?.[1]?.trim();
  if (!issue) {
    issues.push({ file, type: "header-issue", message: "The upper-left header must contain the shared issue theme." });
  }
  const footerLabel = visibleHtml.match(/<footer class="jp-page-footer"><p class="jp-meta">([^<]+)<\/p>/i)?.[1]?.trim();
  const footerPage = visibleHtml.match(/<footer class="jp-page-footer">[\s\S]*?<p class="jp-page jp-red-mark">([^<]+)<\/p>/i)?.[1]?.trim();
  const pageThemeMatch = (footerLabel ?? "").match(/^P(\d{2})\s\/\s(.+)$/u);
  const pageCountMatch = (footerPage ?? "").match(/^(\d{2})\s\/\s(\d+)$/u);
  if (!pageThemeMatch || pageThemeMatch[2].trim().length < 2) {
    issues.push({ file, type: "page-theme", message: "The lower-left footer must use P01-style numbering followed by a page theme." });
  }
  if (!pageCountMatch) {
    issues.push({ file, type: "page-count", message: "The lower-right footer must retain the currentPage / totalPages count." });
  } else if (pageThemeMatch && pageThemeMatch[1] !== pageCountMatch[1]) {
    issues.push({ file, type: "page-sequence", message: "The lower-left P number must match the lower-right current page." });
  }
  for (const line of html.replace(/<br\s*\/?>/gi, "\n").split(/\r?\n/)) {
    const text = textOnly(line);
    if (/^[\p{Script=Han}][，,。.!！？?；;：:、]?$/u.test(text)) {
      issues.push({ file, type: "orphan-line", message: `Single-character manual line found: ${text}` });
    }
  }
}

async function checkBrowser(files, issues) {
  let chromium;
  try {
    ({ chromium } = await import("playwright"));
  } catch {
    issues.push({ file: "*", type: "browser-skipped", message: "Playwright is not installed; browser overflow and PNG dimension checks were skipped." });
    return;
  }

  const browser = await chromium.launch();
  try {
    for (const file of files) {
      const page = await browser.newPage({ viewport: { width: 1200, height: 1600 }, deviceScaleFactor: 1 });
      await page.goto(pathToFileURL(file).href, { waitUntil: "networkidle" });
      const checks = await page.evaluate(() => {
        const output = [];
        const poster = document.querySelector("section.poster");
        if (!poster) {
          output.push({ type: "missing-poster", message: "No section.poster found." });
        } else {
          const box = poster.getBoundingClientRect();
          if (Math.round(box.width) !== 1080 || Math.round(box.height) !== 1440) {
            output.push({ type: "poster-size", message: `Poster size is ${Math.round(box.width)}x${Math.round(box.height)}, expected 1080x1440.` });
          }
          if (poster.scrollHeight > poster.clientHeight + 2 || poster.scrollWidth > poster.clientWidth + 2) {
            output.push({ type: "poster-overflow", message: "Poster content exceeds the fixed 1080x1440 canvas." });
          }
        }

        for (const element of document.querySelectorAll("[data-text-zone]")) {
          const slot = element.getAttribute("data-slot-id") || element.getAttribute("data-text-zone");
          const style = getComputedStyle(element);
          const hasFixedHeight = style.maxHeight !== "none" || /height\s*:/.test(element.getAttribute("style") || "");
          if (element.scrollWidth > element.clientWidth + 2 || (hasFixedHeight && element.scrollHeight > element.clientHeight + 2)) {
            output.push({ type: "text-overflow", message: `${slot} overflows its text box.` });
          }
          const box = element.getBoundingClientRect();
          const posterBox = poster?.getBoundingClientRect();
          if (posterBox && (box.left < posterBox.left - 1 || box.right > posterBox.right + 1 || box.top < posterBox.top - 1 || box.bottom > posterBox.bottom + 1)) {
            output.push({ type: "text-outside-canvas", message: `${slot} extends outside the poster canvas.` });
          }

          const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
          const lines = new Map();
          while (walker.nextNode()) {
            const node = walker.currentNode;
            const value = node.nodeValue || "";
            for (let i = 0; i < value.length; i += 1) {
              const char = value[i];
              if (!char.trim()) continue;
              const range = document.createRange();
              range.setStart(node, i);
              range.setEnd(node, i + 1);
              const rect = range.getBoundingClientRect();
              range.detach();
              if (!rect.width && !rect.height) continue;
              const key = Math.round(rect.top);
              lines.set(key, `${lines.get(key) || ""}${char}`);
            }
          }
          for (const lineText of lines.values()) {
            const compact = lineText.replace(/\s+/g, "");
            if (/^[\u4e00-\u9fff][，,。.!！？?；;：:、]?$/u.test(compact)) {
              output.push({ type: "orphan-rendered-line", message: `${slot} has a rendered single-character line: ${compact}` });
            }
          }
        }

        for (const frame of document.querySelectorAll(".jp-photo-zone")) {
          const slot = frame.getAttribute("data-slot-id") || frame.getAttribute("data-relation-id") || "image";
          const img = frame.querySelector("img");
          const box = frame.getBoundingClientRect();
          if (!img || !img.getAttribute("src")) {
            output.push({ type: "image-missing", message: `${slot} has no image source.` });
          }
          if (img && (!img.complete || img.naturalWidth === 0)) {
            output.push({ type: "image-load", message: `${slot} image failed to load.` });
          }
          if (box.width <= 0 || box.height <= 0) {
            output.push({ type: "image-frame", message: `${slot} image frame has invalid size.` });
          }
        }
        for (const frame of document.querySelectorAll(".jp-frame-inset")) {
          const box = frame.getBoundingClientRect();
          const hasConstrainedHeight = box.height > 0 && box.height < frame.scrollHeight - 2;
          if (hasConstrainedHeight) {
            output.push({ type: "frame-overflow", message: `A framed content block overflows its fixed area.` });
          }
        }
        return output;
      });
      for (const issue of checks) issues.push({ file, ...issue });
      await page.close();
    }
  } finally {
    await browser.close();
  }
}

async function main() {
  const args = parseArgs(process.argv);
  const files = expandHtmlInputs(args.html);
  if (!files.length) {
    console.error("[validate_poster] Missing --html file or glob");
    process.exit(1);
  }

  const issues = [];
  let expectedProductionDate;
  if (args.manifest) {
    const manifestPath = path.resolve(args.manifest);
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8").replace(/^\uFEFF/, ""));
    expectedProductionDate = manifest.productionDate;
    if (!isEnglishDate(expectedProductionDate ?? "")) {
      issues.push({ file: manifestPath, type: "manifest-production-date", message: "The manifest must record a valid shared production date." });
    }
  }
  const headerDates = new Map();
  for (const file of files) {
    const html = fs.readFileSync(file, "utf8");
    checkStatic(html, file, issues, expectedProductionDate);
    const headerDate = html.replace(/<!--[\s\S]*?-->/g, "").match(/<header class="jp-page-header">[\s\S]*?<p class="jp-page jp-red-mark">([^<]+)<\/p>/i)?.[1]?.trim();
    if (headerDate) headerDates.set(file, headerDate);
  }
  if (new Set(headerDates.values()).size > 1) {
    for (const [file, headerDate] of headerDates) {
      issues.push({ file, type: "header-date-mismatch", message: `The upper-right header must use one shared production date for the full set; found ${headerDate}.` });
    }
  }
  await checkBrowser(files, issues);

  const blocking = issues.filter((issue) => issue.type !== "browser-skipped");
  const result = { ok: blocking.length === 0, files, issues };
  console.log(JSON.stringify(result, null, 2));
  process.exit(blocking.length === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
