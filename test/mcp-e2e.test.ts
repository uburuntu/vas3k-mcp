/**
 * End-to-end MCP server tests.
 *
 * Drives a real MCP `Client` against a real `McpServer` (the one MyMCP /
 * MyMCPFull instantiates) wired through `InMemoryTransport`. `fetch` is
 * stubbed for upstream calls. This catches:
 *   - tool / resource / prompt registration drift,
 *   - title + description + annotations actually reaching the wire,
 *   - `outputSchema` validation by the SDK (a schema mismatch surfaces
 *     here as a tool-call error, the same way real clients see it),
 *   - the read/write scope split (mcpScopes guard in MyMCPFull).
 *
 * The `agents/mcp` base is mocked to a no-op class for the same reason
 * mcp-wrap.test.ts mocks it: Node ESM can't resolve `cloudflare:workers`.
 * We then drive `agent.server` directly via InMemoryTransport — bypassing
 * Durable Object plumbing but exercising the same registrations the
 * worker would expose.
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("agents/mcp", () => {
  // Same minimal stand-in as test/mcp-wrap.test.ts. McpAgent itself does
  // nothing here — MyMCP's `server = new McpServer(...)` field initializer
  // is what we actually exercise.
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

// ---------- canned upstream payloads ----------

const SAMPLE_USER = {
  // Real v4 UUID — zod 4's `z.uuid()` enforces the version + variant nibbles
  // (third group must start with 1-8, fourth with 8/9/a/b), so the lazy
  // all-1s pattern fails validation.
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

const SAMPLE_FEED = {
  version: "https://jsonfeed.org/version/1.1",
  title: "vas3k.club",
  home_page_url: "https://example.invalid/",
  feed_url: "https://example.invalid/feed.json",
  items: [SAMPLE_POST_ITEM],
};

const SAMPLE_COMMENT = {
  id: "8e3a73b9-31fc-4abc-8a7e-1c3a40e5d6f2",
  url: "https://example.invalid/post/hello/#comment-x",
  text: "+1",
  author: SAMPLE_USER,
  reply_to_id: null,
  upvotes: 1,
  created_at: "2026-04-19T00:00:00Z",
};

// ---------- helpers ----------

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { "content-type": "application/json", ...(init.headers ?? {}) },
  });
}

function textResponse(body: string, contentType = "text/plain") {
  return new Response(body, {
    status: 200,
    headers: { "content-type": contentType },
  });
}

function makeProps(overrides: Partial<Props> = {}): Props {
  return {
    propsVersion: 1,
    slug: "vas3k",
    fullName: "Vas3k",
    upstreamAccessToken: "tok",
    upstreamRefreshToken: "ref",
    scope: "openid contact",
    mcpScopes: ["read", "write"],
    ...overrides,
  };
}

/**
 * Instantiate one of our McpAgent subclasses, set `props` + `env`, run
 * `init()` so all tools/resources/prompts are registered, then connect a
 * real MCP `Client` to its server via InMemoryTransport.
 */
async function bootClient<T extends typeof MyMCP | typeof MyMCPFull>(
  Ctor: T,
  propsOverrides: Partial<Props> = {},
) {
  // The real McpAgent constructor takes (Durable Object state, env). Our
  // `agents/mcp` mock has no constructor, so a no-arg `new` is fine at
  // runtime — TS just doesn't know that. Cast to a no-arg type.
  const agent = new (Ctor as unknown as new () => InstanceType<T>)();
  // The mocked McpAgent doesn't actually wire `props`/`env` — set them by
  // hand so MyMCP#client() can build a Vas3kClient.
  (agent as unknown as { props: Props }).props = makeProps(propsOverrides);
  (agent as unknown as { env: Record<string, string> }).env = {
    VAS3K_BASE_URL: "https://example.invalid",
  };
  await agent.init();

  const [serverTransport, clientTransport] = InMemoryTransport.createLinkedPair();
  await agent.server.connect(serverTransport);

  const client = new Client({ name: "test-client", version: "0.0.0" }, { capabilities: {} });
  await client.connect(clientTransport);

  return { client, agent };
}

// ---------- tests: read-only surface (MyMCP) ----------

describe("MyMCP e2e — read tools", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

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

  it("listTools — exposes the documented 12 read tools, each with title + description", async () => {
    const { client } = await bootClient(MyMCP);
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual(EXPECTED_READ_TOOLS);
    for (const t of tools) {
      expect(t.title, `${t.name} missing title`).toBeTruthy();
      expect(t.description, `${t.name} missing description`).toBeTruthy();
    }
  });

  it("listTools — every tool except get_post_markdown advertises an outputSchema", async () => {
    const { client } = await bootClient(MyMCP);
    const { tools } = await client.listTools();
    for (const t of tools) {
      if (t.name === "get_post_markdown") {
        expect(
          t.outputSchema,
          "markdown tool returns text — no outputSchema expected",
        ).toBeUndefined();
      } else {
        expect(t.outputSchema, `${t.name} should advertise an outputSchema`).toBeTruthy();
        expect(t.outputSchema?.type).toBe("object");
      }
    }
  });

  it("read tool annotations — readOnlyHint:true + openWorldHint:true, no destructive/idempotent noise", async () => {
    const { client } = await bootClient(MyMCP);
    const { tools } = await client.listTools();
    for (const t of tools) {
      const a = t.annotations ?? {};
      expect(a.readOnlyHint, `${t.name}.readOnlyHint`).toBe(true);
      expect(a.openWorldHint, `${t.name}.openWorldHint`).toBe(true);
      // Spec: idempotentHint / destructiveHint are meaningful only when
      // readOnlyHint == false. We omit them on reads.
      expect(a.idempotentHint, `${t.name}.idempotentHint`).toBeUndefined();
      expect(a.destructiveHint, `${t.name}.destructiveHint`).toBeUndefined();
    }
  });

  it("get_me — structuredContent matches the user envelope, content is empty", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ user: SAMPLE_USER }));
    const { client } = await bootClient(MyMCP);
    const result = await client.callTool({ name: "get_me", arguments: {} });

    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toEqual({ user: SAMPLE_USER });
    // wrapStructured drops the JSON text fallback in 1.1.0+
    expect(result.content).toEqual([]);
    // Bearer token reaches upstream
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer tok");
  });

  it("get_user — passes slug into the URL", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ user: SAMPLE_USER }));
    const { client } = await bootClient(MyMCP);
    await client.callTool({ name: "get_user", arguments: { slug: "vas3k" } });
    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://example.invalid/user/vas3k.json");
  });

  it("get_user — invalid slug rejected by the client validator before upstream is touched", async () => {
    const { client } = await bootClient(MyMCP);
    const result = await client.callTool({
      name: "get_user",
      arguments: { slug: "../etc/passwd" },
    });
    expect(result.isError).toBe(true);
    const text = (result.content as { text: string }[])[0]?.text ?? "";
    expect(text).toContain("invalid slug");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("get_post_markdown — returns text content, no structuredContent", async () => {
    fetchMock.mockResolvedValueOnce(textResponse("# title\nbody"));
    const { client } = await bootClient(MyMCP);
    const result = await client.callTool({
      name: "get_post_markdown",
      arguments: { post_type: "post", slug: "hello" },
    });
    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toBeUndefined();
    const text = (result.content as { text: string }[])[0]?.text;
    expect(text).toBe("# title\nbody");
  });

  it("get_feed — defaults to /feed.json?page=1 + activity ordering", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(SAMPLE_FEED));
    const { client } = await bootClient(MyMCP);
    const result = await client.callTool({ name: "get_feed", arguments: {} });
    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toMatchObject({ items: [SAMPLE_POST_ITEM] });
    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://example.invalid/feed.json?page=1");
  });

  it("get_feed — typed path when post_type + ordering are filters", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(SAMPLE_FEED));
    const { client } = await bootClient(MyMCP);
    await client.callTool({
      name: "get_feed",
      arguments: { post_type: "link", ordering: "top_week" },
    });
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "https://example.invalid/link/top_week/feed.json?page=1",
    );
  });

  it("list_post_comments — structuredContent has comments array", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ comments: [SAMPLE_COMMENT] }));
    const { client } = await bootClient(MyMCP);
    const result = await client.callTool({
      name: "list_post_comments",
      arguments: { post_type: "post", slug: "hello" },
    });
    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toEqual({ comments: [SAMPLE_COMMENT] });
  });

  it("search_users — short prefix rejected before upstream is touched", async () => {
    const { client } = await bootClient(MyMCP);
    const result = await client.callTool({ name: "search_users", arguments: { prefix: "ab" } });
    // Zod validation in the inputSchema rejects this. SDK formats the error
    // as MCP error response; result either isError:true or the request
    // throws. Either way no upstream call.
    expect(fetchMock).not.toHaveBeenCalled();
    // The SDK might package the validation as a thrown error rather than a
    // CallToolResult — handle either shape.
    if (result) {
      expect(result.isError).toBe(true);
    }
  });

  it("search_tags — forwards prefix + group as query params", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ tags: [] }));
    const { client } = await bootClient(MyMCP);
    await client.callTool({
      name: "search_tags",
      arguments: { prefix: "rust", group: "tech" },
    });
    const url = fetchMock.mock.calls[0]?.[0] as string;
    expect(url).toContain("prefix=rust");
    expect(url).toContain("group=tech");
  });

  it("upstream 401 surfaces with the token-expired hint", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: "unauth" }, { status: 401 }));
    const { client } = await bootClient(MyMCP);
    const result = await client.callTool({ name: "get_me", arguments: {} });
    expect(result.isError).toBe(true);
    const text = (result.content as { text: string }[])[0]?.text ?? "";
    expect(text).toContain("vas3k.club returned 401");
    expect(text).toContain("token expired");
  });

  it("upstream 404 surfaces with the not-found hint", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: "nope" }, { status: 404 }));
    const { client } = await bootClient(MyMCP);
    const result = await client.callTool({
      name: "get_user",
      arguments: { slug: "ghost" },
    });
    expect(result.isError).toBe(true);
    expect((result.content as { text: string }[])[0]?.text).toContain("check the slug");
  });
});

// ---------- tests: resources ----------

describe("MyMCP e2e — resources", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("listResources — exposes vas3k://me + vas3k://about with titles", async () => {
    const { client } = await bootClient(MyMCP);
    const { resources } = await client.listResources();
    const byUri = new Map(resources.map((r) => [r.uri, r]));
    expect([...byUri.keys()].sort()).toEqual(["vas3k://about", "vas3k://me"]);
    expect(byUri.get("vas3k://me")?.title).toBeTruthy();
    expect(byUri.get("vas3k://about")?.title).toBeTruthy();
    expect(byUri.get("vas3k://me")?.mimeType).toBe("application/json");
    expect(byUri.get("vas3k://about")?.mimeType).toBe("text/markdown");
  });

  it("readResource(vas3k://me) — fetches /user/me.json and returns the JSON body", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ user: SAMPLE_USER }));
    const { client } = await bootClient(MyMCP);
    const result = await client.readResource({ uri: "vas3k://me" });
    expect(result.contents).toHaveLength(1);
    // Resource contents is a discriminated union of {text} | {blob}; narrow
    // by casting once. We always emit the text variant from these handlers.
    const c = result.contents[0] as { uri: string; mimeType?: string; text: string };
    expect(c.uri).toBe("vas3k://me");
    expect(c.mimeType).toBe("application/json");
    expect(JSON.parse(c.text)).toEqual({ user: SAMPLE_USER });
    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://example.invalid/user/me.json");
  });

  it("readResource(vas3k://about) — static markdown, no upstream fetch", async () => {
    const { client } = await bootClient(MyMCP);
    const result = await client.readResource({ uri: "vas3k://about" });
    const c = result.contents[0] as { mimeType?: string; text: string };
    expect(c.mimeType).toBe("text/markdown");
    expect(c.text).toContain("vas3k-mcp");
    expect(c.text).toContain("/mcp-full");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

// ---------- tests: prompts ----------

describe("MyMCP e2e — prompts", () => {
  it("listPrompts — weekly_digest with post_type + focus arguments", async () => {
    const { client } = await bootClient(MyMCP);
    const { prompts } = await client.listPrompts();
    expect(prompts).toHaveLength(1);
    const p = prompts[0]!;
    expect(p.name).toBe("weekly_digest");
    expect(p.title).toBeTruthy();
    expect(p.description).toBeTruthy();
    expect(p.arguments?.map((a) => a.name).sort()).toEqual(["focus", "post_type"]);
  });

  it("getPrompt(weekly_digest) — body mentions get_feed step + the focus topic", async () => {
    const { client } = await bootClient(MyMCP);
    const result = await client.getPrompt({
      name: "weekly_digest",
      arguments: { focus: "AI safety", post_type: "project" },
    });
    expect(result.messages).toHaveLength(1);
    const text = (result.messages[0]!.content as { text: string }).text;
    expect(text).toContain("get_feed");
    expect(text).toContain("type=project");
    expect(text).toContain("AI safety");
  });

  it("getPrompt(weekly_digest) without focus — omits the extra-weight clause", async () => {
    const { client } = await bootClient(MyMCP);
    const result = await client.getPrompt({ name: "weekly_digest", arguments: {} });
    const text = (result.messages[0]!.content as { text: string }).text;
    expect(text).not.toContain("Give extra weight");
  });
});

// ---------- tests: write surface (MyMCPFull) ----------

describe("MyMCPFull e2e — write tools", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

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

  it("listTools — inherits the 12 read tools and adds 11 writes (23 total)", async () => {
    const { client } = await bootClient(MyMCPFull);
    const { tools } = await client.listTools();
    const names = tools.map((t) => t.name).sort();
    expect(names).toHaveLength(23);
    for (const w of EXPECTED_WRITE_TOOLS) {
      expect(names, `missing write tool: ${w}`).toContain(w);
    }
  });

  it("annotation buckets land on the right tools (additive / destructive-idempotent / toggle)", async () => {
    const { client } = await bootClient(MyMCPFull);
    const { tools } = await client.listTools();
    const a = (n: string) => tools.find((t) => t.name === n)?.annotations ?? {};

    // Additive idempotent — pure setter, never removes data.
    for (const name of ["upvote_post", "upvote_comment"]) {
      expect(a(name), name).toMatchObject({
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      });
    }

    // Destructive idempotent — pure remover.
    for (const name of ["retract_post_vote", "retract_comment_vote"]) {
      expect(a(name), name).toMatchObject({
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: true,
      });
    }

    // Toggles — flip state each call; the off-call removes prior state.
    for (const name of [
      "bookmark_post",
      "toggle_post_subscription",
      "toggle_event_participation",
      "toggle_friend",
      "subscribe_room",
      "mute_room",
      "toggle_profile_tag",
    ]) {
      expect(a(name), name).toMatchObject({
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: true,
      });
    }
  });

  it("upvote_post — POSTs to /post/<slug>/upvote/?is_ajax=1 with structured response", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ post: { upvotes: 7 }, upvoted_timestamp: 1700000000000 }),
    );
    const { client } = await bootClient(MyMCPFull);
    const result = await client.callTool({
      name: "upvote_post",
      arguments: { post_slug: "hello" },
    });
    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toEqual({
      post: { upvotes: 7 },
      upvoted_timestamp: 1700000000000,
    });
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "https://example.invalid/post/hello/upvote/?is_ajax=1",
    );
    expect((fetchMock.mock.calls[0]?.[1] as RequestInit).method).toBe("POST");
  });

  it("bookmark_post — toggle returns {status: 'created' | 'deleted'}", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ status: "created" }));
    const { client } = await bootClient(MyMCPFull);
    const r1 = await client.callTool({
      name: "bookmark_post",
      arguments: { post_slug: "hello" },
    });
    expect(r1.structuredContent).toEqual({ status: "created" });

    fetchMock.mockResolvedValueOnce(jsonResponse({ status: "deleted" }));
    const r2 = await client.callTool({
      name: "bookmark_post",
      arguments: { post_slug: "hello" },
    });
    expect(r2.structuredContent).toEqual({ status: "deleted" });
  });

  it("toggle_profile_tag — structured response includes the affected tag record", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        status: "created",
        tag: { code: "rust", name: "Rust", color: "#fa0" },
      }),
    );
    const { client } = await bootClient(MyMCPFull);
    const result = await client.callTool({
      name: "toggle_profile_tag",
      arguments: { tag_code: "rust" },
    });
    expect(result.structuredContent).toMatchObject({
      status: "created",
      tag: { code: "rust" },
    });
  });

  it("upvote_comment — accepts UUID and POSTs to /comment/<id>/upvote/?is_ajax=1", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ comment: { upvotes: 3 }, upvoted_timestamp: 0 }),
    );
    const { client } = await bootClient(MyMCPFull);
    const id = "9b2c3d4e-5f60-4718-a9c0-7d1f8e0b2a3c";
    const result = await client.callTool({
      name: "upvote_comment",
      arguments: { comment_id: id },
    });
    expect(result.isError).toBeFalsy();
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      `https://example.invalid/comment/${id}/upvote/?is_ajax=1`,
    );
  });

  it("write tool 403s when mcpScopes lacks 'write'", async () => {
    const { client } = await bootClient(MyMCPFull, { mcpScopes: ["read"] });
    const result = await client.callTool({
      name: "upvote_post",
      arguments: { post_slug: "hello" },
    });
    expect(result.isError).toBe(true);
    const text = (result.content as { text: string }[])[0]?.text ?? "";
    expect(text).toContain("403");
    expect(text).toContain("missing_scope");
    // No upstream call should have happened — the scope guard runs before
    // the HTTP layer.
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("write tool errors are still scrubbed of bearer tokens (defence in depth)", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ error: "received Bearer abc.def.ghi and refused" }, { status: 401 }),
    );
    const { client } = await bootClient(MyMCPFull);
    const result = await client.callTool({
      name: "upvote_post",
      arguments: { post_slug: "hello" },
    });
    expect(result.isError).toBe(true);
    const text = (result.content as { text: string }[])[0]?.text ?? "";
    expect(text).not.toContain("abc.def.ghi");
    expect(text).toContain("[REDACTED]");
  });
});
