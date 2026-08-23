import { module, test } from "qunit";
import {
  applyJournalCommentState,
  insertCommentInStream,
  moveStoredPost,
  reorderStoredPost,
} from "discourse/plugins/discourse-journal/discourse/lib/journal-post-stream";

function buildPost(attributes) {
  return {
    ...attributes,
    setProperties(properties) {
      Object.assign(this, properties);
    },
  };
}

module("Unit | Lib | journal post stream", function () {
  test("applies the default comment visibility and toggle state", function (assert) {
    const entry = buildPost({ id: 1, post_number: 1, entry: true });
    const firstComment = buildPost({
      id: 2,
      post_number: 2,
      comment: true,
      entry_post_id: 1,
    });
    const hiddenComment = buildPost({
      id: 3,
      post_number: 3,
      comment: true,
      entry_post_id: 1,
    });
    const postStream = {
      journal: true,
      posts: [entry, firstComment, hiddenComment],
      _journalShownEntryIds: new Set(),
    };

    applyJournalCommentState(postStream, { journal_comments_default: 1 });

    assert.true(firstComment.showComment);
    assert.false(hiddenComment.showComment);
    assert.true(firstComment.attachCommentToggle);
    assert.strictEqual(firstComment.hiddenComments, 1);
  });

  test("shown entry state reveals all comments", function (assert) {
    const entry = buildPost({ id: 1, post_number: 1, entry: true });
    const comment = buildPost({
      id: 2,
      post_number: 2,
      comment: true,
      entry_post_id: 1,
    });
    const postStream = {
      journal: true,
      posts: [entry, comment],
      _journalShownEntryIds: new Set([1]),
    };

    applyJournalCommentState(postStream, { journal_comments_default: 0 });

    assert.true(comment.showComment);
    assert.false(comment.attachCommentToggle);
  });

  test("reorders stream ids and stored posts", function (assert) {
    const entry = buildPost({ id: 1, post_number: 1, entry: true });
    const comment = buildPost({
      id: 2,
      post_number: 2,
      comment: true,
      reply_to_post_number: 1,
    });
    const nextEntry = buildPost({ id: 3, post_number: 3, entry: true });
    const trailingEntry = buildPost({ id: 4, post_number: 4, entry: true });
    const postStream = {
      posts: [entry, comment, nextEntry, trailingEntry],
      stream: [1, 3, 2, 4],
      _identityMap: { 1: entry, 2: comment, 3: nextEntry, 4: trailingEntry },
    };

    insertCommentInStream(postStream, comment);
    assert.deepEqual(postStream.stream, [1, 2, 3, 4]);

    moveStoredPost(postStream, comment, 2);
    assert.deepEqual(
      postStream.posts.map((post) => post.id),
      [1, 3, 2, 4]
    );

    reorderStoredPost(postStream, comment);
    assert.deepEqual(
      postStream.posts.map((post) => post.id),
      [1, 2, 3, 4],
      "moves the comment to the computed boundary"
    );
  });
});
