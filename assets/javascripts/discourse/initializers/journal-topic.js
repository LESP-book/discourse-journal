import { computed } from "@ember/object";
import { withPluginApi } from "discourse/lib/plugin-api";

const PLUGIN_ID = "discourse-journal";

export default {
  name: "journal-topic",
  initialize(container) {
    const siteSettings = container.lookup("service:site-settings");
    const keyboardShortcuts = container.lookup("service:keyboard-shortcuts");
    if (!siteSettings.journal_enabled) {
      return;
    }

    withPluginApi((api) => {
      api.modifyClass("route:topic", {
        pluginId: PLUGIN_ID,

        isJournal() {
          const controller = this.controllerFor("topic");
          const topic = controller.get("model");
          return topic.journal;
        },

        actions: {
          didTransition() {
            if (this.isJournal()) {
              keyboardShortcuts.pause(["c"]);
              document.body?.classList.add("topic-journal");
            }
            return this._super(...arguments);
          },

          willTransition() {
            if (this.isJournal()) {
              keyboardShortcuts.unpause(["c"]);
              document.body?.classList.remove("topic-journal");
            }
            return this._super(...arguments);
          },
        },
      });

      api.modifyClass("model:topic", {
        pluginId: PLUGIN_ID,

        showJournalTip: computed("journal", function () {
          return this.journal && siteSettings.journal_show_topic_tip;
        }),

        lastPostUrl: computed(
          "highest_post_number",
          "url",
          "last_entry_post_number",
          function () {
            return this.last_entry_post_number
              ? this.urlForPostNumber(this.last_entry_post_number)
              : this.urlForPostNumber(this.highest_post_number);
          }
        ),
      });

    });
  },
};
