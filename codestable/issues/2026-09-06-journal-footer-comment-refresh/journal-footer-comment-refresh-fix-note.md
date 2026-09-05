---
doc_type: issue-fix
issue: 2026-09-06-journal-footer-comment-refresh
path: fast-track
fix_date: 2026-09-06
tags: [discourse, journal, pagination, localization]
---

# Journal footer and comment refresh fix note

## Evidence

- The journal footer now derives `showCreateButton` from the topic state. Journal topics return `false`; normal topics delegate to core, including current `can_create_post` and core `showCreate` behavior.
- The entry connector requires both `topic.journal` and `topic.can_create_entry`.
- `PostStream.updateFromJson` refreshes are guarded per post-stream with a `WeakMap`. Wrapped append/stage/prepend/commit mutations skip intermediate journal work, one final pass runs after a successful outer refresh, and `finally` restores nested/error state.
- The model regression fake invokes `this.appendPost` from its core `updateFromJson`, covering registered wrapper dispatch. It covers selected-page preservation after commit plus refresh, error cleanup, and normal-topic delegation.
- English client locale strings containing Chinese were translated without changing their topic/reply/comment roles or interpolation names. `server.en.yml` contained no Chinese strings.

## Changed files

- `assets/javascripts/discourse/initializers/journal-topic.js`
- `assets/javascripts/discourse/connectors/after-topic-footer-main-buttons/entry-button-wrapper.gjs`
- `assets/stylesheets/common/journal.scss`
- `assets/javascripts/discourse/pre-initializers/journal-post-stream-model.js`
- `config/locales/client.en.yml`
- `test/javascripts/unit/pre-initializers/journal-post-stream-model-test.js`
- `test/javascripts/unit/initializers/journal-topic-test.js`

## Validation limits

- Prettier check passed using the sibling Discourse checkout configuration.
- ESLint passed for changed JavaScript/GJS files using the sibling Discourse checkout configuration.
- A temporary Babel/QUnit-compatible harness ran the updated model and footer tests; all 9 test groups passed. Official browser QUnit execution was not run because this checkout is outside the sibling Discourse test root and the sibling plugin copy must not be modified.
- Ruby YAML parsing passed for `client.en.yml` and `server.en.yml`.
- Focused Stylelint reports the pre-existing `border-top: 0px` at `journal.scss:184`; a temporary copy with only that baseline unit normalized passes. No unrelated style was changed. Browser behavior was not validated.
- Japanese, French, Portuguese, and Spanish locale coverage is now complete, including comment pagination and the expanded per-page setting; browser/native-speaker review was not performed.
- This change addresses the confirmed refresh batching bug and footer state ownership; it does not prove that every intermittent disappearance symptom has the same cause.
