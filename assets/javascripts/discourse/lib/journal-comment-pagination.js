import { entryIdForPost } from "./journal-post-relations";

export function applyJournalCommentState(postStream, siteSettings) {
  if (!postStream.journal || !postStream.posts?.length) {
    return;
  }

  const posts = postStream.posts;
  const defaultComments = Number(siteSettings.journal_comments_default) || 0;
  const commentGroups = new Map();

  posts.forEach((post) => {
    if (!post) {
      return;
    }

    if (!post.comment) {
      post.setProperties?.({
        attachCommentPagination: false,
        commentPage: 1,
        commentPageCount: 1,
        commentPageStart: 0,
        commentPageEnd: 0,
        commentCount: 0,
        commentPaginationExpanded: false,
      });
      return;
    }

    const entryId = entryIdForPost(post, posts);
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
      post.setProperties?.({ showComment: true });
      return;
    }

    if (!commentGroups.has(entryId)) {
      commentGroups.set(entryId, []);
    }
    commentGroups.get(entryId).push(post);
  });

  commentGroups.forEach((comments, entryId) => {
    const commentCount = comments.length;

    if (defaultComments <= 0 || commentCount <= defaultComments) {
      comments.forEach((comment) => {
        comment.setProperties?.({
          showComment: true,
          commentPageStart: 1,
          commentPageEnd: commentCount,
          commentCount,
        });
      });
      return;
    }

    const pageSize = expandedCommentPageSize(siteSettings);
    const pageCount = Math.ceil(commentCount / pageSize);
    const paginationExpanded = postStream._journalExpandedCommentPaginators.has(
      entryId
    );
    const currentPage = currentCommentPage(postStream, entryId, pageCount);
    const startIndex = paginationExpanded ? (currentPage - 1) * pageSize : 0;
    const endIndex = paginationExpanded
      ? Math.min(startIndex + pageSize, commentCount)
      : defaultComments;
    let paginationPost;

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

    paginationPost?.setProperties?.({ attachCommentPagination: true });
  });
}

export function setJournalCommentPage(postStream, entryPostId, page, siteSettings) {
  if (!postStream.journal || !entryPostId) {
    return;
  }

  const pageNumber = Number(page);
  if (!Number.isFinite(pageNumber) || pageNumber < 1) {
    return;
  }

  postStream._journalCommentPages[entryPostId] = Math.floor(pageNumber);
  postStream._journalExpandedCommentPaginators.add(entryPostId);
  applyJournalCommentState(postStream, siteSettings);
}

export function setJournalCommentPaginationExpanded(
  postStream,
  entryPostId,
  expanded,
  siteSettings
) {
  if (!postStream.journal || !entryPostId) {
    return;
  }

  if (expanded) {
    postStream._journalExpandedCommentPaginators.add(entryPostId);
  } else {
    postStream._journalExpandedCommentPaginators.delete(entryPostId);
    postStream._journalCommentPages[entryPostId] = 1;
  }

  applyJournalCommentState(postStream, siteSettings);
}

export function showJournalCommentPageForPost(postStream, post, siteSettings) {
  if (!post?.reply_to_post_number) {
    return;
  }

  const entryId = entryIdForPost(post, postStream.posts);
  if (!entryId) {
    return;
  }

  const comments = postStream.posts.filter(
    (candidate) =>
      candidate?.comment &&
      entryIdForPost(candidate, postStream.posts) === entryId
  );
  const commentIndex = comments.findIndex(
    (candidate) =>
      candidate === post ||
      (post.id && candidate?.id === post.id) ||
      (post.post_number && candidate?.post_number === post.post_number)
  );

  if (commentIndex === -1) {
    return;
  }

  postStream._journalCommentPages[entryId] =
    Math.floor(commentIndex / expandedCommentPageSize(siteSettings)) + 1;
  postStream._journalExpandedCommentPaginators.add(entryId);
}

function expandedCommentPageSize(siteSettings) {
  return Math.max(
    Number(siteSettings.journal_comments_default) || 0,
    Number(siteSettings.journal_comments_expanded_per_page) || 0,
    1
  );
}

function currentCommentPage(postStream, entryPostId, pageCount) {
  const savedPage = postStream._journalCommentPages[entryPostId] || 1;
  const currentPage = Math.min(Math.max(savedPage, 1), pageCount);

  if (currentPage !== savedPage) {
    postStream._journalCommentPages[entryPostId] = currentPage;
  }

  return currentPage;
}
