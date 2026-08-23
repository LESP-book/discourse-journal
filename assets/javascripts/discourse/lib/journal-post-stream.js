export function getCommentIndex(postStream, post) {
  const posts = postStream.posts || [];
  let passed = false;
  let commentIndex = null;

  posts.some((candidate, index) => {
    if (passed && !candidate.reply_to_post_number) {
      commentIndex = index;
      return true;
    }

    if (
      candidate.post_number === post.reply_to_post_number &&
      index < posts.length - 1
    ) {
      passed = true;
    }

    return false;
  });

  return commentIndex;
}

export function insertCommentInStream(postStream, post) {
  const stream = postStream.stream;
  const postId = post.id;
  const commentIndex = getCommentIndex(postStream, post) - 1;

  if (stream.indexOf(postId) > -1 && commentIndex && commentIndex > 0) {
    const currentIndex = stream.indexOf(postId);
    stream.splice(currentIndex, 1);
    stream.splice(commentIndex, 0, postId);
  }
}

export function findStoredPost(postStream, post) {
  if (!post?.id) {
    return null;
  }

  return (
    postStream.findLoadedPost?.(post.id) ??
    postStream._identityMap?.[post.id] ??
    post
  );
}

export function moveStoredPost(postStream, stored, targetIndex) {
  const posts = postStream.posts;
  const currentIndex = posts.indexOf(stored);

  if (currentIndex === -1 || currentIndex === targetIndex) {
    return;
  }

  const [item] = posts.splice(currentIndex, 1);
  posts.splice(targetIndex, 0, item);
}

export function reorderStoredPost(postStream, post) {
  const stored = findStoredPost(postStream, post);
  if (!stored) {
    return;
  }

  const commentIndex = getCommentIndex(postStream, stored);
  if (commentIndex && commentIndex > 0) {
    moveStoredPost(postStream, stored, commentIndex);
  }
}

export function applyJournalCommentState(postStream, siteSettings) {
  if (!postStream.journal || !postStream.posts?.length) {
    return;
  }

  const defaultComments = Number(siteSettings.journal_comments_default) || 0;
  let commentCount = 0;
  let lastVisibleIndex = null;

  postStream.posts.forEach((post, index) => {
    if (!post) {
      return;
    }

    if (post.comment) {
      commentCount += 1;

      const showing =
        postStream._journalShownEntryIds.has(post.entry_post_id) ||
        commentCount <= defaultComments;

      post.setProperties?.({
        showComment: showing,
        attachCommentToggle: false,
        hiddenComments: 0,
      });

      if (showing) {
        lastVisibleIndex = index;
      }

      const nextPost = postStream.posts[index + 1];
      const reachedBoundary = !nextPost || nextPost.entry || !nextPost.comment;

      if (
        reachedBoundary &&
        !showing &&
        lastVisibleIndex !== null &&
        postStream.posts[lastVisibleIndex]
      ) {
        const hiddenCount = commentCount - defaultComments;
        if (hiddenCount > 0) {
          postStream.posts[lastVisibleIndex].setProperties?.({
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

export function afterPostMutation(postStream, post, siteSettings) {
  if (!postStream.journal) {
    return;
  }

  if (post?.reply_to_post_number) {
    insertCommentInStream(postStream, post);
    reorderStoredPost(postStream, post);
  }

  applyJournalCommentState(postStream, siteSettings);
}
