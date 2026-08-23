import Component from "@glimmer/component";
import { tracked } from "@glimmer/tracking";
import { fn } from "@ember/helper";
import { on } from "@ember/modifier";
import { action } from "@ember/object";
import { eq, not } from "discourse/truth-helpers";
import { i18n } from "discourse-i18n";

// 页码按钮只展示当前页附近窗口、首页和尾页，避免大量评论时控件横向撑爆。
const PAGE_WINDOW_RADIUS = 2;

export default class JournalCommentPagination extends Component {
  static shouldRender(args) {
    return args.post?.journal && args.post?.attachCommentPagination;
  }

  @tracked jumpPage = "";

  get currentPage() {
    return this.args.post?.commentPage || 1;
  }

  get pageCount() {
    return this.args.post?.commentPageCount || 1;
  }

  get pages() {
    const visiblePages = new Set([1, this.pageCount]);
    const firstWindowPage = Math.max(1, this.currentPage - PAGE_WINDOW_RADIUS);
    const lastWindowPage = Math.min(
      this.pageCount,
      this.currentPage + PAGE_WINDOW_RADIUS
    );

    for (let page = firstWindowPage; page <= lastWindowPage; page++) {
      visiblePages.add(page);
    }

    const pages = [...visiblePages].sort((a, b) => a - b);
    const items = [];
    let previousPage = null;

    pages.forEach((number) => {
      if (previousPage !== null && number - previousPage > 1) {
        items.push({
          key: `ellipsis-${previousPage}-${number}`,
          type: "ellipsis",
        });
      }

      items.push({
        key: `page-${number}`,
        type: "page",
        number,
        active: number === this.currentPage,
      });
      previousPage = number;
    });

    return items;
  }

  get hasPreviousPage() {
    return this.currentPage > 1;
  }

  get hasNextPage() {
    return this.currentPage < this.pageCount;
  }

  get showPagingControls() {
    return this.pageCount > 1;
  }

  get expanded() {
    return this.args.post?.commentPaginationExpanded;
  }

  get totalLabel() {
    return i18n("topic.comment.pagination.total", {
      total: this.args.post?.commentCount || 0,
    });
  }

  get collapsedLabel() {
    return i18n("topic.comment.pagination.expand", {
      count: this.hiddenCommentCount,
      total: this.args.post?.commentCount || 0,
    });
  }

  get hiddenCommentCount() {
    return Math.max(
      (this.args.post?.commentCount || 0) -
        (this.args.post?.commentPageEnd || 0),
      0
    );
  }

  get entryId() {
    return this.args.post?.entry
      ? this.args.post.id
      : this.args.post?.entry_post_id;
  }

  @action
  previousPage(event) {
    event?.preventDefault();
    this.setPage(this.currentPage - 1);
  }

  @action
  nextPage(event) {
    event?.preventDefault();
    this.setPage(this.currentPage + 1);
  }

  @action
  goToPage(page, event) {
    event?.preventDefault();
    this.setPage(page);
  }

  @action
  updateJumpPage(event) {
    this.jumpPage = event.target.value;
  }

  @action
  jumpToPage(event) {
    event?.preventDefault();

    const page = Number(this.jumpPage);
    if (!Number.isFinite(page)) {
      return;
    }

    this.setPage(page);
  }

  @action
  expand(event) {
    event?.preventDefault();

    this.setExpanded(true);
  }

  @action
  collapse(event) {
    event?.preventDefault();

    this.setExpanded(false);
  }

  setPage(page) {
    const pageNumber = Number(page);

    if (!this.entryId || !Number.isFinite(pageNumber)) {
      return;
    }

    const targetPage = Math.min(
      Math.max(Math.floor(pageNumber), 1),
      this.pageCount
    );

    this.args.post?.topic?.postStream?.setJournalCommentPage?.(
      this.entryId,
      targetPage
    );
    this.jumpPage = "";
  }

  setExpanded(expanded) {
    if (!this.entryId) {
      return;
    }

    this.args.post?.topic?.postStream?.setJournalCommentPaginationExpanded?.(
      this.entryId,
      expanded
    );
  }

  <template>
    <nav
      class="journal-comment-pagination {{unless this.expanded "is-collapsed"}}"
      aria-label={{i18n "topic.comment.pagination.label"}}
    >
      {{#if this.expanded}}
        <span class="journal-comment-pagination__total">{{this.totalLabel}}</span>

        {{#if this.showPagingControls}}
          <div class="journal-comment-pagination__controls">
            <button
              type="button"
              class="btn btn-small journal-comment-pagination__button"
              disabled={{not this.hasPreviousPage}}
              {{on "click" (fn this.goToPage 1)}}
            >
              {{i18n "topic.comment.pagination.first"}}
            </button>

            <button
              type="button"
              class="btn btn-small journal-comment-pagination__button"
              disabled={{not this.hasPreviousPage}}
              {{on "click" this.previousPage}}
            >
              {{i18n "topic.comment.pagination.previous"}}
            </button>

            {{#each this.pages as |item|}}
              {{#if (eq item.type "ellipsis")}}
                <span class="journal-comment-pagination__ellipsis" aria-hidden="true">
                  ...
                </span>
              {{else}}
                <button
                  type="button"
                  class="btn btn-small journal-comment-pagination__page {{if item.active "is-active"}}"
                  aria-current={{if item.active "page"}}
                  disabled={{item.active}}
                  {{on "click" (fn this.goToPage item.number)}}
                >
                  {{item.number}}
                </button>
              {{/if}}
            {{/each}}

            <button
              type="button"
              class="btn btn-small journal-comment-pagination__button"
              disabled={{not this.hasNextPage}}
              {{on "click" this.nextPage}}
            >
              {{i18n "topic.comment.pagination.next"}}
            </button>

            <button
              type="button"
              class="btn btn-small journal-comment-pagination__button"
              disabled={{not this.hasNextPage}}
              {{on "click" (fn this.goToPage this.pageCount)}}
            >
              {{i18n "topic.comment.pagination.last"}}
            </button>
          </div>

          <form
            class="journal-comment-pagination__jump"
            {{on "submit" this.jumpToPage}}
          >
            <label>
              {{i18n "topic.comment.pagination.jump_label"}}
              <input
                type="number"
                min="1"
                max={{this.pageCount}}
                value={{this.jumpPage}}
                {{on "input" this.updateJumpPage}}
              />
            </label>
            <button type="submit" class="btn btn-small">
              {{i18n "topic.comment.pagination.jump"}}
            </button>
          </form>
        {{/if}}

        <button
          type="button"
          class="btn btn-small journal-comment-pagination__collapse"
          {{on "click" this.collapse}}
        >
          {{i18n "topic.comment.pagination.collapse"}}
        </button>
      {{else}}
        <button
          type="button"
          class="journal-comment-pagination__expand"
          {{on "click" this.expand}}
        >
          {{this.collapsedLabel}}
        </button>
      {{/if}}
    </nav>
  </template>
}
