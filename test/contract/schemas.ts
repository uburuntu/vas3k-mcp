/**
 * Runtime contracts for vas3k.club JSON responses.
 *
 * Each schema asserts the *minimum* shape we rely on — extra fields are fine
 * (we use `passthrough()` semantics by default in zod). When vas3k.club
 * removes or renames a field, the integration tests fail loudly.
 *
 * Source of truth for these shapes:
 *   - users:    reference/users/models/user.py        :: User.to_dict
 *   - posts:    reference/posts/models/post.py        :: Post.to_dict
 *   - comments: reference/comments/models.py          :: Comment.to_dict
 *   - feed:     reference/posts/api.py                :: json_feed
 *   - tags:     reference/tags/models.py              :: Tag.GROUPS
 */

import { z } from "zod";

// Mirror of upstream's `Tag.GROUPS` (reference/tags/models.py:17-24) and the
// `allowed_groups` whitelist used by `api_profile_tags`
// (reference/users/api.py:45). Exported for reuse in `mcp.ts` so the two
// definitions of "tag group" can't drift.
export const TAG_GROUP_VALUES = [
  "club",
  "tech",
  "hobbies",
  "personal",
  "collectible",
  "other",
] as const;

// ---------- user ----------
export const userSchema = z.object({
  // Django UUIDField → str(uuid) via JsonResponse. zod 4 idiom is `z.uuid()`
  // (top-level), no longer `z.string().uuid()`.
  id: z.uuid(),
  slug: z.string(),
  full_name: z.string(),
  avatar: z.string().nullable(),
  // `bio`, `company`, `position` are only emitted when `User.to_dict` is
  // called with `include_private=True`, which depends on the OAuth token
  // having the `contact` scope (reference/users/api.py:30-32). For non-self
  // users without that scope, these fields are missing rather than null.
  bio: z.string().nullable().optional(),
  upvotes: z.number().int(),
  created_at: z.string(),
  membership_started_at: z.string(),
  membership_expires_at: z.string(),
  moderation_status: z.string(),
  payment_status: z.string(),
  company: z.string().nullable().optional(),
  position: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  country: z.string().nullable().optional(),
  is_active_member: z.boolean(),
});

export const userResponseSchema = z.object({ user: userSchema });

// ---------- tags / badges / achievements ----------
// Upstream guarantees the keys are one of `TAG_GROUP_VALUES`. Use a partial
// record because `api_profile_tags` only emits a key when the user has at
// least one tag in that group (reference/users/api.py:49-56).
export const userTagsResponseSchema = z.object({
  tags: z.partialRecord(
    z.enum(TAG_GROUP_VALUES),
    z.array(z.object({ code: z.string(), name: z.string() })),
  ),
});

export const userBadgesResponseSchema = z.object({
  user_badges: z.array(z.unknown()),
});

export const userAchievementsResponseSchema = z.object({
  user_achievements: z.array(z.unknown()),
});

// ---------- posts ----------
export const postItemSchema = z.object({
  id: z.string(),
  url: z.url(),
  title: z.string(),
  content_text: z.string(),
  date_published: z.string().nullable(),
  date_modified: z.string().nullable(),
  authors: z.array(
    z.object({
      name: z.string(),
      url: z.url(),
      avatar: z.string().nullable(),
    }),
  ),
  _club: z.object({
    type: z.string(),
    slug: z.string(),
    comment_count: z.number().int(),
    view_count: z.number().int(),
    upvotes: z.number().int(),
    is_public: z.boolean(),
    is_commentable: z.boolean(),
  }),
});

export const postResponseSchema = z.object({ post: postItemSchema });

// ---------- comments ----------
export const commentSchema = z.object({
  id: z.string(),
  url: z.url(),
  text: z.string(),
  author: userSchema,
  reply_to_id: z.string().nullable(),
  upvotes: z.number().int(),
  created_at: z.string(),
});

export const commentsResponseSchema = z.object({
  comments: z.array(commentSchema),
});

// ---------- feed (JSON Feed 1.1) ----------
// Upstream always emits `next_url` (reference/posts/api.py:65-74) — declare
// it so the contract tests cover it and surface drift.
export const feedSchema = z.object({
  version: z.string(),
  title: z.string(),
  home_page_url: z.url(),
  feed_url: z.url(),
  next_url: z.url().optional(),
  items: z.array(postItemSchema),
});

// ---------- search ----------
export const searchUsersResponseSchema = z.object({
  users: z.array(z.object({ slug: z.string(), full_name: z.string() })),
});

// Upstream `Tag.to_dict` (reference/tags/models.py:40-46) emits
// {code, group, name, color}. Keep `looseObject` so additional fields don't
// break the contract test, but tighten the known shape.
export const searchTagsResponseSchema = z.object({
  tags: z.array(
    z.looseObject({
      code: z.string(),
      group: z.string(),
      name: z.string(),
      color: z.string(),
    }),
  ),
});
