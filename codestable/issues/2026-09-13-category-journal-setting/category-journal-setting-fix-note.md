---
doc_type: issue-fix
issue: 2026-09-13-category-journal-setting
path: fast-track
fix_date: 2026-09-13
tags: [category-settings, form-kit, journal]
---

# 分类日志开关无法保存 修复记录

## 1. 问题描述

在分类设置中切换“启用日志”后，分类自定义字段没有进入分类编辑页的提交数据；日志能力最终只表现为插件全局开关的状态，无法按分类生效。

## 2. 根因

`assets/javascripts/discourse/connectors/category-custom-settings/enable-journal.gjs` 在 Discourse 分类编辑页迁移到 FormKit 后，仍直接绑定并修改 `category.custom_fields`。新页面只提交 FormKit 的 transient form data，因此该复选框变更不会被保存。

同一连接器中的作者组选择器也直接修改 `category.custom_fields`，有相同的未保存风险。

## 3. 修复方案

将日志分类设置接入 `@outletArgs.form.Object @name="custom_fields"`：

- 使用 FormKit checkbox 保存 `custom_fields.journal`。
- 使用 FormKit custom field 保存管道分隔的 `custom_fields.journal_author_groups`。

后端的 `Category#journal?` 和 `Topic#journal?` 已按分类字段判断，未修改。

## 4. 改动文件清单

- `assets/javascripts/discourse/connectors/category-custom-settings/enable-journal.gjs`
- `test/javascripts/acceptance/category-settings-test.js`

## 5. 验证结果

- 新增验收测试：保存分类后断言 `PUT /categories/:id` 请求包含 `custom_fields.journal: true`。
- `node --check test/javascripts/acceptance/category-settings-test.js` 通过。
- `git diff --check` 通过。
- 未能运行 Ember 测试：本机 Discourse 的 `bin/ember-cli` 缺少 Ruby `webrick` 依赖；插件目录自身也未安装 ESLint 配置所需的 npm 依赖。

## 6. 遗留事项

需要在可运行的 Discourse 环境中手动确认：仅启用一个分类并保存后，该分类的 `custom_fields.journal` 为真，其他分类不受影响。
