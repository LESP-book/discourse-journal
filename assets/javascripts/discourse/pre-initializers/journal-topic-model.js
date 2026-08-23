import { withPluginApi } from "discourse/lib/plugin-api";

export default {
  name: "journal-topic-model",
  before: "inject-discourse-objects",

  initialize(container) {
    const siteSettings = container.lookup("service:site-settings");

    if (!siteSettings.journal_enabled) {
      return;
    }

    withPluginApi((api) => {
      api.addModelGetter("topic", "showJournalTip", function () {
        return this.journal && siteSettings.journal_show_topic_tip;
      });

      api.addModelGetter("topic", "lastPostUrl", function () {
        return this.urlForPostNumber(
          this.last_entry_post_number || this.highest_post_number
        );
      });
    });
  },
};
