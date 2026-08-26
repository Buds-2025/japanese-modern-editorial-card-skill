---
name: jp-magazine-poster
description: Generate validated fixed-layout Japanese magazine style cards as HTML and PNG. Use for one or more 1080x1440 editorial cards that need stable typography, matched copy and images, page metadata, and reusable vertical templates.
---

# JP Magazine Poster

Create fixed-layout editorial cards from a topic, source text, and approved images. The renderer owns geometry; the input spec owns the content and image bindings.

Read [references/template-contract.md](references/template-contract.md) before choosing a template or filling a card.

## Intake and card design

Ask one compact intake round before production unless the user explicitly asks to skip it. Confirm the shared issue, card count, theme, available images or image method, desired templates, copy tone, output path, and restrictions. After that reply, make documented defaults for any remaining gaps instead of asking again.

Build one complete `posters[]` record per card. Do not use global title, detail, or image arrays. A card's `subject.id`, copy, image slots, and page theme stay in the same record. The upper-right production date is generated outside the card record once per render.

- Use the explicit template IDs if the user supplied them. Use all seven available templates only when requested. Otherwise select the fewest templates that fit the material.
- Preserve template CSS, dimensions, grid, safe areas, fonts, and hierarchy. Shorten or rewrite copy when it fails its zone budget.
- A user's explicit typography rule overrides every generic template copy convention. Translate it into input validation before generating output.
- Use local raster images supplied by the user first. If no suitable image is supplied or the user asks for generated art, call the system-provided image generator and save the selected PNG, JPEG, or WebP under the output directory. Do not substitute web search results, stock assets, SVGs, or HTML/CSS-made images. A missing raster image is a failed card, not permission to use placeholder art.
- Keep each image's `subjectId` identical to its card's `subject.id`. Use `fit: "cover"` and an explicit two-part `focus` position.

For every generated image set, read [references/image-generation.md](references/image-generation.md) before writing prompts or selecting an asset.

## Fixed metadata contract

Every version 3 spec must include a boolean top-level `isJapaneseTheme` and one unique `pageTheme` per card.

- Upper left: `issue`, shared by the card set.
- Upper right: generated once at render time from the production date in the Asia/Shanghai time zone, such as `Aug. 24th`. It is identical on every card and never supplied per page.
- Lower left: generated `P01 / pageTheme`, with the `P` number following card order.
- Lower right: generated `01 / totalPages` and remains a page count.
- In `vertical-06`, Japanese kana are permitted only when the entire set has `isJapaneseTheme: true`. Do not put Japanese in non-Japanese `vertical-06` cards. This restriction does not apply to `vertical-08`.
- All visible text must end in a letter, number, or CJK character, never punctuation. This includes headings, captions, quotations, translations, details, issue, date, and page theme. Punctuation inside a line is allowed when necessary. For sourced poetry or quotations, preserve wording and internal punctuation while removing terminal punctuation.
- In Chinese text, use `「」` for quotation marks. Do not use straight quotes or curly quotation marks, including for quoted source text.

## Production and verification

Write a strict version 3 input spec, then run:

```bash
npm run render -- --spec input.json --out output/<run-name>
npm run validate -- --html output/<run-name>/*.html
npm run test:skill
```

The renderer rejects missing slots, duplicate page themes, terminal punctuation in visible copy, non-`「」` Chinese quotation marks, manually supplied per-page dates, unsupported URLs, non-raster sources, non-cover image fits, image-to-subject mismatches, and non-Japanese Japanese text in template 06. The validator checks the same visible-text rules in output HTML as well as the shared production date, page metadata, placeholders, image bindings, image load state, dimensions, overflow, and rendered orphan lines.

Review every generated source image and every exported PNG with a vision-capable tool before delivery. Confirm the declared subject, shared art direction, absence of visible text and borders in source images, every image crop, title, quote, detail text, header date, and page theme. Automated checks stop structural errors; this final review catches semantic mistakes that metadata cannot establish.

## 导出命名规范

最终交付的每张 PNG 使用带序号命名：`P01-<pageTheme>.png`、`P02-<pageTheme>.png`……序号按卡片顺序（`posters[]` 中的顺序）递增，`<pageTheme>` 使用该卡唯一的 `pageTheme`（与页脚 `P0x / pageTheme` 一致）。HTML 与 manifest 保留渲染器生成的文件名，仅 PNG 在交付前重命名为该格式。

## Spec outline

```json
{
  "version": 3,
  "theme": "white",
  "isJapaneseTheme": false,
  "posters": [{
    "id": "garden-feature",
    "template": "vertical-02",
    "subject": { "id": "red-chamber", "label": "红楼梦" },
    "issue": "中国古典四大名著",
    "pageTheme": "大观园",
    "content": { "kickers": ["红楼梦·大观园"], "titles": ["梦醒大观园"], "quotes": ["繁华尽处，青春各自散场"], "details": [{ "body": "大观园盛放诗意，也预示人物命运转折", "english": "A garden of beauty and decline" }] },
    "images": [{ "slot": "single-photo-feature", "subjectId": "red-chamber", "src": "D:/path/to/image.png", "alt": "大观园中的古装女子", "fit": "cover", "focus": "center center" }]
  }]
}
```

The exact content counts and slot names are in the template contract. For a complete all-template reference, use [examples/four-classics-v2.json](examples/four-classics-v2.json).
