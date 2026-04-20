/**
 * End-to-end MCP server tests.
 *
 * Drives a real MCP `Client` against a real `McpServer` via InMemoryTransport
 * with `fetch` stubbed for upstream. Catches:
 *   - tool / resource / prompt registration drift,
 *   - title + description + annotations on the wire,
 *   - `outputSchema` validation by the SDK (a schema mismatch surfaces as
 *     a tool-call error here, the same way real clients see it),
 *   - the read/write scope split (mcpScopes guard in MyMCPFull).
 *
 * `agents/mcp` is mocked to a no-op base — Node ESM can't resolve
 * `cloudflare:workers`. We then drive `agent.server` directly through
 * InMemoryTransport — bypasses Durable Object plumbing but exercises the
 * exact same registrations the worker exposes.
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  BASE_URL,
  jsonResponse,
  SAMPLE_COMMENT,
  SAMPLE_COMMENT_UUID,
  SAMPLE_FEED,
  SAMPLE_USER,
  textResponse,
} from "./fixtures";

vi.mock("agents/mcp", () => {
  class McpAgent<_E = unknown, _S = unknown, P = unknown> {
    props?: P;
    env: Record<string, unknown> = {};
    static serve(_path: string) {
      return { fetch: () => new Response() };
    }
  }
  return { McpAgent };
});

const { MyMCP } = await import("../src/mcp");
const { MyMCPFull } = await import("../src/mcp-full");

import type { Props } from "../src/types";

const DEFAULT_PROPS: Props = {
  propsVersion: 1,
  slug: "vas3k",
  fullName: "Vas3k",
  upstreamAccessToken: "tok",
  upstreamRefreshToken: "ref",
  scope: "openid contact",
  mcpScopes: ["read", "write"],
};

/** Boot one of our McpAgent subclasses + connect a real MCP Client to it. */
async function connect<T extends typeof MyMCP | typeof MyMCPFull>(
  Ctor: T,
  propsOverrides: Partial<Props> = {},
) {
  const agent = new (Ctor as unknown as new () => InstanceType<T>)();
  (agent as unknown as { props: Props }).props = { ...DEFAULT_PROPS, ...propsOverrides };
  (agent as unknown as { env: Record<string, string> }).env = { VAS3K_BASE_URL: BASE_URL };
  await agent.init();

  const [serverT, clientT] = InMemoryTransport.createLinkedPair();
  await agent.server.connect(serverT);
  const client = new Client({ name: "test", version: "0" }, { capabilities: {} });
  await client.connect(clientT);
  return client;
}

/** Pull the text from the first content block — narrows the SDK's union
 * (new CallToolResult vs. legacy `toolResult`-only shape). */
const text = (r: unknown) => {
  const c = (r as { content?: unknown }).content;
  return (c as { text?: string }[] | undefined)?.[0]?.text ?? "";
};

const EXPECTED_READ_TOOLS = [
  "find_user_by_telegram",
  "get_feed",
  "get_me",
  "get_post",
  "get_post_markdown",
  "get_user",
  "get_user_achievements",
  "get_user_badges",
  "get_user_tags",
  "list_post_comments",
  "search_tags",
  "search_users",
];

const EXPECTED_WRITE_TOOLS = [
  "bookmark_post",
  "mute_room",
  "retract_comment_vote",
  "retract_post_vote",
  "subscribe_room",
  "toggle_event_participation",
  "toggle_friend",
  "toggle_post_subscription",
  "toggle_profile_tag",
  "upvote_comment",
  "upvote_post",
];

// ---------- read surface -----------------------------------------------------

describe("MyMCP — read tools", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let client: Client;

  beforeEach(async () => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    client = await connect(MyMCP);
  });
  afterEach(() => vi.unstubAllGlobals());

  const next = (body: unknown, init?: ResponseInit) =>
    fetchMock.mockResolvedValueOnce(jsonResponse(body, init));
  const call = (name: string, args: Record<string, unknown> = {}) =>
    client.callTool({ name, arguments: args });
  const url = (i = 0) => fetchMock.mock.calls[i]?.[0] as string;

  it("listTools — 12 read tools, each with title + description", async () => {
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual(EXPECTED_READ_TOOLS);
    for (const t of tools) {
      expect(t.title, `${t.name}.title`).toBeTruthy();
      expect(t.description, `${t.name}.description`).toBeTruthy();
    }
  });

  it("listTools — outputSchema present on every tool except get_post_markdown", async () => {
    const { tools } = await client.listTools();
    for (const t of tools) {
      if (t.name === "get_post_markdown") expect(t.outputSchema).toBeUndefined();
      else expect(t.outputSchema?.type, `${t.name}.outputSchema.type`).toBe("object");
    }
  });

  it("read annotations — readOnlyHint:true + openWorldHint:true, nothing else", async () => {
    const { tools } = await client.listTools();
    for (const t of tools) {
      expect(t.annotations, t.name).toMatchObject({ readOnlyHint: true, openWorldHint: true });
      expect(t.annotations?.idempotentHint, t.name).toBeUndefined();
      expect(t.annotations?.destructiveHint, t.name).toBeUndefined();
    }
  });

  it("get_me — structuredContent matches the user envelope, content stays empty", async () => {
    next({ user: SAMPLE_USER });
    const r = await call("get_me");
    expect(r.isError).toBeFalsy();
    expect(r.structuredContent).toEqual({ user: SAMPLE_USER });
    expect(r.content).toEqual([]);
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer tok");
  });

  it.each([
    ["get_user", { slug: "vas3k" }, () => ({ user: SAMPLE_USER }), "/user/vas3k.json"],
    ["get_user_tags", { slug: "v" }, () => ({ tags: {} }), "/user/v/tags.json"],
    [
      "list_post_comments",
      { post_type: "post", slug: "hello" },
      () => ({ comments: [SAMPLE_COMMENT] }),
      "/post/hello/comments.json",
    ],
    ["get_feed", {}, () => SAMPLE_FEED, "/feed.json?page=1"],
    [
      "get_feed",
      { post_type: "link", ordering: "top_week" },
      () => SAMPLE_FEED,
      "/link/top_week/feed.json?page=1",
    ],
  ] as const)("%s(%j) → %s", async (name, args, body, path) => {
    next(body());
    const r = await call(name, args);
    expect(r.isError, text(r)).toBeFalsy();
    expect(url()).toBe(BASE_URL + path);
  });

  it("get_post_markdown — returns text content, no structuredContent", async () => {
    fetchMock.mockResolvedValueOnce(textResponse("# title\nbody"));
    const r = await call("get_post_markdown", { post_type: "post", slug: "hello" });
    expect(r.isError).toBeFalsy();
    expect(r.structuredContent).toBeUndefined();
    expect(text(r)).toBe("# title\nbody");
  });

  it("invalid slug rejected before fetch (input + URL validators)", async () => {
    const r = await call("get_user", { slug: "../etc/passwd" });
    expect(r.isError).toBe(true);
    expect(text(r)).toContain("invalid slug");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("search_tags — forwards prefix + group as query params", async () => {
    next({ tags: [] });
    await call("search_tags", { prefix: "rust", group: "tech" });
    expect(url()).toContain("prefix=rust");
    expect(url()).toContain("group=tech");
  });

  it.each([
    [401, "token expired"],
    [403, "does not have access"],
    [404, "check the slug"],
    [429, "rate limited"],
    [503, "upstream is having problems"],
  ] as const)("upstream %i → friendly hint", async (status, hint) => {
    next({ error: "x" }, { status });
    const r = await call("get_me");
    expect(r.isError).toBe(true);
    expect(text(r)).toContain(`vas3k.club returned ${status}`);
    expect(text(r)).toContain(hint);
  });
});

// ---------- resources --------------------------------------------------------

describe("MyMCP — resources", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let client: Client;

  beforeEach(async () => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    client = await connect(MyMCP);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("listResources — vas3k://me + vas3k://about with proper mime types", async () => {
    const { resources } = await client.listResources();
    const byUri = new Map(resources.map((r) => [r.uri, r]));
    expect([...byUri.keys()].sort()).toEqual(["vas3k://about", "vas3k://me"]);
    expect(byUri.get("vas3k://me")?.mimeType).toBe("application/json");
    expect(byUri.get("vas3k://about")?.mimeType).toBe("text/markdown");
    for (const r of resources) expect(r.title).toBeTruthy();
  });

  it("vas3k://me — fetches /user/me.json and returns the JSON body", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ user: SAMPLE_USER }));
    const { contents } = await client.readResource({ uri: "vas3k://me" });
    const c = contents[0] as { uri: string; mimeType?: string; text: string };
    expect(c).toMatchObject({ uri: "vas3k://me", mimeType: "application/json" });
    expect(JSON.parse(c.text)).toEqual({ user: SAMPLE_USER });
    expect(fetchMock.mock.calls[0]?.[0]).toBe(`${BASE_URL}/user/me.json`);
  });

  it("vas3k://about — static markdown, no upstream fetch", async () => {
    const { contents } = await client.readResource({ uri: "vas3k://about" });
    const c = contents[0] as { mimeType?: string; text: string };
    expect(c.mimeType).toBe("text/markdown");
    expect(c.text).toMatch(/vas3k-mcp[\s\S]+\/mcp-full/);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

// ---------- prompts ----------------------------------------------------------

describe("MyMCP — prompts", () => {
  let client: Client;

  beforeEach(async () => {
    client = await connect(MyMCP);
  });

  it("listPrompts — weekly_digest with post_type + focus arguments", async () => {
    const { prompts } = await client.listPrompts();
    expect(prompts).toHaveLength(1);
    const [p] = prompts;
    expect(p?.name).toBe("weekly_digest");
    expect(p?.title).toBeTruthy();
    expect(p?.arguments?.map((a) => a.name).sort()).toEqual(["focus", "post_type"]);
  });

  const promptText = async (args: Record<string, string>) => {
    const r = await client.getPrompt({ name: "weekly_digest", arguments: args });
    return (r.messages[0]!.content as { text: string }).text;
  };

  it("weekly_digest — body mentions get_feed step + the focus topic", async () => {
    const t = await promptText({ focus: "AI safety", post_type: "project" });
    expect(t).toContain("get_feed");
    expect(t).toContain("type=project");
    expect(t).toContain("AI safety");
  });

  it("weekly_digest without focus — omits the extra-weight clause", async () => {
    expect(await promptText({})).not.toContain("Give extra weight");
  });
});

// ---------- write surface ----------------------------------------------------

describe("MyMCPFull — write tools", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let client: Client;

  beforeEach(async () => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    client = await connect(MyMCPFull);
  });
  afterEach(() => vi.unstubAllGlobals());

  const next = (body: unknown, init?: ResponseInit) =>
    fetchMock.mockResolvedValueOnce(jsonResponse(body, init));
  const call = (name: string, args: Record<string, unknown>) =>
    client.callTool({ name, arguments: args });
  const url = () => fetchMock.mock.calls[0]?.[0] as string;
  const method = () => (fetchMock.mock.calls[0]?.[1] as RequestInit).method;

  it("listTools — 12 read + 11 write = 23 total", async () => {
    const { tools } = await client.listTools();
    const names = tools.map((t) => t.name).sort();
    expect(names).toHaveLength(23);
    for (const w of EXPECTED_WRITE_TOOLS) {
      expect(names, `missing write tool: ${w}`).toContain(w);
    }
  });

  it("annotation buckets — additive / destructive-idempotent / toggle", async () => {
    const { tools } = await client.listTools();
    const a = (n: string) => tools.find((t) => t.name === n)?.annotations ?? {};

    const ADDITIVE = {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    };
    const DESTRUCTIVE = { ...ADDITIVE, destructiveHint: true };
    const TOGGLE = { ...DESTRUCTIVE, idempotentHint: false };

    for (const n of ["upvote_post", "upvote_comment"]) expect(a(n), n).toMatchObject(ADDITIVE);
    for (const n of ["retract_post_vote", "retract_comment_vote"])
      expect(a(n), n).toMatchObject(DESTRUCTIVE);
    for (const n of [
      "bookmark_post",
      "toggle_post_subscription",
      "toggle_event_participation",
      "toggle_friend",
      "subscribe_room",
      "mute_room",
      "toggle_profile_tag",
    ])
      expect(a(n), n).toMatchObject(TOGGLE);
  });

  it.each([
    ["upvote_post", { post_slug: "hello" }, "/post/hello/upvote/?is_ajax=1"],
    ["retract_post_vote", { post_slug: "hello" }, "/post/hello/retract_vote/?is_ajax=1"],
    ["bookmark_post", { post_slug: "hello" }, "/post/hello/bookmark/?is_ajax=1"],
    ["toggle_post_subscription", { post_slug: "h" }, "/post/h/subscription/?is_ajax=1"],
    ["toggle_event_participation", { post_slug: "h" }, "/post/h/participate/?is_ajax=1"],
    ["toggle_friend", { user_slug: "v" }, "/user/v/friend/?is_ajax=1"],
    ["subscribe_room", { room_slug: "ai" }, "/room/ai/subscribe/?is_ajax=1"],
    ["mute_room", { room_slug: "ai" }, "/room/ai/mute/?is_ajax=1"],
    ["toggle_profile_tag", { tag_code: "rust" }, "/profile/tag/rust/toggle/?is_ajax=1"],
    [
      "upvote_comment",
      { comment_id: SAMPLE_COMMENT_UUID },
      `/comment/${SAMPLE_COMMENT_UUID}/upvote/?is_ajax=1`,
    ],
    [
      "retract_comment_vote",
      { comment_id: SAMPLE_COMMENT_UUID },
      `/comment/${SAMPLE_COMMENT_UUID}/retract_vote/?is_ajax=1`,
    ],
  ] as const)("%s POSTs to %s", async (name, args, path) => {
    // One canned response that satisfies every write tool's outputSchema —
    // unioned fields cover toggle (status), retract (success), upvote
    // (upvoted_timestamp + post/comment), and toggle_profile_tag (tag).
    next({
      status: "created",
      success: true,
      post: { upvotes: 1 },
      comment: { upvotes: 1 },
      tag: { code: "rust", name: "Rust", color: "#fa0" },
      upvoted_timestamp: 0,
    });
    const r = await call(name, args);
    expect(r.isError, text(r)).toBeFalsy();
    expect(url()).toBe(BASE_URL + path);
    expect(method()).toBe("POST");
  });

  it("upvote_post — structured response carries the new upvote count", async () => {
    next({ post: { upvotes: 7 }, upvoted_timestamp: 1700000000000 });
    const r = await call("upvote_post", { post_slug: "hello" });
    expect(r.structuredContent).toEqual({
      post: { upvotes: 7 },
      upvoted_timestamp: 1700000000000,
    });
  });

  it("toggle_profile_tag — structured response includes the affected tag record", async () => {
    next({ status: "created", tag: { code: "rust", name: "Rust", color: "#fa0" } });
    const r = await call("toggle_profile_tag", { tag_code: "rust" });
    expect(r.structuredContent).toMatchObject({ status: "created", tag: { code: "rust" } });
  });

  it("missing 'write' scope → 403 before upstream is touched", async () => {
    client = await connect(MyMCPFull, { mcpScopes: ["read"] });
    const r = await call("upvote_post", { post_slug: "hello" });
    expect(r.isError).toBe(true);
    expect(text(r)).toContain("403");
    expect(text(r)).toContain("missing_scope");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("write errors scrub bearer tokens (defence in depth)", async () => {
    next({ error: "received Bearer abc.def.ghi and refused" }, { status: 401 });
    const r = await call("upvote_post", { post_slug: "hello" });
    expect(r.isError).toBe(true);
    expect(text(r)).not.toContain("abc.def.ghi");
    expect(text(r)).toContain("[REDACTED]");
  });
});
