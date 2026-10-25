import { describe, expect, it } from "vitest";
import { parseSse } from "./realtime.ts";

describe("parseSse", () => {
  it("reads id, event and data of complete messages and keeps the unfinished rest", () => {
    const { messages, rest } = parseSse("retry: 3000\n\nid: 7\nevent: note\ndata: {\"a\":1}\n\nid: 8\nevent: reco");
    expect(messages).toEqual([{ id: "7", event: "note", data: "{\"a\":1}" }]);
    expect(rest).toBe("id: 8\nevent: reco");
  });
  it("joins multi-line data, skips comments and heartbeats, accepts CRLF", () => {
    const { messages } = parseSse(": heartbeat\r\n\r\nevent: notification\r\ndata: one\r\ndata: two\r\n\r\n");
    expect(messages).toEqual([{ id: undefined, event: "notification", data: "one\ntwo" }]);
  });
  it("gives an empty buffer back as nothing", () => {
    expect(parseSse("")).toEqual({ messages: [], rest: "" });
  });
});
