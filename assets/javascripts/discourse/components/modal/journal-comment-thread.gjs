import Component from "@glimmer/component";
import { on } from "@ember/modifier";
import { trustHTML } from "@ember/template";
import DModal from "discourse/components/d-modal";
import { i18n } from "discourse-i18n";

export default class JournalCommentThread extends Component {
  get entry() {
    return this.args.model?.entry;
  }

  get comments() {
    return this.args.model?.comments || [];
  }

  get posts() {
    return [this.entry, ...this.comments].filter(Boolean);
  }

  get title() {
    return i18n("topic.comment.thread.title", {
      count: this.args.model?.total || this.comments.length,
    });
  }

  <template>
    <DModal
      class="journal-comment-thread-modal"
      @title={{this.title}}
      @closeModal={{@closeModal}}
    >
      <:body>
        <div class="journal-comment-thread">
          {{#each this.posts as |post|}}
            <article class="journal-comment-thread__post {{if post.entry "is-entry" "is-comment"}}">
              <header class="journal-comment-thread__post-header">
                <span class="journal-comment-thread__username">
                  {{post.username}}
                </span>
                <span class="journal-comment-thread__post-number">
                  #{{post.post_number}}
                </span>
              </header>

              <div class="journal-comment-thread__cooked">
                {{trustHTML post.cooked}}
              </div>
            </article>
          {{/each}}
        </div>
      </:body>

      <:footer>
        <button type="button" class="btn" {{on "click" @closeModal}}>
          {{i18n "topic.comment.thread.close"}}
        </button>
      </:footer>
    </DModal>
  </template>
}
