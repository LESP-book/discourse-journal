import { module, test } from "qunit";
import { registerPostStreamExtensions } from "discourse/plugins/discourse-journal/discourse/pre-initializers/journal-post-stream-model";

const siteSettings = { journal_comments_default: 0 };

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
      this.coreStageSideEffect = true;
      return "stage-result";
    }

    commitPost(...args) {
      this.coreCalls.push("commitPost");
      this.coreArgs = args;
      this.coreCommitSideEffect = true;
      return "commit-result";
    }

    prependPost(...args) {
      this.coreCalls.push("prependPost");
      this.coreArgs = args;
      this.corePrependSideEffect = true;
      return "prepend-result";
    }

    appendPost(...args) {
      this.coreCalls.push("appendPost");
      this.coreArgs = args;
      this.coreAppendSideEffect = true;
      return "append-result";
    }

    updateFromJson(...args) {
      this.coreCalls.push("updateFromJson");
      this.coreArgs = args;
      this.coreUpdateSideEffect = true;
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

function buildStream(CorePostStream, getters, posts = []) {
  const stream = new CorePostStream();
  stream.topic = { journal: true };
  stream.posts = posts;
  stream.stream = posts.map((post) => post.id);
  stream._identityMap = Object.fromEntries(
    posts.map((post) => [post.id, post])
  );
  stream._journalShownEntryIds = new Set();
  stream.coreCalls = [];
  Object.defineProperty(stream, "journal", { get: getters.get("journal") });
  return stream;
}

module("Unit | Pre-initializer | journal post stream model", function () {
  test("declares per-instance shown-entry state", function (assert) {
    const { fields } = setupExtensions();

    assert.deepEqual(fields, [
      {
        modelName: "post-stream",
        name: "_journalShownEntryIds",
        options: { type: "set" },
      },
    ]);
  });

  test("stagePost preserves core behavior and applies journal state", function (assert) {
    const setup = setupExtensions();
    const entry = buildPost({ id: 1, post_number: 1, entry: true });
    const comment = buildPost({
      id: 2,
      post_number: 2,
      comment: true,
      entry_post_id: 1,
    });
    const stream = buildStream(setup.CorePostStream, setup.getters, [
      entry,
      comment,
    ]);

    const result = setup.methods
      .get("stagePost")
      .call(stream, entry, "stage-extra");

    assert.strictEqual(result, "stage-result");
    assert.deepEqual(stream.coreCalls, ["stagePost"]);
    assert.deepEqual(stream.coreArgs, [entry, "stage-extra"]);
    assert.true(stream.coreStageSideEffect);
    assert.true(entry.attachCommentToggle);
    assert.strictEqual(entry.hiddenComments, 1);
    assert.false(comment.showComment);
  });

  test("commitPost preserves core behavior and applies journal state", function (assert) {
    const setup = setupExtensions();
    const entry = buildPost({ id: 1, post_number: 1, entry: true });
    const comment = buildPost({
      id: 2,
      post_number: 2,
      comment: true,
      entry_post_id: 1,
    });
    const stream = buildStream(setup.CorePostStream, setup.getters, [
      entry,
      comment,
    ]);

    const result = setup.methods
      .get("commitPost")
      .call(stream, entry, "commit-extra");

    assert.strictEqual(result, "commit-result");
    assert.deepEqual(stream.coreCalls, ["commitPost"]);
    assert.deepEqual(stream.coreArgs, [entry, "commit-extra"]);
    assert.true(stream.coreCommitSideEffect);
    assert.true(entry.attachCommentToggle);
    assert.false(comment.showComment);
  });

  test("prependPost preserves core behavior and repositions post two", function (assert) {
    const setup = setupExtensions();
    const first = buildPost({ id: 1, post_number: 1, entry: true });
    const other = buildPost({ id: 3, post_number: 3, entry: true });
    const second = buildPost({ id: 2, post_number: 2, entry: true });
    const stream = buildStream(setup.CorePostStream, setup.getters, [
      first,
      other,
      second,
    ]);

    const result = setup.methods
      .get("prependPost")
      .call(stream, second, "prepend-extra");

    assert.strictEqual(result, "prepend-result");
    assert.deepEqual(stream.coreCalls, ["prependPost"]);
    assert.deepEqual(stream.coreArgs, [second, "prepend-extra"]);
    assert.true(stream.corePrependSideEffect);
    assert.deepEqual(
      stream.posts.map((post) => post.id),
      [1, 2, 3],
      "keeps post two next to the first entry"
    );
  });

  test("appendPost preserves core behavior and applies journal state", function (assert) {
    const setup = setupExtensions();
    const entry = buildPost({ id: 1, post_number: 1, entry: true });
    const comment = buildPost({
      id: 2,
      post_number: 2,
      comment: true,
      entry_post_id: 1,
    });
    const stream = buildStream(setup.CorePostStream, setup.getters, [
      entry,
      comment,
    ]);

    const result = setup.methods
      .get("appendPost")
      .call(stream, entry, "append-extra");

    assert.strictEqual(result, "append-result");
    assert.deepEqual(stream.coreCalls, ["appendPost"]);
    assert.deepEqual(stream.coreArgs, [entry, "append-extra"]);
    assert.true(stream.coreAppendSideEffect);
    assert.true(entry.attachCommentToggle);
    assert.false(comment.showComment);
  });

  test("updateFromJson preserves core behavior and reapplies journal state", function (assert) {
    const setup = setupExtensions();
    const entry = buildPost({ id: 1, post_number: 1, entry: true });
    const comment = buildPost({
      id: 2,
      post_number: 2,
      comment: true,
      entry_post_id: 1,
    });
    const stream = buildStream(setup.CorePostStream, setup.getters, [
      entry,
      comment,
    ]);

    const payload = { posts: [] };
    const result = setup.methods.get("updateFromJson").call(stream, payload);

    assert.strictEqual(result, "update-result");
    assert.deepEqual(stream.coreCalls, ["updateFromJson"]);
    assert.deepEqual(stream.coreArgs, [payload]);
    assert.true(stream.coreUpdateSideEffect);
    assert.true(entry.attachCommentToggle);
    assert.false(comment.showComment);
  });
});
