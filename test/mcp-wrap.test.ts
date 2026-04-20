/**
 * Direct unit tests for `MyMCP#wrap`.
 *
 * `wrap` is `private`, so we can't reach it through a normal property
 * lookup. We also can't easily *instantiate* `MyMCP` in a vitest run because
 * its base class (`McpAgent`/`Agent`) ultimately imports `cloudflare:workers`,
 * which the Node ESM loader can't resolve. We mock `agents/mcp` to a no-op
 * `McpAgent` base so the source module can load. `wrap` itself doesn't read
 * `this.props` or `this.env`, so this gives us real source-code coverage.
 *
 * No source modification required — the test side-steps the visibility
 * modifier via the prototype.
 */

import { describe, expect, it, vi } from "vitest";

vi.mock("agents/mcp", () => {
  // Minimal stand-in for the McpAgent base class. `MyMCP` extends it but
  // `wrap` itself only does try/catch+formatting — it never reads `this.props`
  // or `this.env` — so an empty class body is enough for the source module to
  // load. The `props`/`env` fields exist purely so the subclass typecheck is
  // happy; they're never accessed in this test.
  class McpAgent<_E = unknown, _S = unknown, P = unknown> {
    props?: P;
    env: Record<string, never> = {};
    static serve(_path: string) {
      return { fetch: () => new Response() };
    }
  }
  return { McpAgent };
});

// `vi.mock` is hoisted; the imports below resolve against the stub above.
const { MyMCP } = await import("../src/mcp");
const { Vas3kAPIError } = await import("../src/vas3k-client");

// `wrap` and `wrapStructured` are declared `protected` — reach them via the
// prototype to side-step TS visibility without touching `src/`.
type WrapResult = {
  isError?: boolean;
  content: { type: "text"; text: string }[];
  structuredContent?: Record<string, unknown>;
};
const proto = MyMCP.prototype as unknown as Record<string, unknown>;
const wrap = proto.wrap as <T>(this: unknown, fn: () => Promise<T>) => Promise<WrapResult>;
const wrapStructured = proto.wrapStructured as <T>(
  this: unknown,
  fn: () => Promise<T>,
) => Promise<WrapResult>;

function callWrap<T>(fn: () => Promise<T>) {
  // Pass an empty stub for `this` — wrap doesn't reference it.
  return wrap.call({}, fn);
}
function callWrapStructured<T>(fn: () => Promise<T>) {
  return wrapStructured.call({}, fn);
}

describe("MyMCP.wrap", () => {
  it("returns { content: [{ type: 'text', text }] } on success", async () => {
    const result = await callWrap(async () => ({ ok: true, n: 42 }));

    expect(result.isError).toBeUndefined();
    expect(result.content).toHaveLength(1);
    expect(result.content[0]?.type).toBe("text");
    expect(result.content[0]?.text).toBe(JSON.stringify({ ok: true, n: 42 }));
  });

  it("returns string payloads verbatim (no double-stringify for markdown)", async () => {
    const md = "# title\n\nbody";
    const result = await callWrap(async () => md);
    expect(result.content[0]?.text).toBe(md);
  });

  it("returns isError with the 401 hint suffix on Vas3kAPIError(401, ...)", async () => {
    const result = await callWrap(async () => {
      throw new Vas3kAPIError(401, { error: "unauthorized" });
    });

    expect(result.isError).toBe(true);
    const text = result.content[0]?.text ?? "";
    expect(text).toContain("vas3k.club returned 401");
    // Hardening agent adds a status-specific hint suffix (P1-2 in the review).
    expect(text).toContain("token expired");
  });

  it("attaches a different hint suffix per status (403/404/429)", async () => {
    for (const [status, fragment] of [
      [403, "does not have access"],
      [404, "check the slug"],
      [429, "rate limited"],
    ] as const) {
      const result = await callWrap(async () => {
        throw new Vas3kAPIError(status, { error: "x" });
      });
      expect(result.isError).toBe(true);
      expect(result.content[0]?.text ?? "").toContain(fragment);
    }
  });

  it("returns isError with 'Unexpected error...' on a generic Error", async () => {
    // Silence the deliberate console.error from the failure-logging branch
    // so the test output stays clean.
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const result = await callWrap(async () => {
        throw new TypeError("Failed to fetch");
      });

      expect(result.isError).toBe(true);
      const text = result.content[0]?.text ?? "";
      expect(text).toMatch(/Unexpected error/);
      // The hardening agent included the error class name and message
      // (P1-1). Be tolerant: assert at least the message is present.
      expect(text).toContain("Failed to fetch");
    } finally {
      errSpy.mockRestore();
    }
  });

  it("strips Bearer XXX substrings from the rendered error text (security defence)", async () => {
    // Simulates upstream echoing the Authorization header back into an error
    // body. The wrap layer must not relay the live token to the LLM.
    const result = await callWrap(async () => {
      throw new Vas3kAPIError(401, {
        error: "bad token",
        debug: "received Bearer abc.def.ghi-secret-jwt",
      });
    });

    const text = result.content[0]?.text ?? "";
    expect(text).not.toContain("abc.def.ghi-secret-jwt");
    expect(text).not.toMatch(/Bearer\s+[A-Za-z0-9._-]+/);
  });

  it("strips service tokens (st_…) from the rendered error text", async () => {
    const result = await callWrap(async () => {
      throw new Vas3kAPIError(403, { error: "st_supersecret123 not allowed" });
    });
    const text = result.content[0]?.text ?? "";
    expect(text).not.toContain("st_supersecret123");
  });
});

describe("MyMCP.wrapStructured", () => {
  it("success → { content: [], structuredContent }", async () => {
    const data = { post: { upvotes: 42 }, upvoted_timestamp: 1700000000000 };
    const r = await callWrapStructured(async () => data);
    expect(r.isError).toBeUndefined();
    expect(r.content).toEqual([]); // SDK requires the field; we ship it empty.
    expect(r.structuredContent).toEqual(data);
  });

  it("Vas3kAPIError → same error framing as wrap (with hint suffix)", async () => {
    const r = await callWrapStructured(async () => {
      throw new Vas3kAPIError(404, { error: "not found" });
    });
    expect(r.isError).toBe(true);
    expect(r.structuredContent).toBeUndefined();
    expect(r.content[0]?.text ?? "").toContain("vas3k.club returned 404");
    expect(r.content[0]?.text ?? "").toContain("check the slug");
  });

  it("scrubs bearer tokens from error payloads", async () => {
    const r = await callWrapStructured(async () => {
      throw new Vas3kAPIError(401, { debug: "received Bearer abc.def.ghi" });
    });
    expect(r.content[0]?.text ?? "").not.toContain("abc.def.ghi");
    expect(r.content[0]?.text ?? "").toContain("[REDACTED]");
  });

  it("unexpected errors → 'Unexpected error' framing", async () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const r = await callWrapStructured(async () => {
        throw new TypeError("kaboom");
      });
      expect(r.isError).toBe(true);
      expect(r.content[0]?.text ?? "").toMatch(/Unexpected error.*kaboom/);
    } finally {
      errSpy.mockRestore();
    }
  });
});
