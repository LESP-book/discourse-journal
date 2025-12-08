import { scheduleOnce } from "@ember/runloop";
import discourseComputed from "discourse/lib/decorators";
import KeyboardShortcuts from "discourse/lib/keyboard-shortcuts";
import { withPluginApi } from "discourse/lib/plugin-api";

const PLUGIN_ID = "discourse-journal";

export default {
  name: "journal-topic",
  initialize(container) {
    const siteSettings = container.lookup("service:site-settings");
    if (!siteSettings.journal_enabled) {
      return;
    }

    withPluginApi("0.8.12", (api) => {
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
              KeyboardShortcuts.pause(["c"]);
              $("body").addClass("topic-journal");
            }
            return this._super(...arguments);
          },

          willTransition() {
            if (this.isJournal()) {
              KeyboardShortcuts.unpause(["c"]);
              $("body").removeClass("topic-journal");
            }
            return this._super(...arguments);
          },
        },
      });

      api.modifyClass("model:topic", {
        pluginId: PLUGIN_ID,

        @discourseComputed("journal")
        showJournalTip(journalEnabled) {
          return journalEnabled && siteSettings.journal_show_topic_tip;
        },

        @discourseComputed(
          "highest_post_number",
          "url",
          "last_entry_post_number"
        )
        lastPostUrl(highestPostNumber, url, lastEntryPostNumber) {
          return lastEntryPostNumber
            ? this.urlForPostNumber(lastEntryPostNumber)
            : this.urlForPostNumber(highestPostNumber);
        },
      });

      api.modifyClass("component:topic-footer-buttons", {
        pluginId: PLUGIN_ID,

        didInsertElement() {
          this._super(...arguments);

          const journalEnabled = this.get("topic.journal");
          if (journalEnabled) {
            scheduleOnce("afterRender", () => {
              $(
                ".topic-footer-main-buttons > button.create",
                this.element
              ).hide();
            });
          }
        },
      });


    });
  },
};
