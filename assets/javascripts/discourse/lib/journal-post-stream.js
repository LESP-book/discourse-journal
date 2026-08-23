import { applyJournalCommentState } from "./journal-comment-pagination";
import { entryIdForPost } from "./journal-post-relations";

export function getCommentIndex(postStream, post) {
  const posts = postStream.posts || [];
  const entryId = entryIdForPost(post, posts);

  if (!entryId) {
    return null;
  }

  const entryIndex = posts.findIndex((candidate) => candidate?.id === entryId);
  if (entryIndex === -1) {
    return null;
  }

  let commentIndex = entryIndex + 1;

  for (let index = entryIndex + 1; index < posts.length; index++) {
    const current = posts[index];
    if (!current) {
      continue;
    }

    if (entryIdForPost(current, posts) === entryId) {
      commentIndex = index + 1;
      continue;
    }

    if (!current.reply_to_post_number) {
      break;
    }
  }

  return commentIndex;
}

export function insertCommentInStream(
  postStream,
  post,
  { insertMissing = false } = {}
) {
  const stream = postStream.stream;
  const postId = post?.id;
  const commentIndex = getCommentIndex(postStream, post);

  if (!stream || !postId || commentIndex === null) {
    return;
  }

  const currentIndex = stream.indexOf(postId);
  if (currentIndex === -1 && !insertMissing) {
    return;
  }

  if (currentIndex > -1) {
    stream.splice(currentIndex, 1);
  }

  stream.splice(Math.min(commentIndex, stream.length), 0, postId);
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
  posts.splice(Math.min(targetIndex, posts.length), 0, item);
}

export function reorderStoredPost(postStream, post) {
  const stored = findStoredPost(postStream, post);
  const commentIndex = getCommentIndex(postStream, stored);

  if (stored && commentIndex !== null) {
    moveStoredPost(postStream, stored, commentIndex);
  }
}

export function rebuildJournalOrder(postStream) {
  if (!postStream.journal || !postStream.posts?.length) {
    return;
  }

  const posts = postStream.posts;
  const snapshot = posts.slice();
  const entryIds =
    postStream.topic?.entry_post_ids?.length > 0
      ? postStream.topic.entry_post_ids
      : snapshot.filter((post) => post?.entry).map((post) => post.id);
  const orderedPosts = [];
  const seen = new Set();

  entryIds.forEach((entryId) => {
    const entry = snapshot.find((post) => post?.id === entryId);
    if (entry) {
      orderedPosts.push(entry);
      seen.add(entry.id);
    }

    snapshot
      .filter(
        (post) =>
          !post?.entry && entryIdForPost(post, snapshot) === entryId
      )
      .sort((a, b) => (a.post_number || 0) - (b.post_number || 0))
      .forEach((comment) => {
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

  posts.splice(0, posts.length, ...orderedPosts);

  const stream = postStream.stream;
  const orderedIds = orderedPosts.map((post) => post.id).filter(Boolean);
  if (!stream?.length || !orderedIds.length) {
    return;
  }

  const orderedIdSet = new Set(orderedIds);
  if (stream.filter((id) => orderedIdSet.has(id)).length !== orderedIds.length) {
    return;
  }

  const replacementQueue = [...orderedIds];
  stream.splice(
    0,
    stream.length,
    ...stream.map((id) =>
      orderedIdSet.has(id) ? (replacementQueue.shift() ?? id) : id
    )
  );
}

export function afterPostMutation(postStream, post, siteSettings) {
  if (!postStream.journal) {
    return;
  }

  if (post?.reply_to_post_number) {
    insertCommentInStream(postStream, post);
    reorderStoredPost(postStream, post);
  }

  rebuildJournalOrder(postStream);
  applyJournalCommentState(postStream, siteSettings);
}
