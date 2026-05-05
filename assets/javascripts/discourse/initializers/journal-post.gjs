import { withPluginApi } from "discourse/lib/plugin-api";
import JournalCommentButton from "../components/journal-comment-button";
import JournalCommentPagination from "../components/journal-comment-pagination";

const PLUGIN_ID = "discourse-journal";

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

function extendPostStreamModel(api, siteSettings) {
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
          const entryId = this._entryIdForPost(post, posts);

          if (!posts.length || !entryId) {
            return null;
          }

          const entryIndex = posts.findIndex((p) => p?.id === entryId);
          if (entryIndex === -1) {
            return null;
          }

          let commentIndex = entryIndex + 1;

          for (let index = entryIndex + 1; index < posts.length; index++) {
            const currentPost = posts[index];

            if (!currentPost) {
              continue;
            }

            const currentEntryId = this._entryIdForPost(currentPost, posts);

            if (currentEntryId === entryId) {
              commentIndex = index + 1;
              continue;
            }

            if (!currentPost.reply_to_post_number) {
              break;
            }
          }

          return commentIndex ?? entryIndex + 1;
        }

        /**
         * Determine the entry id a post belongs to by checking explicit journal
         * metadata first, then walking up the reply chain with cycle protection.
         *
         * @param {object} post
         * @returns {number|null}
         */
        _entryIdForPost(post, postsList = this.posts || []) {
          if (!post) {
            return null;
          }

          if (post.entry_post_id) {
            return post.entry_post_id;
          }

          if (post.entry) {
            return post.id;
          }

          const seen = new Set();
          let current = post;

          while (current?.reply_to_post_number) {
            const currentKey = current.id || current.post_number;
            if (currentKey && seen.has(currentKey)) {
              return null;
            }

            if (currentKey) {
              seen.add(currentKey);
            }

            const replyToPostNumber = current.reply_to_post_number;
            const replyToPostId = current.reply_to_post_id;
            let parent = null;

            for (const candidate of postsList) {
              if (
                candidate?.post_number === replyToPostNumber ||
                candidate?.id === replyToPostId
              ) {
                parent = candidate;
                break;
              }
            }

            if (!parent) {
              return null;
            }

            if (parent.entry_post_id) {
              return parent.entry_post_id;
            }

            if (parent.entry) {
              return parent.id;
            }

            current = parent;
          }

          return null;
        }

        insertCommentInStream(post) {
          const stream = this.stream;
          const postId = post.id;
          const commentIndex = this.getCommentIndex(post);

          if (stream.indexOf(postId) > -1 && commentIndex !== null) {
            if (
              typeof stream.removeObject === "function" &&
              typeof stream.insertAt === "function"
            ) {
              stream.removeObject(postId);
              const targetIndex = Math.min(commentIndex, stream.length);
              stream.insertAt(targetIndex, postId);
            } else {
              const currentIndex = stream.indexOf(postId);
              if (currentIndex > -1) {
                stream.splice(currentIndex, 1);
              }
              const targetIndex = Math.min(commentIndex, stream.length);
              stream.splice(targetIndex, 0, postId);
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
            this._rebuildJournalOrder();
          }

          this._applyJournalCommentState();

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
            this._rebuildJournalOrder();
            this._showJournalCommentPageForPost(post);
          }

          this._applyJournalCommentState();

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

          this._rebuildJournalOrder();
          this._applyJournalCommentState();

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
            this._rebuildJournalOrder();
          }

          this._applyJournalCommentState();

          return result;
        }

        setJournalCommentPage(entryPostId, page) {
          if (!this.journal || !entryPostId) {
            return;
          }

          const pageNumber = Number(page);
          if (!Number.isFinite(pageNumber) || pageNumber < 1) {
            return;
          }

          this._ensureJournalCommentPages().set(
            entryPostId,
            Math.floor(pageNumber)
          );
          this._ensureJournalExpandedCommentPaginators().add(entryPostId);
          this._applyJournalCommentState();
        }

        setJournalCommentPaginationExpanded(entryPostId, expanded) {
          if (!this.journal || !entryPostId) {
            return;
          }

          const expandedPaginators =
            this._ensureJournalExpandedCommentPaginators();

          if (expanded) {
            expandedPaginators.add(entryPostId);
          } else {
            expandedPaginators.delete(entryPostId);
            this._ensureJournalCommentPages().set(entryPostId, 1);
          }

          this._applyJournalCommentState();
        }

        _applyJournalCommentState() {
          if (!this.journal) {
            return;
          }

          const posts = this.posts;
          if (!posts?.length) {
            return;
          }

          const defaultComments = this._journalDefaultCommentCount();
          const commentGroups = new Map();

          posts.forEach((post) => {
            if (!post) {
              return;
            }

            if (post.comment) {
              const entryId = this._entryIdForPost(post, posts);

              post.setProperties?.({
                showComment: false,
                attachCommentPagination: false,
                commentPage: 1,
                commentPageCount: 1,
                commentPageStart: 0,
                commentPageEnd: 0,
                commentCount: 0,
                commentPaginationExpanded: false,
              });

              if (!entryId) {
                post.setProperties?.({
                  showComment: true,
                });
                return;
              }

              if (!commentGroups.has(entryId)) {
                commentGroups.set(entryId, []);
              }

              commentGroups.get(entryId).push(post);
            } else {
              post.setProperties?.({
                attachCommentPagination: false,
                commentPage: 1,
                commentPageCount: 1,
                commentPageStart: 0,
                commentPageEnd: 0,
                commentCount: 0,
                commentPaginationExpanded: false,
              });
            }
          });

          commentGroups.forEach((comments, entryId) => {
            const commentCount = comments.length;

            if (defaultComments <= 0 || commentCount <= defaultComments) {
              comments.forEach((comment) => {
                comment.setProperties?.({
                  showComment: true,
                  attachCommentPagination: false,
                  commentPage: 1,
                commentPageCount: 1,
                commentPageStart: commentCount > 0 ? 1 : 0,
                commentPageEnd: commentCount,
                commentCount,
                commentPaginationExpanded: false,
              });
              });
              return;
            }

            const expandedPageSize = this._journalExpandedCommentPageSize();
            const pageCount = Math.ceil(commentCount / expandedPageSize);
            const paginationExpanded =
              this._ensureJournalExpandedCommentPaginators().has(entryId);
            const currentPage = this._currentJournalCommentPage(
              entryId,
              pageCount
            );
            const startIndex = paginationExpanded
              ? (currentPage - 1) * expandedPageSize
              : 0;
            const endIndex = paginationExpanded
              ? Math.min(startIndex + expandedPageSize, commentCount)
              : defaultComments;
            let paginationPost = null;

            comments.forEach((comment, index) => {
              const showComment = index >= startIndex && index < endIndex;

              comment.setProperties?.({
                showComment,
                attachCommentPagination: false,
                commentPage: currentPage,
                commentPageCount: pageCount,
                commentPageStart: startIndex + 1,
                commentPageEnd: endIndex,
                commentCount,
                commentPaginationExpanded: paginationExpanded,
              });

              if (showComment) {
                paginationPost = comment;
              }
            });

            paginationPost?.setProperties?.({
              attachCommentPagination: true,
            });
          });
        }

        _ensureJournalCommentPages() {
          if (!this._journalCommentPages) {
            this._journalCommentPages = new Map();
          }

          return this._journalCommentPages;
        }

        _ensureJournalExpandedCommentPaginators() {
          if (!this._journalExpandedCommentPaginators) {
            this._journalExpandedCommentPaginators = new Set();
          }

          return this._journalExpandedCommentPaginators;
        }

        _journalDefaultCommentCount() {
          return Number(siteSettings.journal_comments_default) || 0;
        }

        _journalExpandedCommentPageSize() {
          const defaultComments = this._journalDefaultCommentCount();
          const expandedComments =
            Number(siteSettings.journal_comments_expanded_per_page) || 0;

          if (defaultComments <= 0) {
            return expandedComments;
          }

          return Math.max(defaultComments, expandedComments);
        }

        _currentJournalCommentPage(entryPostId, pageCount) {
          const pageMap = this._ensureJournalCommentPages();
          const savedPage = pageMap.get(entryPostId) || 1;
          const currentPage = Math.min(Math.max(savedPage, 1), pageCount);

          if (currentPage !== savedPage) {
            pageMap.set(entryPostId, currentPage);
          }

          return currentPage;
        }

        _showJournalCommentPageForPost(post) {
          if (!post?.reply_to_post_number) {
            return;
          }

          const pageSize = this._journalExpandedCommentPageSize();
          if (pageSize <= 0) {
            return;
          }

          const posts = this.posts || [];
          const entryId = this._entryIdForPost(post, posts);
          if (!entryId) {
            return;
          }

          const comments = posts.filter(
            (candidate) =>
              candidate?.comment &&
              this._entryIdForPost(candidate, posts) === entryId
          );
          const commentIndex = comments.findIndex(
            (candidate) =>
              candidate === post ||
              (post.id && candidate?.id === post.id) ||
              (post.post_number &&
                candidate?.post_number === post.post_number)
          );

          if (commentIndex === -1) {
            return;
          }

          this._ensureJournalCommentPages().set(
            entryId,
            Math.floor(commentIndex / pageSize) + 1
          );
        }

        _reorderStoredPost(post) {
          const stored = this._findStoredPost(post);
          if (!stored) {
            return;
          }

          const commentIndex = this.getCommentIndex(stored);
          if (commentIndex !== null && commentIndex > -1) {
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

          if (
            typeof posts.removeObject === "function" &&
            typeof posts.insertAt === "function"
          ) {
            const currentIndex = posts.indexOf(stored);
            if (currentIndex !== -1 && currentIndex !== targetIndex) {
              posts.removeObject(stored);
              const safeTargetIndex = Math.min(targetIndex, posts.length);
              posts.insertAt(safeTargetIndex, stored);
            }
          } else {
            const currentIndex = posts.indexOf(stored);
            if (currentIndex === -1 || currentIndex === targetIndex) {
              return;
            }
            const [item] = posts.splice(currentIndex, 1);
            const safeTargetIndex = Math.min(targetIndex, posts.length);
            posts.splice(safeTargetIndex, 0, item);
          }
        }

        updateFromJson(...args) {
          const result = super.updateFromJson(...args);

          if (this.journal) {
            this._rebuildJournalOrder();
            this._applyJournalCommentState();
          }

          return result;
        }

        _rebuildJournalOrder() {
          if (!this.journal || !this.posts?.length) {
            return;
          }

          const posts = this.posts;
          const snapshot = posts.slice();

          const entryIds =
            this.topic?.entry_post_ids?.length > 0
              ? this.topic.entry_post_ids
              : snapshot
                  .filter((p) => p?.entry)
                  .map((p) => p.id)
                  .filter(Boolean);

          const orderedPosts = [];
          const seen = new Set();

          entryIds.forEach((entryId) => {
            const entryPost = snapshot.find((p) => p?.id === entryId);
            if (entryPost) {
              orderedPosts.push(entryPost);
              seen.add(entryPost.id);
            }

            const comments = snapshot
              .filter(
                (p) =>
                  !p?.entry &&
                  this._entryIdForPost(p, snapshot) === entryId
              )
              .sort((a, b) => (a.post_number || 0) - (b.post_number || 0));

            comments.forEach((comment) => {
              if (!seen.has(comment.id)) {
                orderedPosts.push(comment);
                seen.add(comment.id);
              }
            });
          });

          snapshot.forEach((post) => {
            if (post?.id && !seen.has(post.id)) {
              orderedPosts.push(post);
              seen.add(post.id);
            }
          });

          if (orderedPosts.length !== posts.length) {
            return;
          }

          if (typeof posts.setObjects === "function") {
            posts.setObjects(orderedPosts);
          } else {
            posts.length = 0;
            orderedPosts.forEach((p) => posts.push(p));
          }

          const stream = this.stream;
          const orderedIds = orderedPosts.map((p) => p?.id).filter(Boolean);

          if (!stream?.length || !orderedIds.length) {
            return;
          }

          const orderedIdSet = new Set(orderedIds);
          const orderedStreamIds = stream.filter((id) => orderedIdSet.has(id));

          if (orderedStreamIds.length !== orderedIds.length) {
            return;
          }

          const replacementQueue = [...orderedIds];
          const newStream = stream.map((id) => {
            if (!orderedIdSet.has(id)) {
              return id;
            }

            return replacementQueue.shift() ?? id;
          });

          if (replacementQueue.length) {
            return;
          }

          if (typeof stream.setObjects === "function") {
            stream.setObjects(newStream);
          } else {
            stream.splice(0, stream.length, ...newStream);
          }
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
      if (!post?.journal) {
        return;
      }

      if (post.entry) {
        metadata.delete(metaDataInfoKeys.REPLY_TO_TAB);
      } else if (post.comment) {
        // If it's a direct comment on the entry, hide the reply tab.
        // If it's a reply to another comment, keep it.
        // We find the entry to compare post numbers.
        const postStream = post.topic?.postStream;
        // Optimization: try to find entry by ID in stream, or rely on data if available
        // post.entry_post_id is available.
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
      extendPostStreamModel(api, siteSettings);
      setupGlimmerPostStream(api);
    });
  },
};
