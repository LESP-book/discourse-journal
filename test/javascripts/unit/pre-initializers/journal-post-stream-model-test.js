import { module, test } from "qunit";
import { registerPostStreamExtensions } from "discourse/plugins/discourse-journal/discourse/pre-initializers/journal-post-stream-model";

const siteSettings = {
  journal_comments_default: 1,
  journal_comments_expanded_per_page: 2,
};

function buildPost(attributes) {
  return {
    ...attributes,
    setProperties(properties) {
      Object.assign(this, properties);
    },
  };
}

function setupExtensions() {
  class CorePostStream {
    stagePost(...args) {
      this.coreCalls.push("stagePost");
      this.coreArgs = args;
      return "stage-result";
    }

    commitPost(...args) {
      this.coreCalls.push("commitPost");
      this.coreArgs = args;
      return "commit-result";
    }

    prependPost(...args) {
      this.coreCalls.push("prependPost");
      this.coreArgs = args;
      return "prepend-result";
    }

    appendPost(...args) {
      this.coreCalls.push("appendPost");
      this.coreArgs = args;
      this.posts.push(args[0]);
      return "append-result";
    }

    updateFromJson(...args) {
      this.coreCalls.push("updateFromJson");
      this.coreArgs = args;

      const postStreamData = args[0];
      this.posts.length = 0;
      postStreamData?.posts?.forEach((post) => this.appendPost(post));

      if (postStreamData?.stream) {
        this.stream = [...postStreamData.stream];
      }

      if (this.failUpdate) {
        throw new Error("update failed");
      }

      return "update-result";
    }
  }

  const fields = [];
  const getters = new Map();
  const methods = new Map();
  const api = {
    container: {
      factoryFor() {
        return { class: CorePostStream };
      },
    },
    addModelField(modelName, name, options) {
      fields.push({ modelName, name, options });
    },
    addModelGetter(modelName, name, getter) {
      getters.set(name, getter);
    },
    addModelMethod(modelName, name, method) {
      methods.set(name, method);
    },
  };

  registerPostStreamExtensions(api, siteSettings);
  return { CorePostStream, fields, getters, methods };
}

function buildStream(CorePostStream, getters, methods, posts = []) {
  const stream = new CorePostStream();
  stream.topic = { journal: true };
  stream.posts = posts;
  stream.stream = posts.map((post) => post.id);
  stream._identityMap = Object.fromEntries(
    posts.map((post) => [post.id, post])
  );
  stream._journalCommentPages = {};
  stream._journalExpandedCommentPaginators = new Set();
  stream.coreCalls = [];
  Object.defineProperty(stream, "journal", { get: getters.get("journal") });

  [
    "appendPost",
    "commitPost",
    "prependPost",
    "stagePost",
    "updateFromJson",
  ].forEach((methodName) => {
    stream[methodName] = (...args) =>
      methods.get(methodName).call(stream, ...args);
  });

  return stream;
}

module("Unit | Pre-initializer | journal post stream model", function () {
  test("declares per-instance pagination state", function (assert) {
    const { fields } = setupExtensions();

    assert.deepEqual(fields, [
      {
        modelName: "post-stream",
        name: "_journalCommentPages",
        options: { type: "object" },
      },
      {
        modelName: "post-stream",
        name: "_journalExpandedCommentPaginators",
        options: { type: "set" },
      },
    ]);
  });

  test("exposes pagination methods that update only the selected entry", function (assert) {
    const setup = setupExtensions();
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
    const stream = buildStream(
      setup.CorePostStream,
      setup.getters,
      setup.methods,
      [entry, ...comments]
    );

    setup.methods.get("setJournalCommentPage").call(stream, 1, 2);

    assert.strictEqual(stream._journalCommentPages[1], 2);
    assert.true(stream._journalExpandedCommentPaginators.has(1));
    assert.deepEqual(
      comments
        .filter((comment) => comment.showComment)
        .map((comment) => comment.id),
      [4]
    );
  });

  test("stagePost preserves core behavior and refreshes pagination state", function (assert) {
    const setup = setupExtensions();
    const entry = buildPost({ id: 1, post_number: 1, entry: true });
    const comments = [2, 3].map((id) =>
      buildPost({
        id,
        post_number: id,
        comment: true,
        entry_post_id: 1,
        reply_to_post_number: 1,
      })
    );
    const stream = buildStream(
      setup.CorePostStream,
      setup.getters,
      setup.methods,
      [entry, ...comments]
    );

    const result = setup.methods
      .get("stagePost")
      .call(stream, comments[1], "stage-extra");

    assert.strictEqual(result, "stage-result");
    assert.deepEqual(stream.coreCalls, ["stagePost"]);
    assert.deepEqual(stream.coreArgs, [comments[1], "stage-extra"]);
    assert.true(comments[0].showComment);
    assert.false(comments[1].showComment);
    assert.true(comments[0].attachCommentPagination);
  });

  test("commitPost preserves core behavior and reveals the page containing a new comment", function (assert) {
    const setup = setupExtensions();
    const entry = buildPost({ id: 1, post_number: 1, entry: true });
    const firstComment = buildPost({
      id: 2,
      post_number: 2,
      comment: true,
      entry_post_id: 1,
      reply_to_post_number: 1,
    });
    const secondComment = buildPost({
      id: 3,
      post_number: 3,
      comment: true,
      entry_post_id: 1,
      reply_to_post_number: 1,
    });
    const newComment = buildPost({
      id: 4,
      post_number: 4,
      comment: true,
      entry_post_id: 1,
      reply_to_post_number: 1,
    });
    const stream = buildStream(
      setup.CorePostStream,
      setup.getters,
      setup.methods,
      [entry, firstComment, secondComment]
    );

    const result = setup.methods.get("commitPost").call(stream, newComment);

    assert.strictEqual(result, "commit-result");
    assert.deepEqual(stream.coreCalls, ["commitPost", "appendPost"]);
    assert.true(stream._journalExpandedCommentPaginators.has(1));
    assert.strictEqual(stream._journalCommentPages[1], 2);
    assert.false(firstComment.showComment);
    assert.false(secondComment.showComment);
    assert.true(newComment.showComment);

    stream.coreCalls = [];
    const refreshResult = stream.updateFromJson({
      posts: [entry, newComment, firstComment, secondComment],
      stream: [1, 4, 2, 3],
    });

    assert.strictEqual(refreshResult, "update-result");
    assert.deepEqual(
      stream.coreCalls,
      [
        "updateFromJson",
        "appendPost",
        "appendPost",
        "appendPost",
        "appendPost",
      ],
      "refresh dispatches each core append through the registered wrapper"
    );
    assert.strictEqual(stream._journalCommentPages[1], 2);
    assert.deepEqual(
      stream.posts.map((post) => post.id),
      [1, 2, 3, 4]
    );
    assert.deepEqual(stream.stream, [1, 2, 3, 4]);
    assert.false(firstComment.showComment);
    assert.false(secondComment.showComment);
    assert.true(newComment.showComment);
  });

  test("updateFromJson restores its refresh guard after an error", function (assert) {
    const setup = setupExtensions();
    const entry = buildPost({ id: 1, post_number: 1, entry: true });
    const firstComment = buildPost({
      id: 2,
      post_number: 2,
      comment: true,
      entry_post_id: 1,
      reply_to_post_number: 1,
    });
    const secondComment = buildPost({
      id: 3,
      post_number: 3,
      comment: true,
      entry_post_id: 1,
      reply_to_post_number: 1,
    });
    const stream = buildStream(
      setup.CorePostStream,
      setup.getters,
      setup.methods,
      [entry]
    );
    stream.failUpdate = true;

    assert.throws(
      () =>
        stream.updateFromJson({
          posts: [entry, firstComment, secondComment],
          stream: [1, 2, 3],
        }),
      /update failed/
    );
    assert.strictEqual(
      firstComment.showComment,
      undefined,
      "intermediate mutations do not apply journal state"
    );

    stream.failUpdate = false;
    const postAfterError = buildPost({
      id: 4,
      post_number: 4,
      comment: true,
      entry_post_id: 1,
      reply_to_post_number: 1,
    });
    stream.appendPost(postAfterError);

    assert.true(firstComment.showComment);
    assert.false(postAfterError.showComment);
  });

  test("updateFromJson delegates for non-journal topics", function (assert) {
    const setup = setupExtensions();
    const post = buildPost({ id: 1, post_number: 1 });
    const stream = buildStream(
      setup.CorePostStream,
      setup.getters,
      setup.methods,
      []
    );
    stream.topic.journal = false;

    const result = stream.updateFromJson({ posts: [post], stream: [1] });

    assert.strictEqual(result, "update-result");
    assert.deepEqual(stream.coreCalls, ["updateFromJson", "appendPost"]);
    assert.deepEqual(stream.posts, [post]);
    assert.strictEqual(post.showComment, undefined);
  });
});
