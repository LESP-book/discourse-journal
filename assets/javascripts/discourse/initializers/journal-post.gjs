import Component from "@glimmer/component";
import { alias } from "@ember/object/computed";
import { withPluginApi } from "discourse/lib/plugin-api";
import PostsWithPlaceholders from "discourse/lib/posts-with-placeholders";
import { i18n } from "discourse-i18n";
import JournalCommentButton from "../components/journal-comment-button";

const PLUGIN_ID = "discourse-journal";

export default {
  name: "journal-post",
  initialize(container) {
    const siteSettings = container.lookup("service:site-settings");

    if (!siteSettings.journal_enabled) {
      return;
    }

    withPluginApi("1.34.0", (api) => {
      api.registerValueTransformer(
        "post-menu-buttons",
        ({
          value: dag,
          context: { post, buttonKeys, lastHiddenButtonKey },
        }) => {
          if (post.topic.details.can_create_post && post.journal) {
            dag.add("comment", JournalCommentButton, {
              after: lastHiddenButtonKey,
            });
            dag.delete(buttonKeys.REPLY);
          }
        }
      );
    });

    withPluginApi("0.8.12", (api) => {
      const store = api.container.lookup("service:store");

      api.includePostAttributes(
        "journal",
        "reply_to_post_number",
        "comment",
        "showComment",
        "entry",
        "entry_post_id",
        "entry_post_ids"
      );

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
          defaultState["showComments"] = attrs.showComments;

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

              p["showComment"] = showingComments || shownByDefault;
              p["attachCommentToggle"] = false;

              if (p["showComment"]) {
                lastVisible = i;
              }

              if (
                (!postArray[i + 1] || postArray[i + 1].entry) &&
                !p["showComment"]
              ) {
                postArray[lastVisible]["attachCommentToggle"] = true;
                postArray[lastVisible]["hiddenComments"] =
                  commentCount - defaultComments;
              }
            } else {
              p["attachCommentToggle"] = false;

              commentCount = 0;
              lastVisible = i;
            }
          });

          if (this.capabilities.isAndroid) {
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

      api.modifyClass("model:post-stream", {
        pluginId: PLUGIN_ID,

        journal: alias("topic.journal"),

        getCommentIndex(post) {
          const posts = this.get("posts");
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
          });

          return commentIndex;
        },

        insertCommentInStream(post) {
          const stream = this.stream;
          const postId = post.get("id");
          const commentIndex = this.getCommentIndex(post) - 1;

          if (stream.indexOf(postId) > -1 && commentIndex && commentIndex > 0) {
            stream.removeObject(postId);
            stream.insertAt(commentIndex, postId);
          }
        },

        stagePost(post) {
          let result = this._super(...arguments);
          if (!this.journal) {
            return result;
          }

          if (post.get("reply_to_post_number")) {
            this.insertCommentInStream(post);
          }

          return result;
        },

        commitPost(post) {
          let result = this._super(...arguments);
          if (!this.journal) {
            return result;
          }

          if (post.get("reply_to_post_number")) {
            this.insertCommentInStream(post);
          }

          return result;
        },

        prependPost(post) {
          if (!this.journal) {
            return this._super(...arguments);
          }

          const stored = this.storePost(post);
          if (stored) {
            const posts = this.get("posts");

            if (post.post_number === 2 && posts[0].post_number === 1) {
              posts.insertAt(1, stored);
            } else {
              posts.unshiftObject(stored);
            }
          }

          return post;
        },

        appendPost(post) {
          if (!this.journal) {
            return this._super(...arguments);
          }

          const stored = this.storePost(post);
          if (stored) {
            const posts = this.get("posts");

            if (!posts.includes(stored)) {
              let insertPost = () => posts.pushObject(stored);

              if (post.get("reply_to_post_number")) {
                const commentIndex = this.getCommentIndex(post);

                if (commentIndex && commentIndex > 0) {
                  insertPost = () => posts.insertAt(commentIndex, stored);
                }
              }

              if (!this.get("loadingBelow")) {
                this.get("postsWithPlaceholders").appendPost(insertPost);
              } else {
                insertPost();
              }
            }

            if (stored.get("id") !== -1) {
              this.set("lastAppended", stored);
            }
          }

          return post;
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
    });
  },
};
