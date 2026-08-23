import { withPluginApi } from "discourse/lib/plugin-api";
import JournalCommentButton from "../components/journal-comment-button";
import JournalCommentPagination from "../components/journal-comment-pagination";

function registerPostMenuButtons(api) {
  api.registerValueTransformer(
    "post-menu-buttons",
    ({ value: dag, context: { post, buttonKeys, lastHiddenButtonKey } }) => {
      if (!post?.topic?.details?.can_create_post || !post.journal) {
        return;
      }

      if (post.post_number === 1) {
        dag.add("reply", null, { after: lastHiddenButtonKey });
      } else {
        dag.add("comment", JournalCommentButton, {
          after: lastHiddenButtonKey,
        });
        dag.delete(buttonKeys.REPLY);
      }

      dag.delete(buttonKeys.REPLIES);
    }
  );
}

function registerTrackedPostProperties(api) {
  api.addTrackedPostProperties(
    "journal",
    "reply_to_post_number",
    "comment",
    "showComment",
    "entry",
    "entry_post_id",
    "entry_post_ids",
    "attachCommentPagination",
    "commentPage",
    "commentPageCount",
    "commentPageStart",
    "commentPageEnd",
    "commentCount",
    "commentPaginationExpanded"
  );
}

function registerPostClasses(api) {
  api.addPostClassesCallback((attrs) => {
    if (attrs.journal && !attrs.firstPost) {
      if (attrs.comment) {
        const classes = ["comment"];
        if (attrs.showComment) {
          classes.push("show");
        }
        return classes;
      }

      return ["entry"];
    }
  });
}

function registerGlimmerAvatarTransformer(api) {
  api.registerValueTransformer(
    "post-avatar-size",
    ({ value, context: { post } }) => {
      if (!post?.journal) {
        return value;
      }

      return post.comment ? "small" : "large";
    }
  );
}

function registerGlimmerMetaDataTransformer(api) {
  api.registerValueTransformer(
    "post-meta-data-infos",
    ({ value: metadata, context: { post, metaDataInfoKeys } }) => {
      if (!post?.journal) {
        return;
      }

      if (post.entry) {
        metadata.delete(metaDataInfoKeys.REPLY_TO_TAB);
      } else if (post.comment) {
        const postStream = post.topic?.postStream;
        if (postStream && post.entry_post_id) {
          const entry = postStream.findLoadedPost(post.entry_post_id);
          if (entry && post.reply_to_post_number === entry.post_number) {
            metadata.delete(metaDataInfoKeys.REPLY_TO_TAB);
          }
        }
      }
    }
  );
}

function registerCommentPaginationOutlet(api) {
  api.renderAfterWrapperOutlet("post-links", JournalCommentPagination);
}

function setupGlimmerPostStream(api) {
  registerGlimmerAvatarTransformer(api);
  registerGlimmerMetaDataTransformer(api);
  registerCommentPaginationOutlet(api);
}

export default {
  name: "journal-post",
  initialize(container) {
    const siteSettings = container.lookup("service:site-settings");

    if (!siteSettings.journal_enabled) {
      return;
    }

    withPluginApi((api) => {
      registerPostMenuButtons(api);
      registerTrackedPostProperties(api);
      registerPostClasses(api);
      setupGlimmerPostStream(api);
    });
  },
};
