import { action, computed } from "@ember/object";
import { scheduleOnce } from "@ember/runloop";
import { withPluginApi } from "discourse/lib/plugin-api";

const PLUGIN_ID = "discourse-journal";

export default {
  name: "journal-discovery",
  initialize(container) {
    const siteSettings = container.lookup("service:site-settings");
    if (!siteSettings.journal_enabled) {
      return;
    }

    withPluginApi((api) => {
      api.modifyClass(
        "component:d-navigation",
        (Superclass) =>
          class JournalNavigation extends Superclass {
            static pluginId = PLUGIN_ID;

            @computed("hasDraft", "category.journal")
            get createTopicLabel() {
              return this.category?.journal
                ? "topic.create_journal.label"
                : super.createTopicLabel;
            }
          }
      );

      api.modifyClass(
        "route:discovery",
        (Superclass) =>
          class JournalDiscoveryRoute extends Superclass {
            static pluginId = PLUGIN_ID;

            discoveryCategory() {
              return this.router.currentRouteName === "discovery.category"
                ? this.router.currentRoute?.attributes?.category
                : null;
            }

            updateBodyClass() {
              document.body.classList.toggle(
                "journal-category",
                Boolean(this.discoveryCategory()?.journal)
              );
            }

            @action
            didTransition() {
              scheduleOnce("afterRender", this, this.updateBodyClass);
              return super.didTransition?.(...arguments);
            }

            @action
            willTransition() {
              document.body.classList.remove("journal-category");
              return super.willTransition?.(...arguments);
            }
          }
      );
    });
  },
};
