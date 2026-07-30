---
doc_type: issue-fix
issue: 2026-07-30-journal-new-reply-composer
status: fixed
path: fast-track
fix_date: 2026-07-30
tags: [journal, composer, reply-button]
---

# 日志话题“新回复”按钮不打开编辑器修复记录

## 1. 问题描述

在日志话题底部点击“新回复”按钮后，回复编辑器没有出现；核心“回复”按钮被插件样式隐藏后，该入口成为日志话题创建新回复的主要入口。

## 2. 根因

`entry-button-wrapper.js` 将 `createEntry` 放在 connector 对象顶层，模板却通过 `this.createEntry` 传递回调。当前 Discourse 的 `PluginConnector` 只会绑定 connector 的 `actions` 哈希，因此模板拿不到可执行的 connector action，点击后不会调用话题控制器的 `replyToPost`。

## 3. 修复方案

恢复 connector 的 `actions.createEntry` 结构，并在模板中通过 `action "createEntry"` 派发，让 Discourse 负责绑定 connector 上下文；保留现有 `controller.send("replyToPost")` 调用，复用核心回复入口的编辑器打开流程。

## 4. 改动文件清单

- `assets/javascripts/discourse/connectors/after-topic-footer-main-buttons/entry-button-wrapper.js`
- `assets/javascripts/discourse/connectors/after-topic-footer-main-buttons/entry-button-wrapper.hbs`

本次没有修改分析范围外的代码，也没有新增超时、长度、重试或静默回退限制。

## 5. 验证结果

- `node --check assets/javascripts/discourse/connectors/after-topic-footer-main-buttons/entry-button-wrapper.js`：通过。
- `pnpm exec prettier --check ...`：通过。
- `pnpm exec eslint ...`：通过。
- `git diff --check`：通过。
- 已核对核心 `PluginConnector` 实现：`actions` 中的方法会绑定到 connector 实例，模板的 `action "createEntry"` 会进入该 action。

以下验证受本地环境阻塞：

- `ember-template-lint` 因当前依赖中的 `@discourse/lint-configs` 未导出 `template-lint` 子路径而无法启动。
- 浏览器冒烟验证暂未执行；本地 Discourse 无法启动，缺少 Bundler 所需的多个 Ruby gems。

## 6. 遗留事项

补齐本地 Ruby 依赖并启动 Discourse 后，需在日志话题中点击“新回复”，确认编辑器出现；同时确认普通话题的核心“回复”按钮行为不受影响。

## 7. 后续弃用迁移（2026-07-31）

上一版恢复的 `{{action "createEntry"}}` 虽然解决了按钮无响应问题，但触发了 Ember 的 `discourse.template-action` 弃用提示。现已将 connector 迁移为 `entry-button-wrapper.gjs`，使用 `@action` 方法和 `@action={{this.createEntry}}`，删除旧的 `.js` 与 `.hbs` 文件。
