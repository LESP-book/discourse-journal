import { computed } from "@ember/object";
import { withPluginApi } from "discourse/lib/plugin-api";
import { CREATE_TOPIC, EDIT, REPLY } from "discourse/models/composer";
import { i18n } from "discourse-i18n";

const PLUGIN_ID = "discourse-journal";

function getJournalComposerKey(action, composerModel) {
  const post = composerModel.post;

  if (action === CREATE_TOPIC) {
    return "create_journal";
  } else if (action === REPLY && post) {
    return post.comment ? "reply_to_comment" : "create_comment";
  } else if (action === EDIT && post) {
    return post.comment ? "edit_comment" : "edit_entry";
  } else {
    return "create_entry";
  }
}

function getJournalComposerText(type) {
  let icon = "reply";

  if (type === "create_comment") {
    icon = "comment";
  } else if (type === "create_journal") {
    icon = "plus";
  } else if (["edit_entry", "edit_comment"].includes(type)) {
    icon = "pencil-alt";
  }

  return {
    icon,
    name: `composer.composer_actions.${type}.name`,
    description: `composer.composer_actions.${type}.description`,
  };
}

export default {
  name: "journal-composer",
  initialize(container) {
    const siteSettings = container.lookup("service:site-settings");
    if (!siteSettings.journal_enabled) {
      return;
    }

    withPluginApi((api) => {
      api.modifyClass(
        "service:composer",
        (Superclass) =>
          class JournalComposerService extends Superclass {
            static pluginId = PLUGIN_ID;

            open(opts) {
              if (
                opts.topic?.journal &&
                opts.quote &&
                !opts.post &&
                opts.topic.postStream.posts[0].post_number !== 1
              ) {
                opts.post = opts.topic.postStream.posts[0];
              }
              return super.open(opts);
            }

            @computed("model.category")
            get isJournal() {
              return Boolean(this.model.category?.journal);
            }

            @computed("model.action", "model.post")
            get journalComposerText() {
              const key = getJournalComposerKey(this.model.action, this.model);
              return getJournalComposerText(key);
            }

            @computed(
              "model.action",
              "isWhispering",
              "model.editConflict",
              "isJournal",
              "journalComposerText.name"
            )
            get saveLabel() {
              return this.isJournal
                ? this.journalComposerText.name
                : super.saveLabel;
            }

            @computed(
              "model.action",
              "isWhispering",
              "isJournal",
              "journalComposerText.icon"
            )
            get saveIcon() {
              return this.isJournal
                ? this.journalComposerText.icon
                : super.saveIcon;
            }
          }
      );

      api.modifyClass(
        "component:composer-action-title",
        (Superclass) =>
          class JournalComposerActionTitle extends Superclass {
            static pluginId = PLUGIN_ID;

            @computed("options", "action", "model.category")
            get actionTitle() {
              const key = getJournalComposerKey(this.action, this.model);
              const text = getJournalComposerText(key);

              return this.model.category?.journal && text
                ? i18n(text.name)
                : super.actionTitle;
            }
          }
      );

      api.modifyClass(
        "component:composer-actions",
        (Superclass) =>
          class JournalComposerActions extends Superclass {
            static pluginId = PLUGIN_ID;

            didReceiveAttrs() {
              const composer = this.composerModel;
              if (composer) {
                this.postSnapshot = composer.post;
              }
              super.didReceiveAttrs(...arguments);
            }

            @computed("postSnapshot.journal")
            get commenting() {
              return Boolean(this.postSnapshot?.journal);
            }

            @computed("commenting")
            get commentKey() {
              return getJournalComposerKey(this.action, this.composerModel);
            }

            @computed("action", "commenting")
            get iconForComposerAction() {
              return this.commenting
                ? getJournalComposerText(this.commentKey).icon
                : super.iconForComposerAction;
            }

            @computed("seq", "commenting")
            get content() {
              if (!this.commenting) {
                return super.content;
              }

              const text = getJournalComposerText(this.commentKey);
              return [
                {
                  id: "reply_to_post",
                  icon: text.icon,
                  name: i18n(text.name),
                  description: i18n(text.description),
                },
              ];
            }
          }
      );
    });
  },
};
