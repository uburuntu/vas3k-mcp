/**
 * Contract tests against a real vas3k.club instance.
 *
 * These hit the live API (default: a locally-spun docker-compose stack at
 * http://localhost:8000) and assert that responses match the zod schemas in
 * `./schemas.ts`. They're the canary that warns us when vas3k.club's JSON
 * shape drifts from what our `Vas3kClient` and `MyMCP` tools assume.
 *
 * Skipped automatically when `VAS3K_SERVICE_TOKEN` isn't set so unit-test
 * runs (PRs from forks, local quick checks) stay green.
 *
 * Run locally against your own dev stack:
 *
 *     # one-off bootstrap to mint a service token in your local Django
 *     docker compose up -d   # in your vas3k.club checkout
 *     export VAS3K_BASE_URL=http://localhost:8000
 *     export VAS3K_SERVICE_TOKEN=st_...
 *     pnpm test
 */

import { describe, expect, it } from "vitest";

import { Vas3kAPIError, Vas3kClient } from "../../src/vas3k-client";
import {
  commentsResponseSchema,
  feedSchema,
  postResponseSchema,
  searchTagsResponseSchema,
  searchUsersResponseSchema,
  userAchievementsResponseSchema,
  userBadgesResponseSchema,
  userResponseSchema,
  userTagsResponseSchema,
} from "./schemas";

const baseUrl = process.env.VAS3K_BASE_URL ?? "http://localhost:8000";
const serviceToken = process.env.VAS3K_SERVICE_TOKEN;

if (!serviceToken) {
  // Make the skip visible in CI logs so a missing secret doesn't masquerade
  // as a green "all contract checks passed" run.
  console.warn(
    "[contract] Skipped: VAS3K_SERVICE_TOKEN unset — set it in CI to run live contract checks.",
  );
}

describe.skipIf(!serviceToken)("vas3k.club contract @ %s".replace("%s", baseUrl), () => {
  const client = new Vas3kClient({ baseUrl, serviceToken });

  it("get_me returns a user matching userSchema", async () => {
    const data = await client.getMe();
    const parsed = userResponseSchema.safeParse(data);
    if (!parsed.success) throw new Error(JSON.stringify(parsed.error.issues, null, 2));
    expect(parsed.data.user.slug).toBeTruthy();
  });

  it("get_user_tags returns a tags map", async () => {
    const me = userResponseSchema.parse(await client.getMe());
    const data = await client.getUserTags(me.user.slug);
    expect(userTagsResponseSchema.safeParse(data).success).toBe(true);
  });

  // Marked `.fails` because vas3k.club@master has a regression in
  // `users/api.py:71` — it does `UserBadge.objects.filter(user=user)` but
  // the model only has `from_user` and `to_user` (no `user` field). Every
  // call to `/user/<slug>/badges.json` returns Django FieldError 400.
  // When upstream patches the filter (likely `to_user=user`), this test
  // will start passing — vitest then fails it, alerting us to flip back
  // to plain `it()`. Bug report: https://github.com/vas3k/vas3k.club/issues
  it.fails("get_user_badges returns a badges array", async () => {
    const me = userResponseSchema.parse(await client.getMe());
    const data = await client.getUserBadges(me.user.slug);
    expect(userBadgesResponseSchema.safeParse(data).success).toBe(true);
  });

  it("get_user_achievements returns an achievements array", async () => {
    const me = userResponseSchema.parse(await client.getMe());
    const data = await client.getUserAchievements(me.user.slug);
    expect(userAchievementsResponseSchema.safeParse(data).success).toBe(true);
  });

  it("get_feed returns a JSON Feed", async () => {
    const data = await client.getFeed();
    const parsed = feedSchema.safeParse(data);
    if (!parsed.success) throw new Error(JSON.stringify(parsed.error.issues, null, 2));
    expect(parsed.data.version).toMatch(/jsonfeed\.org/);
  });

  it("get_post + list_post_comments work for the first feed item", async () => {
    const feed = feedSchema.parse(await client.getFeed());
    if (feed.items.length === 0) return; // empty fresh stack — nothing to test

    const first = feed.items[0]!;
    const post = await client.getPost(first._club.type, first._club.slug);
    const parsedPost = postResponseSchema.safeParse(post);
    if (!parsedPost.success) throw new Error(JSON.stringify(parsedPost.error.issues, null, 2));

    const comments = await client.listPostComments(first._club.type, first._club.slug);
    const parsedComments = commentsResponseSchema.safeParse(comments);
    if (!parsedComments.success)
      throw new Error(JSON.stringify(parsedComments.error.issues, null, 2));
  });

  it("search_users tolerates short prefixes", async () => {
    const data = await client.searchUsers("dev");
    expect(searchUsersResponseSchema.safeParse(data).success).toBe(true);
  });

  it("search_tags returns tags with prefix filter", async () => {
    const data = await client.searchTags({ prefix: "dev" });
    expect(searchTagsResponseSchema.safeParse(data).success).toBe(true);
  });

  it("propagates 404s as Vas3kAPIError", async () => {
    await expect(client.getUser("__definitely_not_a_real_user__")).rejects.toBeInstanceOf(
      Vas3kAPIError,
    );
  });

  // ---- write tools (the /mcp-full surface) -------------------------------
  // Each test below restores state by toggling twice or by calling retract,
  // so the fixture state is the same after the suite as before.
  // Skipped per-test if the corresponding fixture env var isn't set, so
  // running against production by mistake doesn't mutate real data.

  const postSlug = process.env.VAS3K_TEST_POST_SLUG;
  const roomSlug = process.env.VAS3K_TEST_ROOM_SLUG;
  const friendSlug = process.env.VAS3K_TEST_FRIEND_SLUG;

  it.skipIf(!postSlug)("upvote_post + retract_post_vote round-trip", async () => {
    await client.upvotePost(postSlug!);
    await client.retractPostVote(postSlug!);
  });

  it.skipIf(!postSlug)("bookmark_post toggles cleanly twice", async () => {
    await client.bookmarkPost(postSlug!); // on
    await client.bookmarkPost(postSlug!); // off — back to baseline
  });

  it.skipIf(!postSlug)("toggle_post_subscription toggles cleanly twice", async () => {
    await client.togglePostSubscription(postSlug!);
    await client.togglePostSubscription(postSlug!);
  });

  it.skipIf(!roomSlug)("subscribe_room toggles cleanly twice", async () => {
    await client.subscribeRoom(roomSlug!);
    await client.subscribeRoom(roomSlug!);
  });

  it.skipIf(!roomSlug)("mute_room toggles cleanly twice", async () => {
    await client.muteRoom(roomSlug!);
    await client.muteRoom(roomSlug!);
  });

  it.skipIf(!friendSlug)("toggle_friend toggles cleanly twice", async () => {
    await client.toggleFriend(friendSlug!);
    await client.toggleFriend(friendSlug!);
  });

  it("invalid post slug rejects before fetch (slug validation)", () => {
    // assertSlug throws synchronously, before the call returns a Promise.
    // `expect(...).rejects` would only see Promise rejections, so wrap.
    expect(() => client.upvotePost("../etc/passwd")).toThrow(Vas3kAPIError);
  });
});
