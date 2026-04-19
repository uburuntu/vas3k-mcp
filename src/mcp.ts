/**
 * MCP server class. Tools delegate to {@link Vas3kClient} which is constructed
 * lazily per call using the per-session `upstreamAccessToken` from
 * {@link Props} that the OAuthProvider hands us via `this.props`.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { McpAgent } from "agents/mcp";
import { z } from "zod";

import type { Env, Props } from "./types";
import { Vas3kAPIError, Vas3kClient } from "./vas3k-client";

// Canonical list mirrors the upstream Django enum at
// reference/posts/models/post.py:24-49 (Post.TYPES). Keep in sync.
const POST_TYPE_VALUES = [
  "post",
  "intro",
  "link",
  "question",
  "idea",
  "project",
  "event",
  "battle",
  "weekly_digest",
  "guide",
  "thread",
  "docs",
] as const;

const POST_TYPE = z.enum(POST_TYPE_VALUES).describe("Club post type");

const FEED_POST_TYPE = z
  .enum(["all", ...POST_TYPE_VALUES])
  .default("all")
  .describe("Feed post type filter, or 'all' for the global feed");

const ORDERING = z
  .enum(["activity", "new", "top", "top_week", "top_month", "top_year", "hot"])
  .describe("Feed ordering");

const TAG_GROUP = z
  .enum(["club", "tech", "hobbies", "personal", "collectible", "other"])
  .describe("Profile-tag group");

/**
 * Strip any bearer-token-shaped or session-token-shaped substring from text
 * before sending it to the LLM. Defence against the rare case where vas3k.club
 * echoes the Authorization header in an error body (security review P2-2).
 */
function redactSecrets(s: string): string {
  return s
    .replace(/Bearer\s+\S+/gi, "Bearer [REDACTED]")
    .replace(/\b(st|sa)_\S+/g, "$1_[REDACTED]");
}

export class MyMCP extends McpAgent<Env, Record<string, never>, Props> {
  server = new McpServer({ name: "vas3k-club", version: "0.1.0" });

  protected client(): Vas3kClient {
    // OAuthProvider should populate `props` for any request that reaches an
    // apiHandler-mounted tool. Guard anyway so a revoked token surfaces as a
    // structured error rather than a runtime TypeError (code review P2-4).
    if (!this.props) {
      throw new Vas3kAPIError(401, {
        error: "no props — token revoked or upstream session expired",
      });
    }
    return new Vas3kClient({
      baseUrl: this.env.VAS3K_BASE_URL,
      accessToken: this.props.upstreamAccessToken,
    });
  }

  protected async wrap<T>(fn: () => Promise<T>) {
    try {
      const data = await fn();
      const text = typeof data === "string" ? data : JSON.stringify(data);
      return { content: [{ type: "text" as const, text }] };
    } catch (err) {
      if (err instanceof Vas3kAPIError) {
        const hint =
          err.status === 401
            ? " (token expired — try again after refresh)"
            : err.status === 403
              ? " (your account does not have access)"
              : err.status === 404
                ? " (not found — check the slug)"
                : err.status === 429
                  ? " (rate limited)"
                  : "";
        const payload = redactSecrets(JSON.stringify(err.payload).slice(0, 500));
        return {
          isError: true,
          content: [
            {
              type: "text" as const,
              text: `vas3k.club returned ${err.status}${hint}: ${payload}`,
            },
          ],
        };
      }
      const e = err as Error;
      console.error("[mcp tool failure]", e.name, e.message, e.stack);
      return {
        isError: true,
        content: [
          {
            type: "text" as const,
            text: `Unexpected error (${e.name}): ${e.message}`,
          },
        ],
      };
    }
  }

  async init() {
    this.server.registerTool(
      "get_me",
      { description: "Return the profile of the authenticated club member.", inputSchema: {} },
      async () => this.wrap(() => this.client().getMe()),
    );

    this.server.registerTool(
      "get_user",
      {
        description: "Return a club member's profile by slug (the URL handle, e.g. 'vas3k').",
        inputSchema: { slug: z.string() },
      },
      async ({ slug }) => this.wrap(() => this.client().getUser(slug)),
    );

    this.server.registerTool(
      "get_user_tags",
      {
        description: "Return the topical tags a member has on their profile.",
        inputSchema: { slug: z.string() },
      },
      async ({ slug }) => this.wrap(() => this.client().getUserTags(slug)),
    );

    this.server.registerTool(
      "get_user_badges",
      {
        description: "Return the peer-awarded badges a member has received.",
        inputSchema: { slug: z.string() },
      },
      async ({ slug }) => this.wrap(() => this.client().getUserBadges(slug)),
    );

    this.server.registerTool(
      "get_user_achievements",
      {
        description: "Return the achievements a member has earned.",
        inputSchema: { slug: z.string() },
      },
      async ({ slug }) => this.wrap(() => this.client().getUserAchievements(slug)),
    );

    this.server.registerTool(
      "find_user_by_telegram",
      {
        description: "Look up a club member by their numeric Telegram user id.",
        inputSchema: {
          telegram_id: z.union([z.string(), z.number().int()]).transform(String),
        },
      },
      async ({ telegram_id }) => this.wrap(() => this.client().findUserByTelegram(telegram_id)),
    );

    this.server.registerTool(
      "get_post",
      {
        description: "Fetch a post by type and slug.",
        inputSchema: { post_type: POST_TYPE, slug: z.string() },
      },
      async ({ post_type, slug }) => this.wrap(() => this.client().getPost(post_type, slug)),
    );

    this.server.registerTool(
      "get_post_markdown",
      {
        description: "Fetch the raw markdown body of a post.",
        inputSchema: { post_type: POST_TYPE, slug: z.string() },
      },
      async ({ post_type, slug }) =>
        this.wrap(() => this.client().getPostMarkdown(post_type, slug)),
    );

    this.server.registerTool(
      "list_post_comments",
      {
        description: "List the visible comments under a post.",
        inputSchema: { post_type: POST_TYPE, slug: z.string() },
      },
      async ({ post_type, slug }) =>
        this.wrap(() => this.client().listPostComments(post_type, slug)),
    );

    this.server.registerTool(
      "get_feed",
      {
        description: "Return a page of the public feed.",
        inputSchema: {
          post_type: FEED_POST_TYPE,
          ordering: ORDERING.default("activity"),
          page: z.number().int().min(1).default(1),
        },
      },
      async ({ post_type, ordering, page }) =>
        this.wrap(() => this.client().getFeed({ post_type, ordering, page })),
    );

    this.server.registerTool(
      "search_users",
      {
        description: "Find members whose slug starts with the given prefix (3–15 chars).",
        inputSchema: { prefix: z.string().min(3).max(15) },
      },
      async ({ prefix }) => this.wrap(() => this.client().searchUsers(prefix)),
    );

    this.server.registerTool(
      "search_tags",
      {
        description: "Search profile tags. Optional prefix and group filter.",
        inputSchema: {
          prefix: z.string().min(3).max(15).optional(),
          group: TAG_GROUP.optional(),
        },
      },
      async ({ prefix, group }) => this.wrap(() => this.client().searchTags({ prefix, group })),
    );
  }
}
