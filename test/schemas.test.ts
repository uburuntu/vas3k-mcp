/**
 * Direct parse tests for the response schemas.
 *
 * Covers what each *ResponseSchema accepts/rejects on its own — the SDK's
 * `validateToolOutput` in production and the `test/contract` suite against
 * the live API form the other two layers of the same drift-detection net.
 */

import { describe, expect, it } from "vitest";
import type { ZodType } from "zod";

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
import { SAMPLE_COMMENT_UUID, SAMPLE_POST_ITEM, SAMPLE_USER } from "./fixtures";

const accepts = (schema: ZodType, value: unknown) =>
  expect(schema.safeParse(value).success).toBe(true);
const rejects = (schema: ZodType, value: unknown) =>
  expect(schema.safeParse(value).success).toBe(false);

// ---------- enum mirrors ----------

it("enum mirrors match upstream definitions", () => {
  expect(TAG_GROUP_VALUES).toEqual(["club", "tech", "hobbies", "personal", "collectible", "other"]);
  expect(POST_TYPE_VALUES).toHaveLength(12);
  expect(POST_TYPE_VALUES).toContain("weekly_digest");
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

// ---------- userResponseSchema ----------

describe("userResponseSchema", () => {
  it.each([
    ["minimal User shape", { user: SAMPLE_USER }],
    [
      "User with private fields populated",
      {
        user: {
          ...SAMPLE_USER,
          bio: "hi",
          company: "Acme",
          position: "Engineer",
          city: "Berlin",
          country: "DE",
        },
      },
    ],
    [
      "unknown extras at every level (forward-compat)",
      { user: { ...SAMPLE_USER, future_field: "x" }, envelope_extra: 1 },
    ],
  ])("accepts %s", (_, v) => accepts(userResponseSchema, v));

  it.each([
    ["non-UUID id", { user: { ...SAMPLE_USER, id: "11111111-1111-1111-1111-111111111111" } }],
    [
      "missing required field",
      (() => {
        const { is_active_member: _omit, ...u } = SAMPLE_USER;
        return { user: u };
      })(),
    ],
    ["wrong-typed required field", { user: { ...SAMPLE_USER, upvotes: "forty-two" } }],
  ])("rejects %s", (_, v) => rejects(userResponseSchema, v));

  it("path of UUID rejection points at user.id", () => {
    const r = userResponseSchema.safeParse({
      user: { ...SAMPLE_USER, id: "not-a-uuid" },
    });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0]?.path).toEqual(["user", "id"]);
  });
});

// ---------- user/<slug>/tags ----------

describe("userTagsResponseSchema", () => {
  it.each([
    ["partial record by group", { tags: { tech: [{ code: "rust", name: "Rust" }] } }],
    ["empty tag map", { tags: {} }],
  ])("accepts %s", (_, v) => accepts(userTagsResponseSchema, v));

  it("rejects unknown tag group keys", () =>
    rejects(userTagsResponseSchema, { tags: { not_a_real_group: [] } }));
});

// ---------- badges / achievements ----------

it("userBadgesResponseSchema accepts the wrapper, optional post/comment/note", () => {
  const badge = { code: "lol", title: "LOL", created_at: "2020" };
  accepts(userBadgesResponseSchema, {
    user_badges: [{ badge, from_user: SAMPLE_USER, created_at: "2020" }],
  });
  accepts(userBadgesResponseSchema, {
    user_badges: [
      {
        badge,
        from_user: SAMPLE_USER,
        created_at: "2020",
        post: { id: "p" },
        comment: { id: "c" },
        note: "thanks",
      },
    ],
  });
});

it("userAchievementsResponseSchema accepts the wrapper", () =>
  accepts(userAchievementsResponseSchema, {
    user_achievements: [{ achievement: { code: "anniv_1", name: "1 Year" }, created_at: "2021" }],
  }));

// ---------- posts ----------

describe("postResponseSchema", () => {
  it("accepts a JSON Feed entry with the _club extension", () =>
    accepts(postResponseSchema, { post: SAMPLE_POST_ITEM }));

  it("accepts a private post (content_text = 🔒)", () =>
    accepts(postResponseSchema, {
      post: {
        ...SAMPLE_POST_ITEM,
        content_text: "🔒",
        _club: { ...SAMPLE_POST_ITEM._club, is_public: false },
      },
    }));

  it("rejects a malformed url", () =>
    rejects(postResponseSchema, { post: { ...SAMPLE_POST_ITEM, url: "not-a-url" } }));
});

// ---------- comments ----------

describe("commentsResponseSchema", () => {
  it("accepts a list of Comments with their authors", () =>
    accepts(commentsResponseSchema, {
      comments: [
        {
          id: SAMPLE_COMMENT_UUID,
          url: "https://example.invalid/c",
          text: "+1",
          author: SAMPLE_USER,
          reply_to_id: null,
          upvotes: 1,
          created_at: "2026",
        },
      ],
    }));

  it("accepts an empty comments array", () => accepts(commentsResponseSchema, { comments: [] }));
});

// ---------- feed ----------

describe("feedSchema", () => {
  const base = {
    version: "https://jsonfeed.org/version/1.1",
    title: "vas3k.club",
    home_page_url: "https://example.invalid/",
    feed_url: "https://example.invalid/feed.json",
    items: [SAMPLE_POST_ITEM],
  };

  it("accepts a JSON Feed page with next_url", () =>
    accepts(feedSchema, { ...base, next_url: "https://example.invalid/feed.json?page=2" }));

  it("treats next_url as optional (last page)", () => accepts(feedSchema, base));
});

// ---------- search ----------

it("searchUsersResponseSchema accepts {slug, full_name}[]", () =>
  accepts(searchUsersResponseSchema, { users: [{ slug: "vas3k", full_name: "Vas3k" }] }));

describe("searchTagsResponseSchema", () => {
  it("accepts the canonical Tag shape", () =>
    accepts(searchTagsResponseSchema, {
      tags: [{ code: "rust", group: "tech", name: "Rust", color: "#fa0" }],
    }));

  it("tolerates unknown extras per tag (looseObject)", () =>
    accepts(searchTagsResponseSchema, {
      tags: [{ code: "rust", group: "tech", name: "Rust", color: "#fa0", future_flag: "x" }],
    }));
});

// ---------- write actions ----------

describe("toggleActionResponseSchema", () => {
  it.each([["created"], ["deleted"]])("accepts status=%s", (s) =>
    accepts(toggleActionResponseSchema, { status: s }));
  it("rejects unknown status", () => rejects(toggleActionResponseSchema, { status: "toggled" }));
});

it("postUpvoteResponseSchema accepts both timestamp=N and timestamp=0 (no-op)", () => {
  accepts(postUpvoteResponseSchema, {
    post: { upvotes: 7 },
    upvoted_timestamp: 1700000000000,
  });
  accepts(postUpvoteResponseSchema, {
    post: { upvotes: 7 },
    upvoted_timestamp: 0,
  });
});

it("postRetractResponseSchema accepts success true|false", () => {
  accepts(postRetractResponseSchema, { success: true, post: { upvotes: 6 } });
  accepts(postRetractResponseSchema, { success: false, post: { upvotes: 6 } });
});

it("profileTagActionResponseSchema accepts toggle status + tag record", () =>
  accepts(profileTagActionResponseSchema, {
    status: "created",
    tag: { code: "rust", name: "Rust", color: "#fa0" },
  }));
