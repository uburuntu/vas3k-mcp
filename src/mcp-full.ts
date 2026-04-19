/**
 * Read+write variant of the MCP server. Mounted at `/mcp-full`. Inherits the
 * read tools from `MyMCP` and adds write tools that mutate the user's
 * vas3k.club account.
 *
 * Why a separate class / endpoint instead of a global flag:
 *   - Users decide read-vs-read+write at MCP-client-config time (which URL
 *     they paste into Claude Desktop / Cursor), not at deploy time.
 *   - The consent screen at `/authorize` clearly tells the user that this
 *     particular MCP-client wants to use the *full* endpoint (the URL is
 *     surfaced verbatim).
 *
 * Defence in depth: every write tool also goes through `writeClient()`,
 * which 403s when the granted MCP-side scope set doesn't include `write`.
 * Today most MCP clients request the full set by default, so the check is
 * usually a no-op — but a security-conscious client (or future tightening
 * of the consent UI) can drop `write` and the boundary holds.
 *
 * Write coverage: only the cleanly @api-decorated POST views from upstream
 * (votes, bookmarks, subscriptions, friend, mute, room subscribe/mute,
 * profile-tag toggle). The form-based ones (`create_comment`, `edit_post`,
 * `delete_post`, badge/payment) return HTML+redirects, so wrapping them
 * needs more plumbing — left for a future pass.
 */

import { z } from "zod";

import { MyMCP } from "./mcp";
import { Vas3kAPIError } from "./vas3k-client";

const COMMENT_ID = z.uuid().describe("Comment UUID (from list_post_comments)");
const SLUG = z.string().describe("URL slug — letters, digits, _ or -");

/** MCP annotations for write tools. None destructive (every action is
 * reversible via its toggle/retract counterpart); openWorldHint:true since
 * the call hits upstream vas3k.club. */
const WRITE_ANNOTATIONS = {
  readOnlyHint: false,
  destructiveHint: false,
  openWorldHint: true,
} as const;

/** Idempotent variants — upvote/retract are setters, not toggles. */
const WRITE_ANNOTATIONS_IDEMPOTENT = {
  ...WRITE_ANNOTATIONS,
  idempotentHint: true,
} as const;

export class MyMCPFull extends MyMCP {
  // Intentionally do NOT redeclare `server` — inherit the parent's instance
  // so super.init()'s registrations and ours land on the same McpServer.

  /**
   * Like `client()`, but additionally enforces that the current session was
   * granted the `write` MCP-side scope. Use this from every write-tool
   * handler instead of `client()`. Today most MCP clients request the full
   * scope set so the check is a no-op for them — but a security-conscious
   * client (or future tightening of the consent UI) can drop `write` and
   * the boundary will hold.
   */
  protected writeClient(): ReturnType<MyMCP["client"]> {
    const scopes = this.props?.mcpScopes;
    if (!scopes?.includes("write")) {
      throw new Vas3kAPIError(403, {
        error: "missing_scope",
        error_description: "this tool requires the `write` MCP scope",
      });
    }
    return this.client();
  }

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
        annotations: WRITE_ANNOTATIONS,
      },
      async ({ post_slug }) => this.wrap(() => this.writeClient().bookmarkPost(post_slug)),
    );

    this.server.registerTool(
      "upvote_post",
      {
        description:
          "Upvote a post. Idempotent — calling twice does NOT downvote (use retract_post_vote for that).",
        inputSchema: { post_slug: SLUG },
        annotations: WRITE_ANNOTATIONS_IDEMPOTENT,
      },
      async ({ post_slug }) => this.wrap(() => this.writeClient().upvotePost(post_slug)),
    );

    this.server.registerTool(
      "retract_post_vote",
      {
        description: "Retract a previously cast upvote on a post.",
        inputSchema: { post_slug: SLUG },
        annotations: WRITE_ANNOTATIONS_IDEMPOTENT,
      },
      async ({ post_slug }) => this.wrap(() => this.writeClient().retractPostVote(post_slug)),
    );

    this.server.registerTool(
      "toggle_post_subscription",
      {
        description: "Subscribe to (or unsubscribe from) notifications for new comments on a post.",
        inputSchema: { post_slug: SLUG },
        annotations: WRITE_ANNOTATIONS,
      },
      async ({ post_slug }) =>
        this.wrap(() => this.writeClient().togglePostSubscription(post_slug)),
    );

    this.server.registerTool(
      "toggle_event_participation",
      {
        description:
          "For posts of type `event`: toggle whether the authenticated user is participating.",
        inputSchema: { post_slug: SLUG },
        annotations: WRITE_ANNOTATIONS,
      },
      async ({ post_slug }) =>
        this.wrap(() => this.writeClient().toggleEventParticipation(post_slug)),
    );

    // ---------- comment-level write actions ------------------------------
    this.server.registerTool(
      "upvote_comment",
      {
        description:
          "Upvote a comment by its UUID. Get the UUID from `list_post_comments`. Idempotent.",
        inputSchema: { comment_id: COMMENT_ID },
        annotations: WRITE_ANNOTATIONS_IDEMPOTENT,
      },
      async ({ comment_id }) => this.wrap(() => this.writeClient().upvoteComment(comment_id)),
    );

    this.server.registerTool(
      "retract_comment_vote",
      {
        description: "Retract a previously cast upvote on a comment.",
        inputSchema: { comment_id: COMMENT_ID },
        annotations: WRITE_ANNOTATIONS_IDEMPOTENT,
      },
      async ({ comment_id }) => this.wrap(() => this.writeClient().retractCommentVote(comment_id)),
    );

    // ---------- social write actions -------------------------------------
    this.server.registerTool(
      "toggle_friend",
      {
        description:
          "Toggle friendship with another club member. Sends or revokes a friend request.",
        inputSchema: { user_slug: SLUG },
        annotations: WRITE_ANNOTATIONS,
      },
      async ({ user_slug }) => this.wrap(() => this.writeClient().toggleFriend(user_slug)),
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
        annotations: WRITE_ANNOTATIONS,
      },
      async ({ room_slug }) => this.wrap(() => this.writeClient().subscribeRoom(room_slug)),
    );

    this.server.registerTool(
      "mute_room",
      {
        description: "Toggle muting a room. Muted rooms don't appear in the main feed.",
        inputSchema: { room_slug: SLUG },
        annotations: WRITE_ANNOTATIONS,
      },
      async ({ room_slug }) => this.wrap(() => this.writeClient().muteRoom(room_slug)),
    );

    // ---------- profile ------------------------------------------------
    this.server.registerTool(
      "toggle_profile_tag",
      {
        description:
          "Toggle a topical tag on the authenticated user's profile (e.g. `python`, `rust`, `kyiv`).",
        inputSchema: { tag_code: SLUG },
        annotations: WRITE_ANNOTATIONS,
      },
      async ({ tag_code }) => this.wrap(() => this.writeClient().toggleProfileTag(tag_code)),
    );
  }
}
