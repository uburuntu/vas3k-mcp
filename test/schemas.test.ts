/**
 * Direct parse tests for the response schemas.
 *
 * These cover the schema definitions on their own — what shapes are accepted,
 * which fields are required vs optional, what happens with malformed input,
 * and (most importantly) that unknown extras are silently tolerated so a
 * forward-compatible upstream addition won't break the structured-content
 * pipeline at runtime.
 *
 * Contract tests (`test/contract`) cover the same shapes against the live
 * vas3k.club API — those catch upstream removals/renames. Together the two
 * layers form the same drift-detection net the SDK's `validateToolOutput`
 * applies in production.
 */

import { describe, expect, it } from "vitest";

import {
  commentsResponseSchema,
  feedSchema,
  ORDERING_VALUES,
  POST_TYPE_VALUES,
  postResponseSchema,
  postRetractResponseSchema,
  postUpvoteResponseSchema,
  profileTagActionResponseSchema,
  searchTagsResponseSchema,
  searchUsersResponseSchema,
  TAG_GROUP_VALUES,
  toggleActionResponseSchema,
  userAchievementsResponseSchema,
  userBadgesResponseSchema,
  userResponseSchema,
  userTagsResponseSchema,
} from "../src/schemas";

// Minimal valid User payload — the shape User.to_dict emits when called
// without `include_private=True` (no bio/company/etc). Use a real v4 UUID:
// zod 4's `z.uuid()` enforces version + variant nibbles strictly.
const SAMPLE_USER = {
  id: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  slug: "vas3k",
  full_name: "Vas3k",
  avatar: null,
  upvotes: 42,
  created_at: "2020-01-01T00:00:00Z",
  membership_started_at: "2020-01-01T00:00:00Z",
  membership_expires_at: "2030-01-01T00:00:00Z",
  moderation_status: "approved",
  payment_status: "active",
  is_active_member: true,
};

describe("enum mirrors", () => {
  it("TAG_GROUP_VALUES covers all six upstream Tag.GROUPS entries", () => {
    expect(TAG_GROUP_VALUES).toHaveLength(6);
    expect(TAG_GROUP_VALUES).toContain("club");
    expect(TAG_GROUP_VALUES).toContain("tech");
    expect(TAG_GROUP_VALUES).toContain("collectible");
  });

  it("POST_TYPE_VALUES covers the 12 upstream Post.TYPES entries", () => {
    expect(POST_TYPE_VALUES).toHaveLength(12);
    expect(POST_TYPE_VALUES).toContain("post");
    expect(POST_TYPE_VALUES).toContain("event");
    expect(POST_TYPE_VALUES).toContain("weekly_digest");
  });

  it("ORDERING_VALUES covers the seven feed orderings", () => {
    expect(ORDERING_VALUES).toEqual([
      "activity",
      "new",
      "top",
      "top_week",
      "top_month",
      "top_year",
      "hot",
    ]);
  });
});

describe("userResponseSchema", () => {
  it("accepts the minimal User shape", () => {
    const result = userResponseSchema.safeParse({ user: SAMPLE_USER });
    expect(result.success).toBe(true);
  });

  it("accepts the User shape with private fields populated", () => {
    const result = userResponseSchema.safeParse({
      user: {
        ...SAMPLE_USER,
        bio: "hi",
        company: "Acme",
        position: "Engineer",
        city: "Berlin",
        country: "DE",
      },
    });
    expect(result.success).toBe(true);
  });

  it("tolerates unknown extra keys (forward-compat)", () => {
    const result = userResponseSchema.safeParse({
      user: { ...SAMPLE_USER, future_field: "whatever" },
      extra_envelope_key: 123,
    });
    expect(result.success).toBe(true);
  });

  it("rejects a non-UUID id (zod 4 strict version+variant check)", () => {
    const result = userResponseSchema.safeParse({
      user: { ...SAMPLE_USER, id: "11111111-1111-1111-1111-111111111111" },
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(["user", "id"]);
    }
  });

  it("rejects a missing required field (drift catcher)", () => {
    const { is_active_member: _omit, ...userWithoutActive } = SAMPLE_USER;
    const result = userResponseSchema.safeParse({ user: userWithoutActive });
    expect(result.success).toBe(false);
  });

  it("rejects a wrong-typed required field (drift catcher)", () => {
    const result = userResponseSchema.safeParse({
      user: { ...SAMPLE_USER, upvotes: "forty-two" },
    });
    expect(result.success).toBe(false);
  });
});

describe("userTagsResponseSchema", () => {
  it("accepts a partial record keyed by tag group", () => {
    const result = userTagsResponseSchema.safeParse({
      tags: {
        tech: [{ code: "rust", name: "Rust" }],
        hobbies: [{ code: "climbing", name: "Climbing" }],
      },
    });
    expect(result.success).toBe(true);
  });

  it("accepts an empty tag map (member with no tags)", () => {
    const result = userTagsResponseSchema.safeParse({ tags: {} });
    expect(result.success).toBe(true);
  });

  it("rejects an unknown tag group key", () => {
    const result = userTagsResponseSchema.safeParse({
      tags: { not_a_real_group: [{ code: "x", name: "X" }] },
    });
    expect(result.success).toBe(false);
  });
});

describe("userBadgesResponseSchema", () => {
  it("accepts a UserBadge wrapper", () => {
    const result = userBadgesResponseSchema.safeParse({
      user_badges: [
        {
          badge: { code: "lol", title: "LOL", created_at: "2020-01-01" },
          from_user: SAMPLE_USER,
          created_at: "2020-01-01",
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("accepts UserBadge with optional post / comment / note populated", () => {
    const result = userBadgesResponseSchema.safeParse({
      user_badges: [
        {
          badge: { code: "wow", title: "Wow", created_at: "2020-01-01" },
          from_user: SAMPLE_USER,
          created_at: "2020-01-01",
          post: { id: "post-uuid" },
          comment: { id: "comment-uuid" },
          note: "thanks!",
        },
      ],
    });
    expect(result.success).toBe(true);
  });
});

describe("userAchievementsResponseSchema", () => {
  it("accepts a UserAchievement wrapper", () => {
    const result = userAchievementsResponseSchema.safeParse({
      user_achievements: [
        {
          achievement: { code: "anniversary_1", name: "1 Year" },
          created_at: "2021-01-01",
        },
      ],
    });
    expect(result.success).toBe(true);
  });
});

// ---------- posts ----------

const SAMPLE_POST_ITEM = {
  id: "https://example.invalid/post/hello/",
  url: "https://example.invalid/post/hello/",
  title: "Hello",
  content_text: "body",
  date_published: "2026-04-19T00:00:00Z",
  date_modified: null,
  authors: [{ name: "Vas3k", url: "https://example.invalid/user/vas3k/", avatar: null }],
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

describe("postResponseSchema", () => {
  it("accepts a JSON Feed entry with the _club extension", () => {
    const result = postResponseSchema.safeParse({ post: SAMPLE_POST_ITEM });
    expect(result.success).toBe(true);
  });

  it("accepts a private post (content_text = '🔒')", () => {
    const result = postResponseSchema.safeParse({
      post: {
        ...SAMPLE_POST_ITEM,
        content_text: "🔒",
        _club: { ...SAMPLE_POST_ITEM._club, is_public: false },
      },
    });
    expect(result.success).toBe(true);
  });

  it("rejects a malformed url", () => {
    const result = postResponseSchema.safeParse({
      post: { ...SAMPLE_POST_ITEM, url: "not-a-url" },
    });
    expect(result.success).toBe(false);
  });
});

describe("commentsResponseSchema", () => {
  it("accepts a list of Comments with their authors", () => {
    const result = commentsResponseSchema.safeParse({
      comments: [
        {
          id: "8e3a73b9-31fc-4abc-8a7e-1c3a40e5d6f2",
          url: "https://example.invalid/post/hello/#c",
          text: "+1",
          author: SAMPLE_USER,
          reply_to_id: null,
          upvotes: 1,
          created_at: "2026-04-19T00:00:00Z",
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("accepts an empty comments array (post with no replies yet)", () => {
    expect(commentsResponseSchema.safeParse({ comments: [] }).success).toBe(true);
  });
});

// ---------- feed ----------

describe("feedSchema", () => {
  it("accepts a JSON Feed 1.1 page", () => {
    const result = feedSchema.safeParse({
      version: "https://jsonfeed.org/version/1.1",
      title: "vas3k.club",
      home_page_url: "https://example.invalid/",
      feed_url: "https://example.invalid/feed.json",
      next_url: "https://example.invalid/feed.json?page=2",
      items: [SAMPLE_POST_ITEM],
    });
    expect(result.success).toBe(true);
  });

  it("treats next_url as optional (last page)", () => {
    const result = feedSchema.safeParse({
      version: "https://jsonfeed.org/version/1.1",
      title: "vas3k.club",
      home_page_url: "https://example.invalid/",
      feed_url: "https://example.invalid/feed.json?page=99",
      items: [],
    });
    expect(result.success).toBe(true);
  });
});

// ---------- search ----------

describe("searchUsersResponseSchema", () => {
  it("accepts a list of {slug, full_name}", () => {
    const result = searchUsersResponseSchema.safeParse({
      users: [{ slug: "vas3k", full_name: "Vas3k" }],
    });
    expect(result.success).toBe(true);
  });
});

describe("searchTagsResponseSchema", () => {
  it("accepts a Tag list with code/group/name/color", () => {
    const result = searchTagsResponseSchema.safeParse({
      tags: [{ code: "rust", group: "tech", name: "Rust", color: "#fa0" }],
    });
    expect(result.success).toBe(true);
  });

  it("tolerates unknown extra keys per tag (looseObject)", () => {
    const result = searchTagsResponseSchema.safeParse({
      tags: [
        {
          code: "rust",
          group: "tech",
          name: "Rust",
          color: "#fa0",
          new_field: "future-flag",
        },
      ],
    });
    expect(result.success).toBe(true);
  });
});

// ---------- write actions ----------

describe("toggleActionResponseSchema", () => {
  it("accepts {status: 'created'}", () => {
    expect(toggleActionResponseSchema.safeParse({ status: "created" }).success).toBe(true);
  });

  it("accepts {status: 'deleted'}", () => {
    expect(toggleActionResponseSchema.safeParse({ status: "deleted" }).success).toBe(true);
  });

  it("rejects an unknown status value (drift catcher)", () => {
    expect(toggleActionResponseSchema.safeParse({ status: "toggled" }).success).toBe(false);
  });
});

describe("postUpvoteResponseSchema", () => {
  it("accepts the upvote shape with non-zero timestamp", () => {
    const result = postUpvoteResponseSchema.safeParse({
      post: { upvotes: 7 },
      upvoted_timestamp: 1700000000000,
    });
    expect(result.success).toBe(true);
  });

  it("accepts upvoted_timestamp = 0 (no-op when already upvoted)", () => {
    const result = postUpvoteResponseSchema.safeParse({
      post: { upvotes: 7 },
      upvoted_timestamp: 0,
    });
    expect(result.success).toBe(true);
  });
});

describe("postRetractResponseSchema", () => {
  it("accepts {success:true, post:{upvotes}}", () => {
    expect(
      postRetractResponseSchema.safeParse({
        success: true,
        post: { upvotes: 6 },
      }).success,
    ).toBe(true);
  });

  it("accepts success:false (no vote to retract)", () => {
    expect(
      postRetractResponseSchema.safeParse({
        success: false,
        post: { upvotes: 6 },
      }).success,
    ).toBe(true);
  });
});

describe("profileTagActionResponseSchema", () => {
  it("accepts the toggle status plus the affected tag record", () => {
    const result = profileTagActionResponseSchema.safeParse({
      status: "created",
      tag: { code: "rust", name: "Rust", color: "#fa0" },
    });
    expect(result.success).toBe(true);
  });
});
