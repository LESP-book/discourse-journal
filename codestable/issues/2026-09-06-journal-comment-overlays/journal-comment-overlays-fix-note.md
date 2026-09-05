---
doc_type: issue-fix
issue: 2026-09-06-journal-comment-overlays
path: fast-track
status: awaiting-site-validation
fix_date: 2026-09-06
tags: [journal, stylesheets, reactions, accessibility]
---

# Comment overlay clipping

## Report and cause

The user's screenshot shows a reaction picker with its top row cut off above a journal comment. The desired behavior is to show and allow selecting every candidate, including candidates above the comment boundary.

Two plugin-owned clipping ancestors were found:

- `assets/stylesheets/common/journal.scss`: `div.topic-post.comment` uses `overflow: hidden`; `.show` previously restored height/opacity/visibility but not overflow.
- `assets/stylesheets/desktop/journal.scss`: hover-revealed post action wrappers also retained `overflow: hidden` and a height cap. Core reactions nests the picker inside `.discourse-reactions-actions-button-shim`, so fixing only the outer comment does not remove this second clip.

Increasing the picker's z-index cannot escape either ancestor's overflow clipping. No reactions component, DOM placement, core files or z-index was changed.

## Fix

- Shown comments now use `overflow: visible`; folded comments retain clipping, zero maximum height and hidden visibility/opacity.
- Desktop action wrappers no longer clip or collapse their contents. Opacity and pointer events control their hover visibility without changing their dimensions.
- `:focus-within` also reveals the controls. Removing `visibility: hidden` from these wrappers fixes the related inability to reach hidden reply controls by keyboard. `:where` keeps the hiding selector less specific than the reveal selector without `!important`.
- Added `test/javascripts/unit/stylesheets/journal-comment-overlays-test.js`: five DOM/layout tests for reactions, fold/reopen, keyboard focus, ordinary posts, and who-liked/who-read overlays.

## Validation

- Compiled baseline and patched common + desktop/mobile SCSS using installed Ruby 3.4.9 / SassC. Included the sibling reactions stylesheet; supplied stand-ins only for Discourse Sass color/shadow/z-index helpers, font variables and the user-select mixin.
- Ran the new QUnit tests in local headless Chromium through Playwright, using a static DOM fixture modeled on the core post/reactions wrappers. Patched desktop and mobile CSS each passed all 17 assertions (34 total). Baseline desktop failed 8 assertions and baseline mobile failed 5, confirming the regression checks detect the old clipping and focus defects.
- Additional real pointer hover checks passed on desktop and mobile fixture layouts. Before/after fixture screenshots are `/tmp/journal-overlay-{baseline,fixed}-{desktop,mobile}.png`.
- Temporary local runners: `/tmp/journal-overlay-compile.rb` and `/tmp/journal-overlay-browser.cjs`. Run from the plugin root with `env -u GEM_HOME -u GEM_PATH RBENV_VERSION=3.4.9 ruby /tmp/journal-overlay-compile.rb`, then `node /tmp/journal-overlay-browser.cjs`. These use existing local dependencies and an explicit cached Chromium executable; no dependencies were installed.
- New test passes ESLint and Prettier using the already-installed `@discourse/lint-configs` package in the sibling pnpm store. The normal top-level config paths have broken dependency resolution, so validation used the installed package's direct paths without changing dependencies/core.
- Stylelint reports four existing issues in the changed SCSS files (two zero units, one comment-spacing issue, one empty-line issue). Baseline comparison confirms all four predate this fix; the baseline additionally had a selector-notation warning removed by the new selector. No unrelated lint cleanup was made.
- `git diff --check` passed.

## Scope and remaining verification

Reviewed nearby common/desktop/mobile comment styles, comment button, and pagination component/state logic. No additional confirmed defect beyond the clipping and keyboard-focus issues was changed. This is not a full plugin audit.

The browser run tests actual compiled styles, not a running Discourse site or the user's theme. Full Ember integration, reaction submission, theme-specific stacking and touch interactions remain to be checked on the target site. Suggested check: open a short comment's multi-row picker, select an upper-row reaction, check reply/other menus, fold/reopen comments, and repeat on mobile. No commit was made.
