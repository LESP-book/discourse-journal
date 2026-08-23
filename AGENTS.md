# Repository Guidelines

## 项目结构与模块组织
- 入口在 `plugin.rb`，负责加载 Ruby 扩展、路由与资源注册。
- 后端逻辑主要在 `extensions/`、`app/controllers/`、`jobs/`、`lib/`；命名以功能划分，均在 `DiscourseJournal` 命名空间下。
- 前端位于 `assets/javascripts/discourse/`，包含 `components/`、`connectors/`、`initializers/`。
- 样式按端划分：`assets/stylesheets/common`、`desktop`、`mobile`。
- 配置与文案在 `config/`：`settings.yml`、`routes.rb`、`locales/client.*.yml`、`locales/server.*.yml`。

## 构建、测试与本地开发
- 本插件依赖 Discourse 主仓库运行，无独立构建脚本。
- 启动开发环境（在 Discourse 根目录）：`bin/rails s`。
- 前端热更新（在 Discourse 根目录）：`bin/ember-cli -u`。
- 代码规范检查（本仓库）：`npx eslint assets/javascripts`，`npx ember-template-lint assets/javascripts`。

## 编码风格与命名
- Ruby 与 JS 统一 2 空格缩进；Ruby 文件使用 snake_case，模块/类使用 CamelCase。
- JS 使用 ES module 与插件标识常量（如 `PLUGIN_ID`）；连接器命名与路径保持与 Discourse 约定一致。
- SCSS 按端拆分，新增样式优先放入对应端目录。

## 测试指南
- 仓库内未发现专用测试目录；如新增测试，建议放在 `spec/` 并以 `*_spec.rb` 命名。
- 运行插件测试（在 Discourse 根目录）：`bin/rspec plugins/discourse-journal/spec`。

## 提交与 PR 规范
- Git 历史中中英混用且未见固定格式；建议使用简短动词 + 作用域（示例：`journal: 更新入口按钮`）。
- PR 需说明动机与影响范围；涉及 UI 变更请附截图；涉及配置变更请说明对应 `journal_enabled`/分类自定义字段影响。
- 功能与缺陷建议通过 README 中的 Pavilion 请求入口提交。

## 配置与安全提示
- 主要开关在 `config/settings.yml` 的 `journal_enabled`；分类自定义字段控制作者组。
- 修改权限或可见性逻辑时，优先复核 `extensions/guardian.rb` 相关权限判断。
