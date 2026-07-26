import { action } from "@ember/object";
import { getOwner } from "@ember/owner";

export default {
  createEntry: action(function () {
    const controller = getOwner(this).lookup("controller:topic");
    controller.send("replyToPost");
  }),
};
