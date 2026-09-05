import { module, test } from "qunit";

// A layout fixture for the post/reactions wrapper structure. It deliberately
// leaves overflow, visibility, opacity and control heights to the plugin CSS.
module("Unit | Stylesheet | journal comment overlays", function (hooks) {
  let fixture;

  hooks.beforeEach(function () {
    fixture = document.createElement("div");
    fixture.className = "topic-journal journal-overlay-test";
    fixture.innerHTML = `
      <style>
        .journal-overlay-test {
          position: fixed;
          top: 0;
          left: 0;
          width: 320px;
          height: 600px;
          z-index: 10000;
          background: white;
        }
        .journal-overlay-test * {
          transition: none !important;
          animation: none !important;
        }
        .journal-overlay-test .topic-post {
          position: relative;
          top: 300px;
          width: 300px;
          margin: 0;
          padding: 0;
        }
        .journal-overlay-test .topic-body {
          float: none;
          width: 100%;
        }
        .journal-overlay-test .regular { min-height: 70px; }
        .journal-overlay-test .post-menu-area {
          position: relative;
          min-height: 40px;
        }
        .journal-overlay-test .actions { display: flex; }
        .journal-overlay-test .discourse-reactions-picker,
        .journal-overlay-test .who-liked,
        .journal-overlay-test .who-read {
          position: absolute;
          left: 0;
          top: -240px;
          width: 280px;
          height: 240px;
          margin: 0;
          padding: 0;
          background: silver;
        }
        .journal-overlay-test .candidate {
          display: block;
          width: 40px;
          height: 40px;
          margin: 8px;
        }
      </style>
      <div class="topic-post comment show">
        <div class="topic-body">
          <div class="regular contents">
            <p>Comment</p>
            <section class="post__menu-area post-menu-area">
              <nav class="post-controls">
                <div class="actions">
                  <div class="discourse-reactions-actions-button-shim">
                    <div class="discourse-reactions-actions">
                      <div class="discourse-reactions-picker is-expanded">
                        <button class="candidate">Reaction</button>
                      </div>
                      <button class="reaction-button">Like</button>
                    </div>
                  </div>
                  <button class="reply">Reply</button>
                </div>
              </nav>
            </section>
          </div>
        </div>
      </div>`;
    document.body.appendChild(fixture);
  });

  hooks.afterEach(function () {
    fixture.remove();
  });

  function isHit(element) {
    const rect = element.getBoundingClientRect();
    return element.contains(
      document.elementFromPoint(rect.left + rect.width / 2, rect.top + 5)
    );
  }

  test("a shown comment exposes the entire nested reaction picker", function (assert) {
    fixture.querySelector(".reaction-button").focus();
    const comment = fixture.querySelector(".comment");
    const candidate = fixture.querySelector(".candidate");
    const wrapper = fixture.querySelector(
      ".discourse-reactions-actions-button-shim"
    );

    assert.strictEqual(getComputedStyle(comment).overflow, "visible");
    assert.strictEqual(getComputedStyle(wrapper).overflow, "visible");
    assert.true(
      candidate.getBoundingClientRect().top <
        comment.getBoundingClientRect().top,
      "the top row extends above the comment boundary"
    );
    assert.true(isHit(candidate), "the top row is visible and clickable");
  });

  test("folding a comment still clips its open overlay and removes its height", function (assert) {
    fixture.querySelector(".reaction-button").focus();
    const comment = fixture.querySelector(".comment");
    const candidate = fixture.querySelector(".candidate");
    comment.classList.remove("show");

    assert.strictEqual(getComputedStyle(comment).overflow, "hidden");
    assert.strictEqual(comment.getBoundingClientRect().height, 0);
    assert.false(isHit(candidate), "a hidden comment cannot leak a picker");

    comment.classList.add("show");
    assert.true(isHit(candidate), "reopening restores the overlay");
  });

  test("keyboard focus reveals the reply control without resizing its wrapper", function (assert) {
    const reply = fixture.querySelector(".reply");
    const height = reply.getBoundingClientRect().height;
    reply.focus();

    assert.strictEqual(document.activeElement, reply, "reply accepts focus");
    assert.strictEqual(getComputedStyle(reply).opacity, "1");
    assert.strictEqual(getComputedStyle(reply).pointerEvents, "auto");
    assert.strictEqual(reply.getBoundingClientRect().height, height);
  });

  test("ordinary posts do not acquire comment clipping or control hiding", function (assert) {
    const post = fixture.querySelector(".topic-post");
    post.classList.remove("comment", "show");
    fixture.classList.remove("topic-journal");

    assert.strictEqual(getComputedStyle(post).overflow, "visible");
    assert.strictEqual(
      getComputedStyle(fixture.querySelector(".reply")).opacity,
      "1"
    );
    assert.true(isHit(fixture.querySelector(".candidate")));
  });

  test("other post overlays can also escape the visible comment", function (assert) {
    fixture.querySelector(".discourse-reactions-picker").remove();
    fixture.querySelector(".reply").focus();
    const menu = fixture.querySelector(".post-menu-area");

    for (const name of ["who-liked", "who-read"]) {
      const overlay = document.createElement("div");
      overlay.className = name;
      overlay.textContent = name;
      menu.appendChild(overlay);
      assert.true(isHit(overlay), `${name} is not clipped by the comment`);
      overlay.remove();
    }
  });
});
