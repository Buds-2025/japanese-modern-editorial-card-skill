# Template Contract

All templates are 1080 x 1440 vertical posters. The white and midnight versions use the same layout and differ only by theme color. The original project templates remain unchanged; use the optimized copies in `assets/templates`.

## Global Rules

- Before generation, perform exactly one form-style intake round. Summarize the known request, ask compact questions about style/theme, count, image method, template selection, copy tone, output path, and constraints, then proceed after the answer.
- Do not keep asking follow-up questions. If information is still missing after that one round, choose reasonable defaults and record them in the spec or manifest.
- Preserve CSS typography, spacing, width, height, grid, and safe-area rules.
- The upper-left header is the shared `issue` for the full card set. The upper-right header is generated once from the production date in the Asia/Shanghai time zone and repeated unchanged on every card. A per-card `date` field is forbidden. The lower-left footer is `P01 / pageTheme`, with the `P` sequence matching the card order and a distinct 2-18 character `pageTheme` on every card. Keep the lower-right footer as the existing `currentPage / totalPages` count.
- Replace content only inside `data-text-zone` and `.jp-photo-zone` regions. Each output is a self-contained card record with one `subject.id`; never use global parallel arrays or index-based rotation.
- Use `data-slot-id` as the stable replacement key. If missing in older markup, use `data-relation-id`.
- Image replacement changes only `<img src>`, `alt`, `object-fit`, and `object-position`. Every image must declare the same `subjectId` as the card, use a local raster file or HTTPS bitmap URL, and include a descriptive `alt` for visual review.
- Image sourcing priority is strict: user-provided images first; then system-provided image generation when no suitable image is supplied or the user requests generated art. Do not replace this with web search, stock assets, SVGs, or HTML/CSS-made images. A card without a valid bitmap image must fail validation rather than receive substitute art.
- Generated images must follow [image-generation.md](image-generation.md): one declared art direction per set, no visible letters, numbers, punctuation, logos, watermarks, typography, borders, frames, collages, or UI elements. Text belongs in the fixed card layout only.
- Final image sources must be raster files (`.png`, `.jpg`, `.jpeg`, `.webp`) or remote bitmap URLs. Do not leave `.svg` or `data:image/svg+xml` in rendered HTML.
- Text replacement changes only text content inside the target zone.
- Validation must check punctuation, quote style, template placeholder leakage, subject binding, overflow, poster dimensions, image load state, and image frame fill. PNGs still require a final visual review by the generating agent, including generated-image text, border, and style-consistency checks.

## Text Rules

- Every visible text zone must end in a letter, number, or CJK character. Terminal punctuation is prohibited in titles, quotes, captions, details, headers, dates, and page themes. Internal punctuation is allowed when it preserves meaning.
- Sourced poetry and quotations retain their wording and internal punctuation, but terminal punctuation is removed for this card system.
- Chinese quotation marks must use `「」` in every context. Straight quotes and curly quotation marks are prohibited in Chinese text, including quoted source text.
- Avoid manual or rendered lines containing only one CJK character or one CJK character plus punctuation.
- Japanese kana may appear in `vertical-06` only when the top-level `isJapaneseTheme` is `true`. Do not add Japanese to a non-Japanese `vertical-06` card. The restriction does not apply to `vertical-08`.

## Templates

| ID | Template name | Use for | Image slots | Text shape |
| --- | --- | --- | --- | --- |
| `vertical-01` | `vertical-photo-story-notes` | Feature opening with one dominant lifestyle/story image and three detail notes | `large-lifestyle-scene` | Large title, optional English line, 3 compact detail blocks |
| `vertical-02` | `vertical-single-photo-headline` | One photo leading into a headline and thesis | `single-photo-feature` | Large title, one quote, one detail/caption |
| `vertical-03` | `vertical-object-grid-grouping` | Object grouping, product grouping, six related evidence items | `object-group-1` to `object-group-6` | Medium title, one quote, six short item notes |
| `vertical-04` | `vertical-ruled-hierarchy-list` | Hierarchical list or framework without images | none | Medium title, one quote, three numbered rows |
| `vertical-05` | `vertical-image-row-note-list` | Upper image mapped to lower observation rows | `upper-image-sequence` | Short title/meta, one quote, three numbered rows |
| `vertical-06` | `vertical-equal-photo-voice-note` | Quote/person/source voice with equal image and text weight | `equal-height-voice-source-image` | Medium title, one quote, one rich detail block |
| `vertical-08` | `vertical-square-photo-board` | Four-scene environment board or visual mood board | `square-scene-1` to `square-scene-4` | Medium title, one quote, one detail block |

## Copy Budgets

- Large title: 4-18 Chinese characters, max 2 lines.
- Medium title: 4-16 Chinese characters, max 2 lines.
- Golden quote: 8-36 Chinese characters, or 3-20 words when the quote has no CJK text; max 3 lines.
- Detail block: 18-90 Chinese characters unless the template uses compact list rows.
- Compact list item title: 2-8 Chinese characters.
- Compact list item note: 8-28 Chinese characters.
- `vertical-03` object-card notes: 6-10 Chinese characters, one visual line preferred.

Prefer rewriting over squeezing. If content exceeds the zone, reduce text before changing markup.

## Layout Guardrails

- `.jp-photo-zone` must have `width: 100%; max-width: 100%;`. This prevents tall image frames, especially `vertical-06`, from expanding beyond their grid column.
- Validate `.jp-frame-inset` overflow. Fixed-height cards in `vertical-03` must not scroll or overlap the next row.
- Export poster PNGs at 2x scale unless the user explicitly asks for 1x.
