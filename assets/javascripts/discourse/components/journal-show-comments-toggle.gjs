import Component from "@glimmer/component";
import { on } from "@ember/modifier";
import { action } from "@ember/object";
import { service } from "@ember/service";
import { i18n } from "discourse-i18n";

export default class JournalShowCommentsToggle extends Component {
  static shouldRender(args) {
    return (
      args.post?.journal &&
      args.post?.attachCommentToggle &&
      args.post?.hiddenComments > 0
    );
  }

  @service siteSettings;

  get labelKey() {
    return Number(this.siteSettings.journal_comments_default) > 0
      ? "more"
      : "all";
  }

  get label() {
    return i18n(`topic.comment.show_comments.${this.labelKey}`, {
      count: this.args.post?.hiddenComments || 0,
    });
  }

  @action
  showComments(event) {
    event?.preventDefault();

    const entryId = this.args.post?.entry
      ? this.args.post.id
      : this.args.post?.entry_post_id;

    if (!entryId) {
      return;
    }

    this.args.post?.topic?.postStream?.showAllJournalCommentsForEntry?.(
      entryId
    );
  }

  <template>
    <a
      href
      class="show-comments"
      role="button"
      {{on "click" this.showComments}}
    >
      {{this.label}}
    </a>
  </template>
}
