import { action, computed } from "@ember/object";
import { getOwner } from "@ember/owner";
import { scheduleOnce } from "@ember/runloop";
import { withPluginApi } from "discourse/lib/plugin-api";

const PLUGIN_ID = "discourse-journal";

export default {
  name: "journal-topic",
  initialize(container) {
    const siteSettings = container.lookup("service:site-settings");
    if (!siteSettings.journal_enabled) {
      return;
    }

    withPluginApi((api) => {
      api.modifyClass(
        "route:topic",
        (Superclass) =>
          class JournalTopicRoute extends Superclass {
            static pluginId = PLUGIN_ID;

            isJournal() {
              return this.controllerFor("topic").model.journal;
            }

            @action
            didTransition() {
              if (this.isJournal()) {
                getOwner(this)
                  .lookup("service:keyboard-shortcuts")
                  .pause(["c"]);
                document.body.classList.add("topic-journal");
              }
              return super.didTransition(...arguments);
            }

            @action
            willTransition() {
              if (this.isJournal()) {
                getOwner(this)
                  .lookup("service:keyboard-shortcuts")
                  .unpause(["c"]);
                document.body.classList.remove("topic-journal");
              }
              return super.willTransition(...arguments);
            }
          }
      );

      api.modifyClass(
        "component:topic-footer-buttons",
        (Superclass) =>
          class JournalTopicFooterButtons extends Superclass {
            static pluginId = PLUGIN_ID;

            didInsertElement() {
              super.didInsertElement(...arguments);

              if (this.topic?.journal) {
                scheduleOnce("afterRender", this, this.hideCreateButton);
              }
            }

            hideCreateButton() {
              const button = this.element?.querySelector(
                ".topic-footer-main-buttons > button.create"
              );
              if (button) {
                button.style.display = "none";
              }
            }
          }
      );

      api.modifyClass(
        "component:topic-progress",
        (Superclass) =>
          class JournalTopicProgress extends Superclass {
            static pluginId = PLUGIN_ID;

            @computed(
              "progressPosition",
              "topic.last_read_post_id",
              "topic.journal"
            )
            get showBackButton() {
              return this.topic?.journal ? false : super.showBackButton;
            }
          }
      );
    });
  },
};
