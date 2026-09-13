import Component from "@glimmer/component";
import { tracked } from "@glimmer/tracking";
import { action } from "@ember/object";
import { service } from "@ember/service";
import { ajax } from "discourse/lib/ajax";
import GroupChooser from "discourse/select-kit/components/group-chooser";
import DButton from "discourse/ui-kit/d-button";
import DConditionalLoadingSpinner from "discourse/ui-kit/d-conditional-loading-spinner";
import dIcon from "discourse/ui-kit/helpers/d-icon";
import { i18n } from "discourse-i18n";

export default class EnableJournal extends Component {
  @service site;

  @tracked updatingSortOrder = false;
  @tracked syncResultIcon;

  get journalAuthorGroups() {
    return (
      this.args.outletArgs.transientData?.custom_fields
        ?.journal_author_groups || ""
    )
      .split("|")
      .filter(Boolean);
  }

  @action
  async updateJournalAuthorGroups(authorGroups, { set, name }) {
    await set(name, authorGroups.join("|"));
  }

  @action
  async updateSortOrder() {
    this.updatingSortOrder = true;

    try {
      const result = await ajax("/journal/update-sort-order", {
        type: "POST",
        data: {
          category_id: this.args.outletArgs.category.id,
        },
      });

      this.syncResultIcon = result.success ? "check" : "times";
    } catch {
      this.syncResultIcon = "times";
    } finally {
      this.updatingSortOrder = false;
      setTimeout(() => {
        this.syncResultIcon = null;
      }, 6000);
    }
  }

  <template>
    <@outletArgs.form.Section
      @title={{i18n "category.journal_settings_label"}}
      class="category-custom-settings-outlet journal-category-settings"
    >
      <@outletArgs.form.Object @name="custom_fields" as |customFields|>
        <customFields.Field
          @name="journal"
          @title={{i18n "category.enable_journal"}}
          @type="checkbox"
          @format="full"
          as |field|
        >
          <field.Control />
        </customFields.Field>

        <customFields.Field
          @name="journal_author_groups"
          @title={{i18n "category.journal_authors"}}
          @onSet={{this.updateJournalAuthorGroups}}
          @type="custom"
          @format="full"
          as |field|
        >
          <field.Control>
            <GroupChooser
              @content={{this.site.groups}}
              @valueProperty="name"
              @labelProperty="name"
              @value={{this.journalAuthorGroups}}
              @onChange={{field.set}}
            />
          </field.Control>
        </customFields.Field>
      </@outletArgs.form.Object>

      <section class="field">
        <h4 id="category-journal-update-sort-order">
          {{i18n "category.update_sort_order.label"}}
        </h4>

        <p>{{i18n "category.update_sort_order.description"}}</p>

        <DButton
          @label="category.update_sort_order.button"
          @action={{this.updateSortOrder}}
          @icon="arrows-rotate"
        />

        {{#if this.syncResultIcon}}
          {{dIcon this.syncResultIcon}}
        {{else}}
          <DConditionalLoadingSpinner
            @condition={{this.updatingSortOrder}}
            @size="small"
          />
        {{/if}}
      </section>
    </@outletArgs.form.Section>
  </template>
}
