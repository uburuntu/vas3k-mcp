/**
 * Shared test fixtures — canned upstream payloads + tiny Response helpers,
 * imported by `mcp-e2e`, `schemas`, and (where useful) the unit suites.
 *
 * Use real v4 UUIDs: zod 4's `z.uuid()` enforces version + variant nibbles
 * (third group must start with 1-8, fourth with 8/9/a/b), so the lazy
 * all-1s pattern fails validation.
 */

export const BASE_URL = "https://example.invalid";

export const SAMPLE_USER = {
  id: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  slug: "vas3k",
  full_name: "Vas3k",
  avatar: "https://example.invalid/a.png",
  upvotes: 42,
  created_at: "2020-01-01T00:00:00Z",
  membership_started_at: "2020-01-01T00:00:00Z",
  membership_expires_at: "2030-01-01T00:00:00Z",
  moderation_status: "approved",
  payment_status: "active",
  is_active_member: true,
  bio: "hi",
};

export const SAMPLE_POST_ITEM = {
  id: `${BASE_URL}/post/hello/`,
  url: `${BASE_URL}/post/hello/`,
  title: "Hello",
  content_text: "body",
  date_published: "2026-04-19T00:00:00Z",
  date_modified: null,
  authors: [{ name: "Vas3k", url: `${BASE_URL}/user/vas3k/`, avatar: null }],
  _club: {
    type: "post",
    slug: "hello",
    comment_count: 0,
    view_count: 1,
    upvotes: 0,
    is_public: true,
    is_commentable: true,
  },
};

export const SAMPLE_FEED = {
  version: "https://jsonfeed.org/version/1.1",
  title: "vas3k.club",
  home_page_url: `${BASE_URL}/`,
  feed_url: `${BASE_URL}/feed.json`,
  items: [SAMPLE_POST_ITEM],
};

export const SAMPLE_COMMENT_UUID = "8e3a73b9-31fc-4abc-8a7e-1c3a40e5d6f2";

export const SAMPLE_COMMENT = {
  id: SAMPLE_COMMENT_UUID,
  url: `${BASE_URL}/post/hello/#c`,
  text: "+1",
  author: SAMPLE_USER,
  reply_to_id: null,
  upvotes: 1,
  created_at: "2026-04-19T00:00:00Z",
};

export function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { "content-type": "application/json", ...(init.headers ?? {}) },
  });
}

export function textResponse(body: string, contentType = "text/plain") {
  return new Response(body, {
    status: 200,
    headers: { "content-type": contentType },
  });
}
