import { withPluginApi } from "discourse/lib/plugin-api";
import {
  afterPostMutation,
  applyJournalCommentState,
  findStoredPost,
  moveStoredPost,
} from "../lib/journal-post-stream";

export function registerPostStreamExtensions(api, siteSettings) {
  const PostStream = api.container.factoryFor("model:post-stream").class;
  const coreMethods = {
    appendPost: PostStream.prototype.appendPost,
    commitPost: PostStream.prototype.commitPost,
    prependPost: PostStream.prototype.prependPost,
    stagePost: PostStream.prototype.stagePost,
    updateFromJson: PostStream.prototype.updateFromJson,
  };

  api.addModelField("post-stream", "_journalShownEntryIds", { type: "set" });

  api.addModelGetter("post-stream", "journal", function () {
    return this.topic?.journal;
  });

  api.addModelMethod(
    "post-stream",
    "showAllJournalCommentsForEntry",
    function (entryPostId) {
      if (!this.journal || !entryPostId) {
        return;
      }

      if (!this._journalShownEntryIds.has(entryPostId)) {
        this._journalShownEntryIds.add(entryPostId);
        applyJournalCommentState(this, siteSettings);
      }
    }
  );

  api.addModelMethod("post-stream", "stagePost", function (post, ...args) {
    const result = coreMethods.stagePost.call(this, post, ...args);
    afterPostMutation(this, post, siteSettings);
    return result;
  });

  api.addModelMethod("post-stream", "commitPost", function (post, ...args) {
    const result = coreMethods.commitPost.call(this, post, ...args);
    afterPostMutation(this, post, siteSettings);
    return result;
  });

  api.addModelMethod("post-stream", "prependPost", function (post, ...args) {
    const result = coreMethods.prependPost.call(this, post, ...args);
    if (!this.journal) {
      return result;
    }

    if (
      post?.post_number === 2 &&
      this.posts[0]?.post_number === 1 &&
      this.posts.length > 1
    ) {
      const stored = findStoredPost(this, post);
      if (stored) {
        moveStoredPost(this, stored, 1);
      }
    }

    applyJournalCommentState(this, siteSettings);
    return result;
  });

  api.addModelMethod("post-stream", "appendPost", function (post, ...args) {
    const result = coreMethods.appendPost.call(this, post, ...args);
    afterPostMutation(this, post, siteSettings);
    return result;
  });

  api.addModelMethod("post-stream", "updateFromJson", function (...args) {
    const result = coreMethods.updateFromJson.apply(this, args);
    applyJournalCommentState(this, siteSettings);
    return result;
  });
}

export default {
  name: "journal-post-stream-model",
  before: "inject-discourse-objects",

  initialize(container) {
    const siteSettings = container.lookup("service:site-settings");

    if (!siteSettings.journal_enabled) {
      return;
    }

    withPluginApi((api) => registerPostStreamExtensions(api, siteSettings));
  },
};
