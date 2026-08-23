import Component from "@glimmer/component";
import { tracked } from "@glimmer/tracking";
import { Input } from "@ember/component";
import { action } from "@ember/object";
import { ajax } from "discourse/lib/ajax";
import DButton from "discourse/ui-kit/d-button";
import DConditionalLoadingSpinner from "discourse/ui-kit/d-conditional-loading-spinner";
import dIcon from "discourse/ui-kit/helpers/d-icon";
import { i18n } from "discourse-i18n";
import JournalGroupChooser from "../../components/journal-group-chooser";

export default class EnableJournal extends Component {
  @tracked updatingSortOrder = false;
  @tracked syncResultIcon;

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
    <section>
      <h3>{{i18n "category.journal_settings_label"}}</h3>

      <section class="field">
        <label>
          <Input
            id="enable-journal-for-category"
            @type="checkbox"
            @checked={{@outletArgs.category.custom_fields.journal}}
          />
          {{i18n "category.enable_journal"}}
        </label>
      </section>

      <section class="field">
        <label for="category-journal-authors">
          {{i18n "category.journal_authors"}}
        </label>
        <JournalGroupChooser @category={{@outletArgs.category}} />
      </section>

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
    </section>
  </template>
}
