---
doc_type: issue-fix
issue: 2026-08-23-discourse-deprecation-warnings
path: fast-track
fix_date: 2026-08-23
tags: [discourse, deprecation, gjs, plugin-api]
---

# Discourse 插件废弃告警修复记录

## 1. 问题描述

管理员界面为 `discourse-journal` 显示 `discourse.hbs-extension` 与 `discourse.modify-class-model` 两类废弃告警。

## 2. 根因

- 3 个 connector 仍使用 `.hbs`，其中 2 个还使用分离的 classic backing object。
- Topic 与 PostStream 模型通过 `api.modifyClass("model:...")` 扩展。
- 当前 Discourse 已移除 legacy widget post stream 及旧 keyboard-shortcuts 模块，导致插件在本地最新版无法完整加载。

## 3. 修复方案

- 将 connector 模板和 backing JS 合并为同名 `.gjs`，局部状态改为 tracked state/action。
- 在 pre-initializer 中使用 `addModelGetter`、`addModelField`、`addModelMethod` 注册模型扩展。
- 将 PostStream 评论显隐/重排算法提取至独立 lib，并为核心方法薄包装与算法增加 QUnit。
- 仅保留当前 Glimmer post stream 路径，删除无调用入口的 legacy widget 实现。
- keyboard shortcut 改为 lookup 当前 service；journal tip 使用无运行时 assertion 的原生 title 提示。

## 4. 改动文件清单

- `assets/javascripts/discourse/connectors/**/*.gjs`
- `assets/javascripts/discourse/pre-initializers/journal-topic-model.js`
- `assets/javascripts/discourse/pre-initializers/journal-post-stream-model.js`
- `assets/javascripts/discourse/lib/journal-post-stream.js`
- `assets/javascripts/discourse/initializers/journal-topic.js`
- `assets/javascripts/discourse/initializers/journal-post.gjs`
- `assets/javascripts/discourse/components/journal-topic-tip.gjs`
- `assets/javascripts/discourse/components/journal-comment-button.gjs`
- `assets/javascripts/discourse/components/journal-group-chooser.js`
- `assets/javascripts/discourse/components/journal-show-comments-toggle.gjs`
- `assets/javascripts/discourse/initializers/journal-composer.js`
- `assets/javascripts/discourse/initializers/journal-discovery.js`
- `test/javascripts/unit/**/*-test.js`
- 删除原 connector `.hbs`/backing `.js` 与休眠的 `widgets/timeline-entries.js`

## 5. 验证结果

- 当前 Discourse ESLint/Prettier：全插件 `assets/javascripts` 通过，0 errors / 0 warnings。
- QUnit：9 tests，9 pass，deprecation counter 为 0。
- RSpec：插件无 Ruby examples，0 failures。
- Playwright + 本地 Discourse：journal topic、entry composer 文案/按钮、group chooser 选择、分类 journal 设置、Discovery/Topic body class 清理和 sort-order POST 均通过；两个指定管理员告警均未出现；控制台无错误。
- 插件副本已同步到 `~/discourse_dev/discourse/plugins/discourse-journal`。

## 6. 遗留事项

PostStream 薄包装通过 `factoryFor("model:post-stream").class.prototype` 捕获核心方法模拟 super；若其他插件扩展相同方法，仍可能存在 pre-initializer 顺序耦合。这是当前 `addModelMethod` 无 super callback 时的兼容折衷。
