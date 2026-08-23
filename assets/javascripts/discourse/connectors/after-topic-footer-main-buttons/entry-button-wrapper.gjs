import Component from "@glimmer/component";
import { action } from "@ember/object";
import { getOwner } from "@ember/owner";
import DButton from "discourse/ui-kit/d-button";

export default class EntryButtonWrapper extends Component {
  @action
  createEntry() {
    const controller = getOwner(this).lookup("controller:topic");
    controller.send("replyToPost");
  }

  <template>
    {{#if @outletArgs.topic.can_create_entry}}
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
