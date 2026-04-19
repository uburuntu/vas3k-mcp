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

  // ---------- hardening behaviors (REVIEW_code.md P0 #4 / P1 #5 / P1 #7) ----------

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
});
