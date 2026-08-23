import { action, computed } from "@ember/object";
import GroupChooser from "discourse/select-kit/components/group-chooser";

export default class JournalGroupChooser extends GroupChooser {
  valueProperty = "name";
  labelProperty = "name";

  didReceiveAttrs() {
    super.didReceiveAttrs(...arguments);

    const category = this.category;
    if (category.custom_fields?.journal_author_groups) {
      this.set(
        "value",
        category.custom_fields.journal_author_groups
          .split("|")
          .filter((groupName) => groupName.length !== 0)
      );
    }
  }

  @computed("site.groups")
  get content() {
    return this.site.groups;
  }

  @action
  onChange(authorGroups) {
    const category = this.category;
    const customFields = category.custom_fields || {};
    customFields.journal_author_groups = authorGroups.join("|");
    this.setProperties({
      value: authorGroups,
      "category.custom_fields": customFields,
    });
  }
}
