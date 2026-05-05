import Component from "@glimmer/component";
import { fn } from "@ember/helper";
import { on } from "@ember/modifier";
import { action } from "@ember/object";
import { not } from "discourse/truth-helpers";
import { i18n } from "discourse-i18n";

export default class JournalCommentPagination extends Component {
  static shouldRender(args) {
    return (
      args.post?.journal &&
      args.post?.attachCommentPagination &&
      args.post?.commentPageCount > 1
    );
  }

  get currentPage() {
    return this.args.post?.commentPage || 1;
  }

  get pageCount() {
    return this.args.post?.commentPageCount || 1;
  }

  get pages() {
    return Array.from({ length: this.pageCount }, (_, index) => {
      const number = index + 1;

      return {
        number,
        active: number === this.currentPage,
      };
    });
  }

  get hasPreviousPage() {
    return this.currentPage > 1;
  }

  get hasNextPage() {
    return this.currentPage < this.pageCount;
  }

  get rangeLabel() {
    return i18n("topic.comment.pagination.range", {
      page: this.currentPage,
      pages: this.pageCount,
      start: this.args.post?.commentPageStart || 0,
      end: this.args.post?.commentPageEnd || 0,
      total: this.args.post?.commentCount || 0,
    });
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

  setPage(page) {
    const entryId = this.args.post?.entry
      ? this.args.post.id
      : this.args.post?.entry_post_id;

    if (!entryId) {
      return;
    }

    this.args.post?.topic?.postStream?.setJournalCommentPage?.(entryId, page);
  }

  <template>
    <nav
      class="journal-comment-pagination"
      aria-label={{i18n "topic.comment.pagination.label"}}
    >
      <span class="journal-comment-pagination__range">
        {{this.rangeLabel}}
      </span>

      <div class="journal-comment-pagination__controls">
        <button
          type="button"
          class="btn btn-small journal-comment-pagination__button"
          disabled={{not this.hasPreviousPage}}
          {{on "click" this.previousPage}}
        >
          {{i18n "topic.comment.pagination.previous"}}
        </button>

        {{#each this.pages as |page|}}
          <button
            type="button"
            class="btn btn-small journal-comment-pagination__page {{if page.active "is-active"}}"
            aria-current={{if page.active "page"}}
            disabled={{page.active}}
            {{on "click" (fn this.goToPage page.number)}}
          >
            {{page.number}}
          </button>
        {{/each}}

        <button
          type="button"
          class="btn btn-small journal-comment-pagination__button"
          disabled={{not this.hasNextPage}}
          {{on "click" this.nextPage}}
        >
          {{i18n "topic.comment.pagination.next"}}
        </button>
      </div>
    </nav>
  </template>
}
