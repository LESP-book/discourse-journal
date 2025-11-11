import { withSilencedDeprecations } from "discourse/lib/deprecated";
import { withPluginApi } from "discourse/lib/plugin-api";
import { i18n } from "discourse-i18n";
import JournalCommentButton from "../components/journal-comment-button";
import JournalShowCommentsToggle from "../components/journal-show-comments-toggle";

const PLUGIN_ID = "discourse-journal";

let CachedPostsWithPlaceholders;

function getPostsWithPlaceholders() {
  if (CachedPostsWithPlaceholders !== undefined) {
    return CachedPostsWithPlaceholders;
  }

  if (
    typeof requirejs !== "undefined" &&
    requirejs.entries?.["discourse/lib/posts-with-placeholders"]
  ) {
    CachedPostsWithPlaceholders = requirejs(
      "discourse/lib/posts-with-placeholders"
    ).default;
  } else {
    CachedPostsWithPlaceholders = null;
  }

  return CachedPostsWithPlaceholders;
}

function registerPostMenuButtons(api) {
  api.registerValueTransformer(
    "post-menu-buttons",
    ({
      value: dag,
      context: { post, buttonKeys, lastHiddenButtonKey },
    }) => {
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

      if (post.comment) {
        dag.delete(buttonKeys.REPLIES);
      }
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
    "attachCommentToggle",
    "hiddenComments"
  );
}

function registerPostClasses(api) {
  api.addPostClassesCallback((attrs) => {
    if (attrs.journal && !attrs.firstPost) {
      if (attrs.comment) {
        let classes = ["comment"];
        if (attrs.showComment) {
          classes.push("show");
        }
        return classes;
      } else {
        return ["entry"];
      }
    }
  });
}

function extendPostStreamModel(api, siteSettings, shouldUseGlimmerPostStream) {
  api.modifyClass(
    "model:post-stream",
    (Superclass) =>
      class JournalPostStream extends Superclass {
        static pluginId = PLUGIN_ID;

        get journal() {
          return this.topic?.journal;
        }

        getCommentIndex(post) {
          const posts = this.posts || [];
          let passed = false;
          let commentIndex = null;

          posts.some((p, i) => {
            if (passed && !p.reply_to_post_number) {
              commentIndex = i;
              return true;
            }

            if (
              p.post_number === post.reply_to_post_number &&
              i < posts.length - 1
            ) {
              passed = true;
            }

            return false;
          });

          return commentIndex;
        }

        insertCommentInStream(post) {
          const stream = this.stream;
          const postId = post.id;
          const commentIndex = this.getCommentIndex(post) - 1;

          if (
            stream.indexOf(postId) > -1 &&
            commentIndex &&
            commentIndex > 0
          ) {
            if (typeof stream.removeObject === "function") {
              stream.removeObject(postId);
              stream.insertAt(commentIndex, postId);
            } else {
              const currentIndex = stream.indexOf(postId);
              if (currentIndex > -1) {
                stream.splice(currentIndex, 1);
              }
              stream.splice(commentIndex, 0, postId);
            }
          }
        }

        stagePost(post, ...args) {
          const result = super.stagePost(post, ...args);
          if (!this.journal) {
            return result;
          }

          if (post?.reply_to_post_number) {
            this.insertCommentInStream(post);
            this._reorderStoredPost(post);
          }

          if (shouldUseGlimmerPostStream()) {
            this._applyJournalCommentState();
          }

          return result;
        }

        commitPost(post, ...args) {
          const result = super.commitPost(post, ...args);
          if (!this.journal) {
            return result;
          }

          if (post?.reply_to_post_number) {
            this.insertCommentInStream(post);
            this._reorderStoredPost(post);
          }

          if (shouldUseGlimmerPostStream()) {
            this._applyJournalCommentState();
          }

          return result;
        }

        prependPost(post, ...args) {
          const result = super.prependPost(post, ...args);
          if (!this.journal) {
            return result;
          }

          // Ensure second post stays aligned with first entry when staging
          if (
            post?.post_number === 2 &&
            this.posts[0]?.post_number === 1 &&
            this.posts.length > 1
          ) {
            const stored = this._findStoredPost(post);
            if (stored) {
              this._moveStoredPost(stored, 1);
            }
          }

          if (shouldUseGlimmerPostStream()) {
            this._applyJournalCommentState();
          }

          return result;
        }

        appendPost(post, ...args) {
          const result = super.appendPost(post, ...args);
          if (!this.journal) {
            return result;
          }

          if (post?.reply_to_post_number) {
            this.insertCommentInStream(post);
            this._reorderStoredPost(post);
          }

          if (shouldUseGlimmerPostStream()) {
            this._applyJournalCommentState();
          }

          return result;
        }

        showAllJournalCommentsForEntry(entryPostId) {
          if (!shouldUseGlimmerPostStream() || !this.journal || !entryPostId) {
            return;
          }

          if (!this._journalShownEntryIds) {
            this._journalShownEntryIds = new Set();
          }

          if (!this._journalShownEntryIds.has(entryPostId)) {
            this._journalShownEntryIds.add(entryPostId);
            this._applyJournalCommentState();
          }
        }

        _applyJournalCommentState() {
          if (!shouldUseGlimmerPostStream() || !this.journal) {
            return;
          }

          const posts = this.posts;
          if (!posts?.length) {
            return;
          }

          const showAll = this._journalShownEntryIds || new Set();
          const defaultComments =
            Number(siteSettings.journal_comments_default) || 0;

          let commentCount = 0;
          let lastVisibleIndex = null;

          posts.forEach((post, index) => {
            if (!post) {
              return;
            }

            if (post.comment) {
              commentCount += 1;

              const showing =
                showAll.has(post.entry_post_id) ||
                commentCount <= defaultComments;

              post.setProperties?.({
                showComment: showing,
                attachCommentToggle: false,
                hiddenComments: 0,
              });

              if (showing) {
                lastVisibleIndex = index;
              }

              const nextPost = posts[index + 1];
              const reachedBoundary =
                !nextPost ||
                nextPost.entry ||
                !nextPost.comment;

              if (
                reachedBoundary &&
                !showing &&
                lastVisibleIndex !== null &&
                posts[lastVisibleIndex]
              ) {
                const hiddenCount = commentCount - defaultComments;
                if (hiddenCount > 0) {
                  posts[lastVisibleIndex].setProperties?.({
                    attachCommentToggle: true,
                    hiddenComments: hiddenCount,
                  });
                }
              }
            } else {
              commentCount = 0;
              lastVisibleIndex = index;
              post.setProperties?.({
                attachCommentToggle: false,
                hiddenComments: 0,
              });
            }
          });
        }

        _reorderStoredPost(post) {
          const stored = this._findStoredPost(post);
          if (!stored) {
            return;
          }

          const commentIndex = this.getCommentIndex(stored);
          if (commentIndex && commentIndex > 0) {
            this._moveStoredPost(stored, commentIndex);
          }
        }

        _findStoredPost(post) {
          if (!post) {
            return null;
          }

          const id = post.id;
          if (!id) {
            return null;
          }

          return this.findLoadedPost?.(id) ?? this._identityMap?.[id] ?? post;
        }

        _moveStoredPost(stored, targetIndex) {
          const posts = this.posts;
          const currentIndex = posts.indexOf(stored);

          if (currentIndex === -1 || currentIndex === targetIndex) {
            return;
          }

          const [item] = posts.splice(currentIndex, 1);
          posts.splice(targetIndex, 0, item);
        }

        updateFromJson(...args) {
          const result = super.updateFromJson(...args);

          if (shouldUseGlimmerPostStream() && this.journal) {
            this._applyJournalCommentState();
          }

          return result;
        }
      }
  );
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
      if (post?.journal && post.entry) {
        metadata.delete(metaDataInfoKeys.REPLY_TO_TAB);
      }
    }
  );
}

function registerShowCommentsOutlet(api) {
  api.renderAfterWrapperOutlet("post-links", JournalShowCommentsToggle);
}

function registerComposerHooks(api, shouldUseGlimmerPostStream) {
  api.onAppEvent("composer:opened", () => {
    if (!shouldUseGlimmerPostStream()) {
      return;
    }

    const composer = api.container.lookup("service:composer");
    const composerPost = composer?.model?.post;

    if (composerPost?.entry) {
      composerPost.topic?.postStream?.showAllJournalCommentsForEntry?.(
        composerPost.id
      );
    }
  });
}

function setupGlimmerPostStream(api, shouldUseGlimmerPostStream) {
  registerGlimmerAvatarTransformer(api);
  registerGlimmerMetaDataTransformer(api);
  registerShowCommentsOutlet(api);
  registerComposerHooks(api, shouldUseGlimmerPostStream);
}

function setupLegacyPostStream(api, siteSettings) {
  const store = api.container.lookup("service:store");
  const PostsWithPlaceholders = getPostsWithPlaceholders();

  api.decorateWidget("post:after", function (helper) {
    const model = helper.getModel();

    if (model.attachCommentToggle && model.hiddenComments > 0) {
      let type =
        Number(siteSettings.journal_comments_default) > 0 ? "more" : "all";

      return helper.attach("link", {
        action: "showComments",
        actionParam: model.entry_post_id,
        rawLabel: i18n(`topic.comment.show_comments.${type}`, {
          count: model.hiddenComments,
        }),
        className: "show-comments",
      });
    }
  });

  api.modifyClass("component:scrolling-post-stream", {
    pluginId: PLUGIN_ID,

    showComments: [],

    didInsertElement() {
      this._super(...arguments);
      this.appEvents.on("composer:opened", this, () => {
        const composer = api.container.lookup("service:composer");
        const post = composer.get("model.post");

        if (post && post.entry) {
          this.set("showComments", [post.id]);
        }

        this._refresh({ force: true });
      });
    },

    buildArgs() {
      return Object.assign(
        this._super(...arguments),
        this.getProperties("showComments")
      );
    },
  });

  api.reopenWidget("post-stream", {
    buildKey: () => "post-stream",

    firstPost() {
      return this.attrs.posts.toArray()[0];
    },

    defaultState(attrs, state) {
      let defaultState = this._super(attrs, state);

      const firstPost = this.firstPost();
      if (!firstPost || !firstPost.journal) {
        return defaultState;
      }
      defaultState.showComments = attrs.showComments;

      return defaultState;
    },

    showComments(entryId) {
      let showComments = this.state.showComments;

      if (showComments.indexOf(entryId) === -1) {
        showComments.push(entryId);
        this.state.showComments = showComments;
        this.appEvents.trigger("post-stream:refresh", { force: true });
      }
    },

    html(attrs, state) {
      const firstPost = this.firstPost();
      if (!firstPost || !firstPost.journal) {
        return this._super(...arguments);
      }

      let showComments = state.showComments || [];
      if (attrs.showComments && attrs.showComments.length) {
        attrs.showComments.forEach((postId) => {
          if (!showComments.includes(postId)) {
            showComments.push(postId);
          }
        });
      }

      let posts = attrs.posts || [];
      let postArray = this.capabilities.isAndroid ? posts : posts.toArray();
      let defaultComments = Number(siteSettings.journal_comments_default);
      let commentCount = 0;
      let lastVisible = null;

      postArray.forEach((p, i) => {
        if (!p.topic) {
          return;
        }

        if (p.comment) {
          commentCount++;
          let showingComments = showComments.indexOf(p.entry_post_id) > -1;
          let shownByDefault = commentCount <= defaultComments;

          p.showComment = showingComments || shownByDefault;
          p.attachCommentToggle = false;

          if (p.showComment) {
            lastVisible = i;
          }

          if (
            (!postArray[i + 1] || postArray[i + 1].entry) &&
            !p.showComment
          ) {
            postArray[lastVisible].attachCommentToggle = true;
            postArray[lastVisible].hiddenComments = commentCount - defaultComments;
          }
        } else {
          p.attachCommentToggle = false;

          commentCount = 0;
          lastVisible = i;
        }
      });

      if (this.capabilities.isAndroid || !PostsWithPlaceholders) {
        attrs.posts = postArray;
      } else {
        attrs.posts = PostsWithPlaceholders.create({
          posts: postArray,
          store,
        });
      }

      return this._super(attrs, state);
    },
  });

  api.reopenWidget("post-avatar", {
    html(attrs) {
      if (!attrs || !attrs.journal) {
        return this._super(...arguments);
      }

      if (attrs.comment) {
        this.settings.size = "small";
      } else {
        this.settings.size = "large";
      }

      return this._super(...arguments);
    },
  });

  api.reopenWidget("post", {
    html(attrs) {
      if (!attrs.journal) {
        return this._super(...arguments);
      }

      if (attrs.cloaked) {
        return "";
      }

      if (attrs.entry) {
        attrs.replyToUsername = null;
      }

      if (attrs.comment) {
        attrs.replyCount = null;
      }

      return this.attach("post-article", attrs);
    },
  });

  api.reopenWidget("reply-to-tab", {
    title: "in_reply_to",

    click() {
      if (this.attrs.journal) {
        return false;
      } else {
        return this._super(...arguments);
      }
    },
  });
}

export default {
  name: "journal-post",
  initialize(container) {
    const siteSettings = container.lookup("service:site-settings");

    if (!siteSettings.journal_enabled) {
      return;
    }

    const site = container.lookup("service:site");
    const shouldUseGlimmerPostStream = () => site.useGlimmerPostStream;

    withPluginApi("1.34.0", (api) => {
      registerPostMenuButtons(api);
      registerTrackedPostProperties(api);
      registerPostClasses(api);
      extendPostStreamModel(api, siteSettings, shouldUseGlimmerPostStream);
      setupGlimmerPostStream(api, shouldUseGlimmerPostStream);

      if (!shouldUseGlimmerPostStream()) {
        withSilencedDeprecations("discourse.post-stream-widget-overrides", () =>
          setupLegacyPostStream(api, siteSettings)
        );
      }
    });
  },
};
