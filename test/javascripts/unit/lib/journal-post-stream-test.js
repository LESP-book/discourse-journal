import { module, test } from "qunit";
import {
  applyJournalCommentState,
  setJournalCommentPage,
} from "discourse/plugins/discourse-journal/discourse/lib/journal-comment-pagination";
import { entryIdForPost } from "discourse/plugins/discourse-journal/discourse/lib/journal-post-relations";
import {
  afterPostMutation,
  rebuildJournalOrder,
} from "discourse/plugins/discourse-journal/discourse/lib/journal-post-stream";

const siteSettings = {
  journal_comments_default: 2,
  journal_comments_expanded_per_page: 3,
};

function buildPost(attributes) {
  return {
    ...attributes,
    setProperties(properties) {
      Object.assign(this, properties);
    },
  };
}

function buildPostStream(posts) {
  return {
    journal: true,
    posts,
    stream: posts.map((post) => post.id),
    _journalCommentPages: {},
    _journalExpandedCommentPaginators: new Set(),
  };
}

module("Unit | Lib | journal post stream", function () {
  test("shows the default comments and attaches one collapsed paginator", function (assert) {
    const entry = buildPost({ id: 1, post_number: 1, entry: true });
    const comments = [2, 3, 4].map((id) =>
      buildPost({
        id,
        post_number: id,
        comment: true,
        entry_post_id: 1,
        reply_to_post_number: 1,
      })
    );
    const postStream = buildPostStream([entry, ...comments]);

    applyJournalCommentState(postStream, siteSettings);

    assert.true(comments[0].showComment);
    assert.true(comments[1].showComment);
    assert.false(comments[2].showComment);
    assert.true(comments[1].attachCommentPagination);
    assert.false(comments[0].attachCommentPagination);
    assert.strictEqual(comments[1].commentCount, 3);
    assert.strictEqual(comments[1].commentPageCount, 1);
    assert.false(comments[1].commentPaginationExpanded);
  });

  test("expands and selects the requested comment page", function (assert) {
    const entry = buildPost({ id: 1, post_number: 1, entry: true });
    const comments = [2, 3, 4, 5, 6].map((id) =>
      buildPost({
        id,
        post_number: id,
        comment: true,
        entry_post_id: 1,
        reply_to_post_number: 1,
      })
    );
    const postStream = buildPostStream([entry, ...comments]);

    setJournalCommentPage(postStream, 1, 2, siteSettings);

    assert.deepEqual(
      comments.filter((comment) => comment.showComment).map((comment) => comment.id),
      [5, 6]
    );
    assert.true(comments[4].attachCommentPagination);
    assert.strictEqual(comments[4].commentPage, 2);
    assert.strictEqual(comments[4].commentPageCount, 2);
    assert.true(comments[4].commentPaginationExpanded);
  });

  test("groups replies to comments with their entry", function (assert) {
    const entry = buildPost({ id: 1, post_number: 1, entry: true });
    const directComment = buildPost({
      id: 2,
      post_number: 2,
      comment: true,
      reply_to_post_number: 1,
    });
    const nestedComment = buildPost({
      id: 3,
      post_number: 3,
      comment: true,
      reply_to_post_number: 2,
    });
    const postStream = buildPostStream([entry, directComment, nestedComment]);

    assert.strictEqual(entryIdForPost(nestedComment, postStream.posts), 1);

    applyJournalCommentState(postStream, siteSettings);
    assert.strictEqual(nestedComment.commentCount, 2);
  });

  test("rebuilds stored posts and stream ids into entry/comment order", function (assert) {
    const entry = buildPost({ id: 1, post_number: 1, entry: true });
    const comment = buildPost({
      id: 2,
      post_number: 2,
      comment: true,
      reply_to_post_number: 1,
    });
    const nextEntry = buildPost({ id: 3, post_number: 3, entry: true });
    const postStream = buildPostStream([entry, nextEntry, comment]);
    postStream.stream = [1, 3, 2];

    rebuildJournalOrder(postStream);

    assert.deepEqual(postStream.posts.map((post) => post.id), [1, 2, 3]);
    assert.deepEqual(postStream.stream, [1, 2, 3]);

    afterPostMutation(postStream, comment, siteSettings);
    assert.true(comment.showComment);
  });
});
