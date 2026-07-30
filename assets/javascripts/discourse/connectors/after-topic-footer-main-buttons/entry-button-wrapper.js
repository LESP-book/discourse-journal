import { getOwner } from "@ember/owner";

export default {
  actions: {
    createEntry() {
      const controller = getOwner(this).lookup("controller:topic");
      controller.send("replyToPost");
    },
  },
};
