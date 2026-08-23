export function entryIdForPost(post, posts = []) {
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
    const parent = posts.find(
      (candidate) =>
        candidate?.post_number === replyToPostNumber ||
        candidate?.id === replyToPostId
    );

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
