import { click, visit } from "@ember/test-helpers";
import { test } from "qunit";
import pretender from "discourse/tests/helpers/create-pretender";
import formKit from "discourse/tests/helpers/form-kit-helper";
import { acceptance } from "discourse/tests/helpers/qunit-helpers";

function latestCategorySavePayload() {
  const request = pretender.handledRequests.findLast(
    ({ method, requestBody }) => method === "PUT" && requestBody
  );

  return JSON.parse(request.requestBody);
}

acceptance("Journal category settings", function (needs) {
  needs.user();
  needs.settings({ journal_enabled: true });

  test(
    "saving category journal activation persists its custom field",
    async function (assert) {
      await visit("/c/bug/edit/settings");
      await formKit().field("custom_fields.journal").toggle();

      await click(".admin-changes-banner .btn-primary");

      const payload = latestCategorySavePayload();
      assert.true(payload.custom_fields.journal);
    }
  );
});
