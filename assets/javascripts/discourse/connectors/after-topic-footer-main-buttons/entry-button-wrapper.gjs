import Component from "@glimmer/component";
import { action } from "@ember/object";
import { getOwner } from "@ember/owner";
import { and } from "discourse/truth-helpers";
import DButton from "discourse/ui-kit/d-button";

export default class EntryButtonWrapper extends Component {
  @action
  createEntry() {
    getOwner(this).lookup("controller:topic").replyToPost();
  }

  <template>
    {{#if (and @outletArgs.topic.journal @outletArgs.topic.can_create_entry)}}
      <DButton
        class="btn-primary create entry"
        @icon="reply"
        @action={{this.createEntry}}
        @label="topic.entry.title"
        @title="topic.entry.title"
      />
    {{/if}}
  </template>
}
