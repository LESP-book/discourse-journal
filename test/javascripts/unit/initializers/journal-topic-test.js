import { set } from "@ember/object";
import { module, test } from "qunit";
import journalTopicInitializer, {
  createJournalTopicFooterButtons,
} from "discourse/plugins/discourse-journal/discourse/initializers/journal-topic";

class CoreTopicFooterButtons {
  get showCreateButton() {
    return this.showCreate !== false && this.topic?.details?.can_create_post;
  }
}

function buildFooter() {
  const FooterButtons = createJournalTopicFooterButtons(CoreTopicFooterButtons);
  const footer = new FooterButtons();
  set(footer, "showCreate", true);
  return footer;
}

module("Unit | Initializer | journal topic", function () {
  test("hides only journal topics when reusing the footer instance", function (assert) {
    const footer = buildFooter();

    set(footer, "topic", {
      journal: true,
      details: { can_create_post: true },
    });
    assert.false(footer.showCreateButton);

    set(footer, "topic", {
      journal: false,
      details: { can_create_post: true },
    });
    assert.true(footer.showCreateButton);

    set(footer, "topic", {
      journal: true,
      details: { can_create_post: true },
    });
    assert.false(footer.showCreateButton);
  });

  test("delegates current permission and core visibility state for normal topics", function (assert) {
    const footer = buildFooter();
    const topic = {
      journal: false,
      details: { can_create_post: true },
    };
    set(footer, "topic", topic);

    assert.true(footer.showCreateButton);

    set(topic.details, "can_create_post", false);
    assert.false(footer.showCreateButton);

    set(topic.details, "can_create_post", true);
    set(footer, "showCreate", false);
    assert.false(footer.showCreateButton);
  });

  test("does not register when the plugin is disabled", function (assert) {
    const container = {
      lookup(serviceName) {
        assert.strictEqual(serviceName, "service:site-settings");
        return { journal_enabled: false };
      },
    };

    assert.strictEqual(
      journalTopicInitializer.initialize(container),
      undefined
    );
  });
});
