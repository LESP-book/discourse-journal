import { withPluginApi } from "discourse/lib/plugin-api";
import {
  applyJournalCommentState,
  setJournalCommentPage,
  setJournalCommentPaginationExpanded,
  showJournalCommentPageForPost,
} from "../lib/journal-comment-pagination";
import {
  afterPostMutation,
  findStoredPost,
  getCommentIndex,
  insertCommentInStream,
  moveStoredPost,
} from "../lib/journal-post-stream";

const updateFromJsonDepth = new WeakMap();

function isUpdatingFromJson(postStream) {
  return (updateFromJsonDepth.get(postStream) || 0) > 0;
}

function runDuringUpdateFromJson(postStream, callback) {
  const previousDepth = updateFromJsonDepth.get(postStream) || 0;
  updateFromJsonDepth.set(postStream, previousDepth + 1);

  try {
    return callback();
  } finally {
    if (previousDepth === 0) {
      updateFromJsonDepth.delete(postStream);
    } else {
      updateFromJsonDepth.set(postStream, previousDepth);
    }
  }
}

export function registerPostStreamExtensions(api, siteSettings) {
  const PostStream = api.container.factoryFor("model:post-stream").class;
  const coreMethods = {
    appendPost: PostStream.prototype.appendPost,
    commitPost: PostStream.prototype.commitPost,
    prependPost: PostStream.prototype.prependPost,
    stagePost: PostStream.prototype.stagePost,
    updateFromJson: PostStream.prototype.updateFromJson,
  };

  api.addModelField("post-stream", "_journalCommentPages", {
    type: "object",
  });
  api.addModelField("post-stream", "_journalExpandedCommentPaginators", {
    type: "set",
  });

  api.addModelGetter("post-stream", "journal", function () {
    return this.topic?.journal;
  });

  api.addModelMethod(
    "post-stream",
    "setJournalCommentPage",
    function (entryPostId, page) {
      setJournalCommentPage(this, entryPostId, page, siteSettings);
    }
  );

  api.addModelMethod(
    "post-stream",
    "setJournalCommentPaginationExpanded",
    function (entryPostId, expanded) {
      setJournalCommentPaginationExpanded(
        this,
        entryPostId,
        expanded,
        siteSettings
      );
    }
  );

  api.addModelMethod("post-stream", "stagePost", function (post, ...args) {
    const result = coreMethods.stagePost.call(this, post, ...args);
    if (!isUpdatingFromJson(this)) {
      afterPostMutation(this, post, siteSettings);
    }
    return result;
  });

  api.addModelMethod("post-stream", "commitPost", function (post, ...args) {
    const result = coreMethods.commitPost.call(this, post, ...args);

    if (!this.journal || isUpdatingFromJson(this)) {
      return result;
    }

    const loadedCommittedPost = ensureCommittedJournalPostLoaded(
      this,
      post,
      coreMethods.appendPost
    );

    if (post?.reply_to_post_number) {
      showJournalCommentPageForPost(this, post, siteSettings);
      afterPostMutation(this, post, siteSettings);
    } else if (loadedCommittedPost) {
      afterPostMutation(this, post, siteSettings);
    } else {
      applyJournalCommentState(this, siteSettings);
    }

    return result;
  });

  api.addModelMethod("post-stream", "prependPost", function (post, ...args) {
    const result = coreMethods.prependPost.call(this, post, ...args);
    if (!this.journal || isUpdatingFromJson(this)) {
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

    afterPostMutation(this, post, siteSettings);
    return result;
  });

  api.addModelMethod("post-stream", "appendPost", function (post, ...args) {
    const result = coreMethods.appendPost.call(this, post, ...args);
    if (!isUpdatingFromJson(this)) {
      afterPostMutation(this, post, siteSettings);
    }
    return result;
  });

  api.addModelMethod("post-stream", "updateFromJson", function (...args) {
    const wasAlreadyUpdating = isUpdatingFromJson(this);
    const result = runDuringUpdateFromJson(this, () =>
      coreMethods.updateFromJson.apply(this, args)
    );

    if (!wasAlreadyUpdating) {
      afterPostMutation(this, null, siteSettings);
    }

    return result;
  });
}

function ensureCommittedJournalPostLoaded(postStream, post, appendPost) {
  if (!post?.id || post.id === -1 || !postStream.posts || !postStream.stream) {
    return false;
  }

  const postTopicId = post.topic_id ?? post.topic?.id;
  if (
    postStream.topic?.id &&
    postTopicId &&
    postStream.topic.id !== postTopicId
  ) {
    return false;
  }

  if (post.reply_to_post_number && getCommentIndex(postStream, post) === null) {
    return false;
  }

  const stored = findStoredPost(postStream, post);
  const alreadyLoaded = stored && postStream.posts.includes(stored);
  let changed = false;

  if (!alreadyLoaded) {
    appendPost.call(postStream, post);
    changed = true;
  }

  if (post.reply_to_post_number) {
    const previousIndex = postStream.stream.indexOf(post.id);
    const previousLength = postStream.stream.length;
    insertCommentInStream(postStream, post, { insertMissing: true });

    changed =
      changed ||
      previousIndex !== postStream.stream.indexOf(post.id) ||
      previousLength !== postStream.stream.length;
  } else if (!postStream.stream.includes(post.id)) {
    postStream.stream.push(post.id);
    changed = true;
  }

  return changed;
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
