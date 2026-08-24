import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const skillRoot = path.resolve(scriptDir, "..");
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "jp-magazine-poster-test-"));

function run(args, expectedStatus, label) {
  const result = spawnSync(process.execPath, args, { cwd: skillRoot, encoding: "utf8", env: { ...process.env, JP_POSTER_EXPORT_SCALE: "1", JP_POSTER_SKIP_PNG: "1" } });
  if (result.status !== expectedStatus) {
    throw new Error(`${label} expected exit ${expectedStatus}, received ${result.status}.\n${result.stdout}\n${result.stderr}`);
  }
  return result;
}

try {
  const sample = path.join(skillRoot, "examples", "four-classics-v2.json");
  const sampleOut = path.join(tempRoot, "sample");
  run(["scripts/render_poster.js", "--spec", sample, "--out", sampleOut], 0, "seven-template render");
  const manifest = JSON.parse(fs.readFileSync(path.join(sampleOut, "manifest.json"), "utf8"));
  assert.equal(manifest.outputs.length, 7, "The sample must cover all seven templates.");
  assert.equal(manifest.isJapaneseTheme, false, "The non-Japanese sample must declare its set theme.");
  run(["scripts/validate_poster.js", "--html", ...manifest.outputs.map((output) => output.html), "--manifest", path.join(sampleOut, "manifest.json")], 0, "all-template browser validation");

  for (let index = 0; index < manifest.outputs.length; index += 1) {
    const html = fs.readFileSync(manifest.outputs[index].html, "utf8");
    const page = String(index + 1).padStart(2, "0");
    assert.ok(html.includes(`<p class="jp-page jp-red-mark">${manifest.productionDate}</p>`), `Page ${page} must use the shared production date.`);
    assert.match(html, new RegExp(`<footer class="jp-page-footer"><p class="jp-meta">P${page} / `), `Page ${page} must use its P-number footer.`);
    assert.match(html, new RegExp(`<p class="jp-page jp-red-mark">${page} / 7</p>`), `Page ${page} must retain its lower-right page count.`);
  }
  const alternateDate = manifest.productionDate === "Jan. 1st" ? "Jan. 2nd" : "Jan. 1st";
  const dateMismatchHtml = path.join(sampleOut, "date-mismatch.html");
  const firstHtml = fs.readFileSync(manifest.outputs[0].html, "utf8");
  assert.ok(firstHtml.includes(manifest.productionDate), "Rendered HTML must contain the production date.");
  fs.writeFileSync(dateMismatchHtml, firstHtml.replace(manifest.productionDate, alternateDate));
  const dateMismatch = run(["scripts/validate_poster.js", "--html", manifest.outputs[0].html, dateMismatchHtml, "--manifest", path.join(sampleOut, "manifest.json")], 1, "shared production date mismatch rejection");
  assert.match(dateMismatch.stdout, /header-production-date/, "The validator must reject a date that differs from the manifest production date.");
  const voiceHtml = fs.readFileSync(manifest.outputs[5].html, "utf8");
  assert.doesNotMatch(voiceHtml, /lang="ja"|[\u3040-\u30ff]/u, "Non-Japanese template 06 must not render Japanese.");

  const japaneseOut = path.join(tempRoot, "japanese-theme");
  run(["scripts/render_poster.js", "--spec", "tests/fixtures/template-06-japanese-true.json", "--out", japaneseOut], 0, "Japanese template 06 render");
  const japaneseHtml = fs.readFileSync(path.join(japaneseOut, "tokyo-voice-white.html"), "utf8");
  assert.match(japaneseHtml, /lang="ja"[\s\S]*[\u3040-\u30ff]/u, "Japanese template 06 must retain approved Japanese copy.");

  run(["scripts/render_poster.js", "--spec", "tests/fixtures/subject-mismatch.json", "--out", path.join(tempRoot, "subject-mismatch")], 1, "subject mismatch rejection");
  run(["scripts/render_poster.js", "--spec", "tests/fixtures/template-06-japanese-false.json", "--out", path.join(tempRoot, "japanese-rejection")], 1, "non-Japanese template 06 rejection");
  run(["scripts/render_poster.js", "--spec", "tests/fixtures/manual-date-rejection.json", "--out", path.join(tempRoot, "manual-date")], 1, "manual per-card date rejection");
  run(["scripts/render_poster.js", "--spec", "tests/fixtures/duplicate-page-theme.json", "--out", path.join(tempRoot, "duplicate-page-theme")], 1, "duplicate page theme rejection");
  run(["scripts/render_poster.js", "--spec", "tests/fixtures/terminal-punctuation.json", "--out", path.join(tempRoot, "terminal-punctuation")], 1, "terminal punctuation rejection");
  run(["scripts/render_poster.js", "--spec", "tests/fixtures/invalid-chinese-quotes.json", "--out", path.join(tempRoot, "invalid-chinese-quotes")], 1, "Chinese quotation mark rejection");
  console.log("jp-magazine-poster tests passed");
} finally {
  fs.rmSync(tempRoot, { recursive: true, force: true });
}
