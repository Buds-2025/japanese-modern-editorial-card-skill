import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const skillRoot = path.resolve(__dirname, "..");

const TEMPLATE_RULES = {
  "vertical-01": { imageSlots: ["large-lifestyle-scene"], titles: 1, quotes: 0, details: 3, kickers: 1, detailMode: "columns" },
  "vertical-02": { imageSlots: ["single-photo-feature"], titles: 1, quotes: 1, details: 1, kickers: 1, detailMode: "caption" },
  "vertical-03": { imageSlots: ["object-group-1", "object-group-2", "object-group-3", "object-group-4", "object-group-5", "object-group-6"], titles: 1, quotes: 1, details: 6, kickers: 1, detailMode: "object-grid" },
  "vertical-04": { imageSlots: [], titles: 1, quotes: 1, details: 3, kickers: 0, detailMode: "list" },
  "vertical-05": { imageSlots: ["upper-image-sequence"], titles: 0, quotes: 1, details: 3, kickers: 1, detailMode: "list" },
  "vertical-06": { imageSlots: ["equal-height-voice-source-image"], titles: 1, quotes: 1, details: 1, kickers: 1, detailMode: "voice", maxQuoteCjk: 12 },
  "vertical-08": { imageSlots: ["square-scene-1", "square-scene-2", "square-scene-3", "square-scene-4"], titles: 1, quotes: 1, details: 1, kickers: 0, detailMode: "board" },
};

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i += 1) {
    const [key, value] = argv[i].replace(/^--/, "").split("=");
    args[key] = value ?? argv[i + 1];
    if (value == null && argv[i + 1] && !argv[i + 1].startsWith("--")) i += 1;
  }
  return args;
}

function fail(message) { console.error(`[render_poster] ${message}`); process.exit(1); }
function assert(condition, message) { if (!condition) fail(message); }
function escapeHtml(value) { return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;"); }
function textOnly(value) { return String(value ?? "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim(); }
function countCjk(value) { return [...textOnly(value)].filter((char) => /[\u3400-\u9fff]/u.test(char)).length; }
function hasTerminalPunctuation(value) { return /\p{P}$/u.test(textOnly(value)); }
function hasInvalidChineseQuote(value) {
  const text = textOnly(value);
  const standaloneApostrophe = /(?<![A-Za-z])['‘’](?![A-Za-z])/u;
  return /[“”]/u.test(text) || (/[\u3400-\u9fff]/u.test(text) && (/"/u.test(text) || standaloneApostrophe.test(text)));
}
function assertVisibleTextRules(value, label) {
  assert(!hasTerminalPunctuation(value), `${label} must not end with punctuation.`);
  assert(!hasInvalidChineseQuote(value), `${label} must use 「」 for quotation marks in Chinese text.`);
}
function hasJapaneseKana(value) { return /[\u3040-\u30ff]/u.test(String(value ?? "")); }
function isObjectPosition(value) { return /^(?:left|center|right|(?:100|[1-9]?\d)%)(?:\s+)(?:top|center|bottom|(?:100|[1-9]?\d)%)$/iu.test(textOnly(value)); }
function productionDate() {
  const now = new Date();
  const month = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Shanghai", month: "short" }).format(now);
  const day = Number(new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Shanghai", day: "numeric" }).format(now));
  const suffix = day % 100 >= 11 && day % 100 <= 13 ? "th" : ({ 1: "st", 2: "nd", 3: "rd" }[day % 10] ?? "th");
  return `${month === "May" ? month : `${month}.`} ${day}${suffix}`;
}

function assertExactArray(value, expected, label) {
  assert(Array.isArray(value), `${label} must be an array with ${expected} item(s).`);
  assert(value.length === expected, `${label} must have exactly ${expected} item(s), received ${value.length}.`);
}

function validateCopy(poster, rule) {
  const content = poster.content ?? {};
  assertExactArray(content.titles ?? [], rule.titles, `${poster.id}.content.titles`);
  assertExactArray(content.quotes ?? [], rule.quotes, `${poster.id}.content.quotes`);
  assertExactArray(content.details ?? [], rule.details, `${poster.id}.content.details`);
  assertExactArray(content.kickers ?? [], rule.kickers, `${poster.id}.content.kickers`);
  if (rule.detailMode === "columns") assert(textOnly(content.caption), `${poster.id}.content.caption is required by ${poster.template}.`);
  if (textOnly(content.caption)) assertVisibleTextRules(content.caption, `${poster.id}.content.caption`);
  for (const [index, title] of content.titles.entries()) {
    assertVisibleTextRules(title, `${poster.id}.content.titles[${index}]`);
    assert(countCjk(title) >= 2 && countCjk(title) <= 18, `${poster.id}.content.titles[${index}] must contain 2-18 CJK characters.`);
  }
  for (const [index, quote] of content.quotes.entries()) {
    assertVisibleTextRules(quote, `${poster.id}.content.quotes[${index}]`);
    const maxQuoteCjk = rule.maxQuoteCjk ?? 36;
    const cjkCount = countCjk(quote);
    if (cjkCount > 0) {
      assert(cjkCount >= 4 && cjkCount <= maxQuoteCjk, `${poster.id}.content.quotes[${index}] must contain 4-${maxQuoteCjk} CJK characters.`);
    } else {
      const wordCount = textOnly(quote).split(/\s+/).filter(Boolean).length;
      assert(wordCount >= 3 && wordCount <= 20, `${poster.id}.content.quotes[${index}] must contain 3-20 words when it has no CJK text.`);
    }
  }
  for (const [index, detail] of content.details.entries()) {
    assert(detail && typeof detail === "object", `${poster.id}.content.details[${index}] must be an object.`);
    assert(textOnly(detail.body), `${poster.id}.content.details[${index}].body is required.`);
    assertVisibleTextRules(detail.body, `${poster.id}.content.details[${index}].body`);
    for (const key of ["title", "heading", "english", "japanese"]) {
      if (textOnly(detail[key])) assertVisibleTextRules(detail[key], `${poster.id}.content.details[${index}].${key}`);
    }
    assert(!/主题标题|承载区|金句区|详细内容|NOTE \d|TITLE [AB]|VOICE FIELD|FEATURE TITLE|IMAGE GROUP|DETAIL ZONE/i.test(JSON.stringify(detail)), `${poster.id}.content.details[${index}] contains template placeholder text.`);
    if (["list", "object-grid"].includes(rule.detailMode)) assert(textOnly(detail.title), `${poster.id}.content.details[${index}].title is required by ${poster.template}.`);
    if (rule.detailMode === "object-grid") {
      assert(countCjk(detail.title) <= 8, `${poster.id}.content.details[${index}].title exceeds the object-card budget.`);
      assert(countCjk(detail.body) >= 6 && countCjk(detail.body) <= 10, `${poster.id}.content.details[${index}].body must contain 6-10 CJK characters.`);
    }
  }
  for (const [index, kicker] of content.kickers.entries()) {
    assert(textOnly(kicker), `${poster.id}.content.kickers[${index}] is required.`);
    assertVisibleTextRules(kicker, `${poster.id}.content.kickers[${index}]`);
  }
}

function validateImages(poster, rule, rootDir) {
  assertExactArray(poster.images ?? [], rule.imageSlots.length, `${poster.id}.images`);
  const seen = new Set();
  for (const image of poster.images) {
    assert(image && typeof image === "object", `${poster.id}.images contains an invalid item.`);
    assert(rule.imageSlots.includes(image.slot), `${poster.id}.images uses an unsupported slot: ${image.slot}.`);
    assert(!seen.has(image.slot), `${poster.id}.images repeats slot ${image.slot}.`);
    seen.add(image.slot);
    assert(image.subjectId === poster.subject.id, `${poster.id}.images.${image.slot}.subjectId must equal ${poster.subject.id}.`);
    assert(textOnly(image.alt), `${poster.id}.images.${image.slot}.alt is required for visual review.`);
    assert(image.src && !/\.svg(?:$|[?#])|^data:image\/svg\+xml/i.test(image.src), `${poster.id}.images.${image.slot}.src must be a raster image, never SVG.`);
    assert(/\.(png|jpe?g|webp)(?:$|[?#])/i.test(image.src) || /^https:\/\//i.test(image.src), `${poster.id}.images.${image.slot}.src must be PNG, JPEG, WebP, or an HTTPS URL.`);
    if (!/^https:\/\//i.test(image.src)) assert(fs.existsSync(path.resolve(rootDir, image.src)), `${poster.id}.images.${image.slot}.src does not exist.`);
    assert((image.fit ?? "cover") === "cover", `${poster.id}.images.${image.slot}.fit must be cover to fill its fixed frame.`);
    assert(isObjectPosition(image.focus), `${poster.id}.images.${image.slot}.focus must be two CSS object-position values between 0% and 100%.`);
  }
}

function validatePoster(poster, rootDir, isJapaneseTheme) {
  assert(poster && typeof poster === "object", "Each posters item must be an object.");
  assert(/^[a-z0-9-]+$/i.test(poster.id ?? ""), "poster.id must contain letters, numbers, or hyphens.");
  const rule = TEMPLATE_RULES[poster.template];
  assert(rule, `${poster.id}.template is unsupported: ${poster.template}.`);
  assert(poster.subject && /^[a-z0-9-]+$/i.test(poster.subject.id ?? ""), `${poster.id}.subject.id is required.`);
  assert(textOnly(poster.subject.label), `${poster.id}.subject.label is required.`);
  assert(textOnly(poster.issue), `${poster.id}.issue is required. Placeholder headers are forbidden.`);
  assertVisibleTextRules(poster.issue, `${poster.id}.issue`);
  assert(!Object.hasOwn(poster, "date"), `${poster.id}.date is forbidden. The renderer writes one shared production date to every upper-right header.`);
  const pageTheme = textOnly(poster.pageTheme);
  assert(pageTheme.length >= 2 && pageTheme.length <= 18, `${poster.id}.pageTheme must contain 2-18 characters.`);
  assertVisibleTextRules(pageTheme, `${poster.id}.pageTheme`);
  if (poster.template === "vertical-06" && !isJapaneseTheme) {
    assert(!hasJapaneseKana(JSON.stringify(poster)), `${poster.id} uses template 06 and must not contain Japanese kana outside a Japanese theme.`);
  }
  validateCopy(poster, rule);
  validateImages(poster, rule, rootDir);
  return rule;
}

function extractSections(html) {
  const sections = new Map();
  for (const match of html.matchAll(/<section\b[\s\S]*?<\/section>/g)) {
    const id = match[0].match(/\bid="([^"]+)"/)?.[1];
    if (id) sections.set(id, match[0]);
  }
  return sections;
}

function replaceNth(html, regex, values, label) {
  let index = 0;
  const result = html.replace(regex, (match, before, _old, after) => {
    if (index >= values.length) return match;
    const value = values[index]; index += 1;
    return `${before}${escapeHtml(value)}${after}`;
  });
  assert(index === values.length, `${label} could not be mapped to every required template zone.`);
  return result;
}

function fillText(section, poster, rule, pageNumber, isJapaneseTheme, sharedDate) {
  const content = poster.content;
  section = section.replace(/(<p class="jp-issue">)([\s\S]*?)(<\/p>)/g, `$1${escapeHtml(textOnly(poster.issue))}$3`);
  section = section.replace(/(<header class="jp-page-header">[\s\S]*?<p class="jp-page jp-red-mark">)([\s\S]*?)(<\/p>)/, `$1${escapeHtml(sharedDate)}$3`);
  section = section.replace(/(<footer class="jp-page-footer"><p class="jp-meta">)(?:J|P)\d{2} \/ ([\s\S]*?)(<\/p>)/, `$1P${String(pageNumber).padStart(2, "0")} / ${escapeHtml(textOnly(poster.pageTheme))}$3`);
  section = replaceNth(section, /(<h[12][^>]*>)([\s\S]*?)(<\/h[12]>)/g, content.titles.map(textOnly), `${poster.id}.titles`);
  section = replaceNth(section, /(<div[^>]*class="[^"]*jp-template-quote-zone[^"]*"[^>]*>\s*<p[^>]*>)([\s\S]*?)(<\/p>)/g, content.quotes.map(textOnly), `${poster.id}.quotes`);
  if (rule.detailMode === "voice" && content.quotes.some((quote) => countCjk(quote) === 0)) {
    section = section.replace(/(<div[^>]*class="[^"]*jp-template-quote-zone[^"]*"[^>]*>\s*<p[^>]*style=")([^"]*)/g, "$1$2;white-space:normal;font-size:26px;line-height:1.3");
  }
  section = replaceNth(section, /(<p class="jp-meta jp-red-mark">)([\s\S]*?)(<\/p>)/g, content.kickers.map(textOnly), `${poster.id}.kickers`);
  const headings = content.details.map((detail, index) => textOnly(detail.heading || detail.title || `NOTE ${index + 1}`));
  const titles = content.details.map((detail) => textOnly(detail.title));
  const bodies = content.details.map((detail) => textOnly(detail.body));
  const english = content.details.map((detail) => textOnly(detail.english || ""));
  const japanese = rule.detailMode === "voice" && isJapaneseTheme ? content.details.map((detail) => textOnly(detail.japanese || "")) : content.details.map(() => "");
  if (rule.detailMode === "voice") {
    const replacement = `<p class="jp-detail-micro-heading jp-red-mark">${escapeHtml(headings[0])}</p><p class="jp-detail-micro-copy">${escapeHtml(bodies[0])}</p>${english[0] ? `<p class="jp-detail-micro-copy jp-english-zone" style="margin-top:10px">${escapeHtml(english[0])}</p>` : ""}${japanese[0] ? `<p class="jp-detail-micro-copy" lang="ja" style="margin-top:10px">${escapeHtml(japanese[0])}</p>` : ""}`;
    section = section.replace(/(<div class="jp-template-detail-zone"[^>]*>)[\s\S]*?(<\/div><\/article>)/, `$1${replacement}$2`);
  } else if (rule.detailMode === "columns") {
    section = replaceNth(section, /(<p class="[^"]*jp-detail-micro-heading[^"]*"[^>]*>)([\s\S]*?)(<\/p>)/g, headings, `${poster.id}.detail headings`);
    section = replaceNth(section, /(<p class="[^"]*jp-detail-micro-copy(?![^>]*\ben\b)[^"]*"[^>]*>)([\s\S]*?)(<\/p>)/g, bodies, `${poster.id}.detail copy`);
    section = replaceNth(section, /(<p class="[^"]*jp-detail-micro-copy\s+en[^"]*"[^>]*>)([\s\S]*?)(<\/p>)/g, english, `${poster.id}.detail English copy`);
    section = replaceNth(section, /(<p class="[^"]*jp-cap\s+jp-english-zone[^"]*"[^>]*>)([\s\S]*?)(<\/p>)/g, [textOnly(content.caption)], `${poster.id}.feature caption`);
  } else if (["object-grid", "list"].includes(rule.detailMode)) {
    const titlePattern = rule.detailMode === "object-grid"
      ? /(<p class="[^"]*jp-list-kicker[^"]*"[^>]*>)([\s\S]*?)(<\/p>)/g
      : /(<p class="[^"]*jp-list-title[^"]*"[^>]*>)([\s\S]*?)(<\/p>)/g;
    section = replaceNth(section, titlePattern, titles, `${poster.id}.detail titles`);
    section = replaceNth(section, /(<p class="[^"]*jp-list-note[^"]*"[^>]*>)([\s\S]*?)(<\/p>)/g, bodies, `${poster.id}.detail bodies`);
  } else if (rule.detailMode === "caption") {
    assert(english[0], `${poster.id}.content.details[0].english is required by ${poster.template}.`);
    section = replaceNth(section, /(<p class="[^"]*jp-cap[^>]*>)([\s\S]*?)(<\/p>)/g, english, `${poster.id}.english caption`);
  } else if (rule.detailMode === "board") {
    assert(english[0], `${poster.id}.content.details[0].english is required by ${poster.template}.`);
    section = replaceNth(section, /(<div[^>]*class="[^"]*jp-template-detail-zone[^"]*"[^>]*>\s*<p class="[^"]*jp-body[^"]*"[^>]*>)([\s\S]*?)(<\/p>)/g, bodies, `${poster.id}.board body`);
    section = replaceNth(section, /(<p class="[^"]*jp-cap[^>]*>)([\s\S]*?)(<\/p>)/g, english, `${poster.id}.board caption`);
  }
  if (rule.detailMode === "voice") {
    const caption = textOnly(content.caption || "");
    section = section.replace(/<p class="jp-cap jp-english-zone"[^>]*>[\s\S]*?<\/p>/, caption ? `<p class="jp-cap jp-english-zone" style="margin-top:18px;width:100%;text-transform:uppercase">${escapeHtml(caption)}</p>` : "");
  }
  return section;
}

function fillImages(section, poster, rootDir) {
  const images = new Map(poster.images.map((image) => [image.slot, image]));
  return section.replace(/(<figure\b(?=[^>]*\bjp-photo-zone\b)(?=[^>]*\bdata-slot-id="([^"]+)")[^>]*>\s*<img\b)([^>]*)(>)/g, (match, prefix, slot, attrs, close) => {
    const image = images.get(slot); assert(image, `${poster.id} has no image binding for ${slot}.`);
    let clean = attrs.replace(/\s+src="[^"]*"/, "").replace(/\s+alt="[^"]*"/, "").replace(/\s+style="[^"]*"/, "");
    const src = /^https?:\/\//i.test(image.src) ? image.src : pathToFileURL(path.resolve(rootDir, image.src)).href;
    clean += ` src="${escapeHtml(src)}" alt="${escapeHtml(image.alt)}" data-jp-subject-id="${escapeHtml(image.subjectId)}" style="object-fit:${escapeHtml(image.fit ?? "cover")};object-position:${escapeHtml(image.focus)}"`;
    return `${prefix}${clean}${close}`;
  });
}

async function exportPng(htmlFile, pngFile) {
  if (process.env.JP_POSTER_SKIP_PNG === "1") return { ok: true, skipped: true, reason: "PNG export skipped by JP_POSTER_SKIP_PNG." };
  let chromium; try { ({ chromium } = await import("playwright")); } catch { return { ok: false, reason: "Playwright is not installed." }; }
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1200, height: 1600 }, deviceScaleFactor: Number(process.env.JP_POSTER_EXPORT_SCALE || 2) });
    await page.goto(pathToFileURL(htmlFile).href, { waitUntil: "networkidle" });
    await page.locator("section.poster").first().screenshot({ path: pngFile }); return { ok: true };
  } catch (error) { return { ok: false, reason: error.message }; } finally { await browser.close(); }
}

async function main() {
  const args = parseArgs(process.argv); assert(args.spec, "Missing --spec input.json"); assert(args.out, "Missing --out output directory");
  const specPath = path.resolve(args.spec); const rootDir = path.dirname(specPath); const outDir = path.resolve(args.out);
  const spec = JSON.parse(fs.readFileSync(specPath, "utf8").replace(/^\uFEFF/, ""));
  assert(spec.version === 3, "Only strict version 3 specs are accepted. Migrate legacy titles/details arrays into posters[].");
  assert(["white", "midnight"].includes(String(spec.theme).toLowerCase()), "theme must be white or midnight.");
  assert(typeof spec.isJapaneseTheme === "boolean", "isJapaneseTheme must be true or false for the entire poster set.");
  assert(Array.isArray(spec.posters) && spec.posters.length > 0, "posters must be a non-empty array.");
  const ids = new Set(); const pageThemes = new Set();
  for (const poster of spec.posters) {
    assert(!ids.has(poster.id), `Duplicate poster.id: ${poster.id}`); ids.add(poster.id);
    const pageTheme = textOnly(poster.pageTheme);
    assert(!pageThemes.has(pageTheme), `Duplicate pageTheme: ${pageTheme}. Each page needs its own small theme.`); pageThemes.add(pageTheme);
    validatePoster(poster, rootDir, spec.isJapaneseTheme);
  }
  const theme = String(spec.theme).toLowerCase(); const sharedDate = productionDate(); const templateHtml = fs.readFileSync(path.join(skillRoot, "assets", "templates", theme, "index.html"), "utf8");
  const sections = extractSections(templateHtml); const sheetOpen = '<main class="sheet">'; const sheetIndex = templateHtml.indexOf(sheetOpen); assert(sheetIndex >= 0, "Template is missing the sheet wrapper.");
  const prefix = templateHtml.slice(0, sheetIndex + sheetOpen.length); const suffix = "\n  </main>\n</body>\n</html>\n"; fs.mkdirSync(outDir, { recursive: true });
  const manifest = { version: 3, spec: specPath, theme, isJapaneseTheme: spec.isJapaneseTheme, productionDate: sharedDate, exportScale: Number(process.env.JP_POSTER_EXPORT_SCALE || 2), outputs: [] };
  for (let index = 0; index < spec.posters.length; index += 1) {
    const poster = spec.posters[index]; const rule = TEMPLATE_RULES[poster.template]; let section = sections.get(poster.template); assert(section, `Template markup is missing ${poster.template}.`);
    section = section.replace(/<section\b/, `<section data-jp-poster-id="${escapeHtml(poster.id)}" data-jp-subject-id="${escapeHtml(poster.subject.id)}" data-jp-subject-label="${escapeHtml(poster.subject.label)}" data-jp-is-japanese-theme="${spec.isJapaneseTheme ? "true" : "false"}"`);
    section = section.replace(/(<footer class="jp-page-footer">[\s\S]*?<p class="jp-page jp-red-mark">)([\s\S]*?)(<\/p>)/, `$1${String(index + 1).padStart(2, "0")} / ${spec.posters.length}$3`);
    section = fillText(section, poster, rule, index + 1, spec.isJapaneseTheme, sharedDate); section = fillImages(section, poster, rootDir);
    const htmlFile = path.join(outDir, `${poster.id}-${theme}.html`); const pngFile = path.join(outDir, `${poster.id}-${theme}.png`); fs.writeFileSync(htmlFile, `${prefix}\n${section}\n${suffix}`, "utf8");
    const exported = await exportPng(htmlFile, pngFile); assert(exported.ok, `${poster.id} PNG export failed: ${exported.reason}`);
    manifest.outputs.push({ posterId: poster.id, template: poster.template, subject: poster.subject, html: htmlFile, png: pngFile, images: poster.images.map(({ slot, src, subjectId, alt }) => ({ slot, src, subjectId, alt })), export: exported });
  }
  fs.writeFileSync(path.join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2), "utf8"); console.log(JSON.stringify(manifest, null, 2));
}

main().catch((error) => fail(error.stack || error.message));
