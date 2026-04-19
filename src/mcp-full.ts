/**
 * Read+write variant of the MCP server. Mounted at `/mcp/full`. Inherits the
 * 12 read tools from `MyMCP` and adds 12 write tools that mutate the user's
 * vas3k.club account.
 *
 * Why a separate class / endpoint instead of a global flag:
 *   - Users decide read-vs-read+write at MCP-client-config time (which URL
 *     they paste into Claude Desktop / Cursor), not at deploy time.
 *   - The consent screen at `/authorize` clearly tells the user that this
 *     particular MCP-client wants to use the *full* endpoint (the URL is
 *     surfaced verbatim).
 *
 * Note: this is a UX boundary, not a security boundary. The OAuth token is
 * the same for both endpoints — anyone who got a token can call either. To
 * make read/write a real security boundary you'd add OAuth scopes (`read`
 * vs `read write`) and gate each tool by `this.props.scope`. Defer that
 * until there's a real abuse signal.
 *
 * Write coverage: only the cleanly @api-decorated POST views from upstream
 * (votes, bookmarks, subscriptions, friend, mute, room subscribe/mute,
 * profile-tag toggle). The form-based ones (`create_comment`, `edit_post`,
 * `delete_post`, badge/payment) return HTML+redirects, so wrapping them
 * needs more plumbing — left for a future pass.
 */

import { z } from "zod";

import { MyMCP } from "./mcp";

const COMMENT_ID = z.uuid().describe("Comment UUID (from list_post_comments)");
const SLUG = z.string().describe("URL slug — letters, digits, _ or -");

export class MyMCPFull extends MyMCP {
  // Intentionally do NOT redeclare `server` — inherit the parent's instance
  // so super.init()'s registrations and ours land on the same McpServer.

  async init() {
    // Inherit all read tools first.
    await super.init();

    // ---------- post-level write actions ----------------------------------
    this.server.registerTool(
      "bookmark_post",
      {
        description:
          "Toggle a bookmark on a post. Adding (or removing) a bookmark; same call performs both.",
        inputSchema: { post_slug: SLUG },
      },
      async ({ post_slug }) => this.wrap(() => this.client().bookmarkPost(post_slug)),
    );

    this.server.registerTool(
      "upvote_post",
      {
        description:
          "Upvote a post. Idempotent — calling twice does NOT downvote (use retract_post_vote for that).",
        inputSchema: { post_slug: SLUG },
      },
      async ({ post_slug }) => this.wrap(() => this.client().upvotePost(post_slug)),
    );

    this.server.registerTool(
      "retract_post_vote",
      {
        description: "Retract a previously cast upvote on a post.",
        inputSchema: { post_slug: SLUG },
      },
      async ({ post_slug }) => this.wrap(() => this.client().retractPostVote(post_slug)),
    );

    this.server.registerTool(
      "toggle_post_subscription",
      {
        description: "Subscribe to (or unsubscribe from) notifications for new comments on a post.",
        inputSchema: { post_slug: SLUG },
      },
      async ({ post_slug }) => this.wrap(() => this.client().togglePostSubscription(post_slug)),
    );

    this.server.registerTool(
      "toggle_event_participation",
      {
        description:
          "For posts of type `event`: toggle whether the authenticated user is participating.",
        inputSchema: { post_slug: SLUG },
      },
      async ({ post_slug }) => this.wrap(() => this.client().toggleEventParticipation(post_slug)),
    );

    // ---------- comment-level write actions ------------------------------
    this.server.registerTool(
      "upvote_comment",
      {
        description:
          "Upvote a comment by its UUID. Get the UUID from `list_post_comments`. Idempotent.",
        inputSchema: { comment_id: COMMENT_ID },
      },
      async ({ comment_id }) => this.wrap(() => this.client().upvoteComment(comment_id)),
    );

    this.server.registerTool(
      "retract_comment_vote",
      {
        description: "Retract a previously cast upvote on a comment.",
        inputSchema: { comment_id: COMMENT_ID },
      },
      async ({ comment_id }) => this.wrap(() => this.client().retractCommentVote(comment_id)),
    );

    // ---------- social write actions -------------------------------------
    this.server.registerTool(
      "toggle_friend",
      {
        description:
          "Toggle friendship with another club member. Sends or revokes a friend request.",
        inputSchema: { user_slug: SLUG },
      },
      async ({ user_slug }) => this.wrap(() => this.client().toggleFriend(user_slug)),
    );

    // toggle_mute_user is intentionally absent — see Vas3kClient comment:
    // upstream `users/views/muted.py::toggle_mute` is HTML+email-only,
    // not API-shaped, so a Bearer-authed call always 500s.

    // ---------- rooms ---------------------------------------------------
    this.server.registerTool(
      "subscribe_room",
      {
        description: "Toggle subscription to a room (e.g. `ai`, `apps`). Affects email digests.",
        inputSchema: { room_slug: SLUG },
      },
      async ({ room_slug }) => this.wrap(() => this.client().subscribeRoom(room_slug)),
    );

    this.server.registerTool(
      "mute_room",
      {
        description: "Toggle muting a room. Muted rooms don't appear in the main feed.",
        inputSchema: { room_slug: SLUG },
      },
      async ({ room_slug }) => this.wrap(() => this.client().muteRoom(room_slug)),
    );

    // ---------- profile ------------------------------------------------
    this.server.registerTool(
      "toggle_profile_tag",
      {
        description:
          "Toggle a topical tag on the authenticated user's profile (e.g. `python`, `rust`, `kyiv`).",
        inputSchema: { tag_code: SLUG },
      },
      async ({ tag_code }) => this.wrap(() => this.client().toggleProfileTag(tag_code)),
    );
  }
}
