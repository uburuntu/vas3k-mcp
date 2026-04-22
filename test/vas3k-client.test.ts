import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Vas3kAPIError, Vas3kClient } from "../src/vas3k-client";

const BASE = "https://example.invalid";

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { "content-type": "application/json", ...(init.headers ?? {}) },
  });
}

describe("Vas3kClient", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends Bearer token when accessToken is set", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ user: { slug: "vas3k" } }));
    const client = new Vas3kClient({ baseUrl: BASE, accessToken: "tok" });
    await client.getMe();

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe(`${BASE}/user/me.json`);
    expect((init as RequestInit).headers).toMatchObject({ Authorization: "Bearer tok" });
  });

  it("sends X-Service-Token when serviceToken is set and no accessToken", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ user: { slug: "vas3k" } }));
    const client = new Vas3kClient({ baseUrl: BASE, serviceToken: "st_secret123" });
    await client.getMe();

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const headers = init.headers as Record<string, string>;
    expect(headers["X-Service-Token"]).toBe("st_secret123");
    expect(headers.Authorization).toBeUndefined();
  });

  it("prefers Bearer over service token when both are set", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ user: { slug: "vas3k" } }));
    const client = new Vas3kClient({
      baseUrl: BASE,
      accessToken: "tok",
      serviceToken: "st_secret",
    });
    await client.getMe();

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer tok");
    expect(headers["X-Service-Token"]).toBeUndefined();
  });

  it("omits Authorization header when no token", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ items: [] }));
    const client = new Vas3kClient({ baseUrl: BASE });
    await client.getFeed();

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect((init.headers as Record<string, string>).Authorization).toBeUndefined();
  });

  it("uses /feed.json for default feed", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ items: [] }));
    const client = new Vas3kClient({ baseUrl: BASE });
    await client.getFeed();
    expect(fetchMock.mock.calls[0]?.[0]).toBe(`${BASE}/feed.json?page=1`);
  });

  it("uses typed path when filters are set", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ items: [] }));
    const client = new Vas3kClient({ baseUrl: BASE });
    await client.getFeed({ post_type: "link", ordering: "top_week" });
    expect(fetchMock.mock.calls[0]?.[0]).toBe(`${BASE}/link/top_week/feed.json?page=1`);
  });

  it("getFeed — long content_text gets in-band suffix + _club truncation markers (Perplexity 4MB-limit fix, self-announcing so the LLM can't mistake the preview for the full post)", async () => {
    const longBody = "x".repeat(5000);
    const shortBody = "short body";
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        items: [
          { id: "1", title: "long", content_text: longBody, _club: { type: "post", slug: "a" } },
          {
            id: "2",
            title: "short",
            content_text: shortBody,
            _club: { type: "question", slug: "b" },
          },
        ],
      }),
    );
    const client = new Vas3kClient({ baseUrl: BASE });
    const data = (await client.getFeed()) as {
      items: Array<{
        content_text: string;
        _club: {
          type: string;
          slug: string;
          content_truncated?: boolean;
          content_full_chars?: number;
        };
      }>;
    };

    // Long item — three signals all present:
    const long = data.items[0]!;
    expect(long.content_text).toContain("…");
    expect(long.content_text).toContain("Truncated preview — 1000 of 5000 chars");
    expect(long.content_text).toContain('get_post(post_type="post", slug="a")');
    expect(long._club.content_truncated).toBe(true);
    expect(long._club.content_full_chars).toBe(5000);

    // Short item — ABSENCE of markers means full content. Critical contract.
    const short = data.items[1]!;
    expect(short.content_text).toBe(shortBody);
    expect(short._club.content_truncated).toBeUndefined();
    expect(short._club.content_full_chars).toBeUndefined();
  });

  it("getFeed — truncation suffix uses the actual post type from _club (so e.g. a 'question' isn't told to call get_post with type='post')", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        items: [
          {
            id: "1",
            title: "q",
            content_text: "y".repeat(2000),
            _club: { type: "question", slug: "asking-about-foo" },
          },
        ],
      }),
    );
    const client = new Vas3kClient({ baseUrl: BASE });
    const data = (await client.getFeed()) as { items: Array<{ content_text: string }> };
    expect(data.items[0]!.content_text).toContain(
      'get_post(post_type="question", slug="asking-about-foo")',
    );
  });

  it("getFeed tolerates an items-less response shape (returns input unchanged)", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ unexpected: "shape" }));
    const client = new Vas3kClient({ baseUrl: BASE });
    const data = await client.getFeed();
    expect(data).toEqual({ unexpected: "shape" });
  });

  it("throws Vas3kAPIError on non-2xx", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: "not found" }, { status: 404 }));
    const client = new Vas3kClient({ baseUrl: BASE, accessToken: "t" });
    await expect(client.getUser("ghost")).rejects.toBeInstanceOf(Vas3kAPIError);
  });

  it("returns markdown body verbatim", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response("# title\n\nbody", { status: 200, headers: { "content-type": "text/plain" } }),
    );
    const client = new Vas3kClient({ baseUrl: BASE, accessToken: "t" });
    const md = await client.getPostMarkdown("post", "hello");
    expect(md).toBe("# title\n\nbody");
  });

  it("forwards search-tag params", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ tags: [] }));
    const client = new Vas3kClient({ baseUrl: BASE, accessToken: "t" });
    await client.searchTags({ prefix: "rust", group: "tech" });
    const url = fetchMock.mock.calls[0]?.[0] as string;
    expect(url).toContain("prefix=rust");
    expect(url).toContain("group=tech");
  });

  // ---------- hardening behaviors ----------

  it("treats a 302 redirect as Vas3kAPIError with the Location in the payload", async () => {
    // Upstream redirects to /{correct_type}/{slug}/ when post_type doesn't match
    // (reference/posts/api.py:19-22). Without redirect: "manual" the client
    // would silently follow into HTML.
    fetchMock.mockResolvedValueOnce(
      new Response(null, {
        status: 302,
        headers: { location: "/post/the-real-slug/" },
      }),
    );
    const client = new Vas3kClient({ baseUrl: BASE, accessToken: "t" });
    const err = await client.getPost("link", "the-real-slug").catch((e) => e);
    expect(err).toBeInstanceOf(Vas3kAPIError);
    expect((err as Vas3kAPIError).status).toBe(302);
    expect((err as Vas3kAPIError).payload).toMatchObject({ redirect: "/post/the-real-slug/" });
  });

  it("rejects a 200 text/html response on a JSON-typed call", async () => {
    // Cloudflare WAF or any HTML error page on a JSON call site must surface
    // as a structured error rather than a wall of HTML to the LLM (P1 #5).
    fetchMock.mockResolvedValueOnce(
      new Response("<!doctype html><html><body>Service unavailable</body></html>", {
        status: 200,
        headers: { "content-type": "text/html; charset=utf-8" },
      }),
    );
    const client = new Vas3kClient({ baseUrl: BASE, accessToken: "t" });
    await expect(client.getUser("vas3k")).rejects.toBeInstanceOf(Vas3kAPIError);
  });

  it("rejects malformed slugs before issuing a request", async () => {
    const client = new Vas3kClient({ baseUrl: BASE, accessToken: "t" });

    // Slug validation may throw synchronously *or* asynchronously depending
    // on whether the hardening agent's guard sits inside the async arrow or
    // before it. Wrap each call so either shape is caught here.
    await expect(async () => client.getUser("../etc/passwd")).rejects.toBeInstanceOf(Vas3kAPIError);
    await expect(async () => client.getPost("post", "name with space")).rejects.toBeInstanceOf(
      Vas3kAPIError,
    );

    // No upstream call should have been made for invalid slugs.
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("searchTags({}) sends no query string at all", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ tags: [] }));
    const client = new Vas3kClient({ baseUrl: BASE, accessToken: "t" });
    await client.searchTags({});
    const url = fetchMock.mock.calls[0]?.[0] as string;
    expect(url).toBe(`${BASE}/search/tags.json`);
  });

  it("searchUsers rejects prefixes outside [3..15] before fetching", async () => {
    const client = new Vas3kClient({ baseUrl: BASE, accessToken: "t" });
    await expect(async () => client.searchUsers("ab")).rejects.toBeInstanceOf(Vas3kAPIError);
    await expect(async () => client.searchUsers("x".repeat(16))).rejects.toBeInstanceOf(
      Vas3kAPIError,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  // ---------- write methods ----------
  // The write surface delegates to a single `postAction` helper that always
  // appends `?is_ajax=1` and sends `method: POST`. Verify the URL, query, and
  // method for one tool per category, plus slug/uuid validation.

  describe("write actions", () => {
    const VALID_UUID = "8e3a73b9-31fc-4abc-8a7e-1c3a40e5d6f2";

    it.each([
      ["bookmarkPost", "post/x/bookmark/", "x"],
      ["upvotePost", "post/x/upvote/", "x"],
      ["retractPostVote", "post/x/retract_vote/", "x"],
      ["togglePostSubscription", "post/x/subscription/", "x"],
      ["toggleEventParticipation", "post/x/participate/", "x"],
      ["toggleFriend", "user/x/friend/", "x"],
      ["subscribeRoom", "room/x/subscribe/", "x"],
      ["muteRoom", "room/x/mute/", "x"],
      ["toggleProfileTag", "profile/tag/x/toggle/", "x"],
    ] as const)("%s POSTs to /%s with ?is_ajax=1", async (method, path, slug) => {
      fetchMock.mockResolvedValueOnce(jsonResponse({ status: "created" }));
      const client = new Vas3kClient({ baseUrl: BASE, accessToken: "t" });
      await (client[method as keyof Vas3kClient] as any)(slug);

      const [url, init] = fetchMock.mock.calls[0]!;
      expect(url).toBe(`${BASE}/${path}?is_ajax=1`);
      expect((init as RequestInit).method).toBe("POST");
      // Bearer header still flows through on writes.
      expect((init as RequestInit).headers).toMatchObject({
        Authorization: "Bearer t",
      });
    });

    it.each([
      ["upvoteComment", `comment/${VALID_UUID}/upvote/`],
      ["retractCommentVote", `comment/${VALID_UUID}/retract_vote/`],
    ] as const)("%s validates UUID and POSTs to /%s", async (method, path) => {
      fetchMock.mockResolvedValueOnce(
        jsonResponse({ comment: { upvotes: 1 }, upvoted_timestamp: 0 }),
      );
      const client = new Vas3kClient({ baseUrl: BASE, accessToken: "t" });
      await (client[method as keyof Vas3kClient] as any)(VALID_UUID);

      const [url, init] = fetchMock.mock.calls[0]!;
      expect(url).toBe(`${BASE}/${path}?is_ajax=1`);
      expect((init as RequestInit).method).toBe("POST");
    });

    it("comment write actions reject malformed UUIDs before fetching", async () => {
      const client = new Vas3kClient({ baseUrl: BASE, accessToken: "t" });
      await expect(async () => client.upvoteComment("not-a-uuid")).rejects.toBeInstanceOf(
        Vas3kAPIError,
      );
      await expect(async () => client.retractCommentVote("../etc/passwd")).rejects.toBeInstanceOf(
        Vas3kAPIError,
      );
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("post write actions reject malformed slugs before fetching", async () => {
      const client = new Vas3kClient({ baseUrl: BASE, accessToken: "t" });
      await expect(async () => client.bookmarkPost("../etc/passwd")).rejects.toBeInstanceOf(
        Vas3kAPIError,
      );
      await expect(async () => client.upvotePost("name with space")).rejects.toBeInstanceOf(
        Vas3kAPIError,
      );
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("write call surfaces 401 as Vas3kAPIError", async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({ error: "unauth" }, { status: 401 }));
      const client = new Vas3kClient({ baseUrl: BASE, accessToken: "t" });
      await expect(client.upvotePost("x")).rejects.toBeInstanceOf(Vas3kAPIError);
    });

    it("write call surfaces 5xx with the upstream payload preserved", async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({ error: "redis is sad" }, { status: 503 }));
      const client = new Vas3kClient({ baseUrl: BASE, accessToken: "t" });
      await expect(client.bookmarkPost("x")).rejects.toMatchObject({
        status: 503,
        payload: { error: "redis is sad" },
      });
    });
  });
});
