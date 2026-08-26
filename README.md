# jp-magazine-poster

生成固定版式的日杂风卡片，输出1080×1440的HTML与PNG。它将每张卡的文案、主题、图片和页码写进同一个`posters[]`记录，并在渲染前后进行结构与浏览器校验。

## 使用

```bash
npm install
npm run render -- --spec examples/four-classics-v2.json --out ../output/qa/four-classics-v3
npm run validate -- --html ../output/qa/four-classics-v3/*.html
npm run test:skill
```

输入只接受严格的`version:3`。完整字段、版式槽位和字数限制见[SKILL.md](SKILL.md)与[模板契约](references/template-contract.md)。

## 固定规则

- 左上页眉使用整组共同主题`issue`。
- 右上页眉由渲染器在制作时按Asia/Shanghai时区写入当天英文日期，格式如`Aug. 24th`，整组所有页面保持一致，不接受每页单独传入日期。
- 左下页脚自动生成`P01 / pageTheme`。`pageTheme`必须简短且每页不同。
- 右下页脚保留自动生成的`01 / totalPages`页码。
- 图片必须是本地PNG、JPEG、WebP或HTTPS图片，且使用`cover`填满固定图片框。
- 每张图片的`subjectId`必须与卡片的`subject.id`完全一致。
- 用户未提供合适图片或明确要求生图时，必须调用系统自带生图能力。生成图不得出现文字、数字、标点、标识、水印、边框、相框、拼贴或界面元素；同组生成图必须共享一套艺术方向。
- 所有可见文字的句末不得出现标点。原诗与引文保留词序和句中标点，删除句末标点。中文语境引号一律使用`「」`。
- 日文限制只作用于第6版式`vertical-06`：仅当整组`isJapaneseTheme:true`时才允许日文。第8版式不受该规则限制。
- 最终交付的每张PNG使用带序号命名`P01-<pageTheme>.png`、`P02-<pageTheme>.png`……序号按卡片顺序递增，`<pageTheme>`与该卡页脚`P0x / pageTheme`一致；HTML与manifest保留渲染器生成的文件名。

渲染器会拦截缺槽位、文图主题错绑、重复页内主题、手工传入的页面日期、SVG最终图、占位文本和不合规日文。校验器继续检查成品HTML中的统一制作日期、页脚、图片加载、画布尺寸、溢出和孤字行。发布前仍需逐张查看生成图和PNG，确认无文字或边框，并确认语义、画面与统一艺术方向对应。

## 目录

```text
jp-magazine-poster/
|-- SKILL.md
|-- assets/templates/
|-- examples/four-classics-v2.json
|-- references/template-contract.md
|-- references/image-generation.md
|-- scripts/render_poster.js
|-- scripts/validate_poster.js
|-- scripts/test_skill.js
`-- tests/fixtures/
```
