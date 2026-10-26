import { auth } from "./http.ts";

// Server-sent events of ViaCRM (/v1/events). The stream needs the Authorization header, which EventSource cannot send,
// so it is read with fetch. Every event becomes a window event "via-realtime" with { event, data }.
type RealtimeEvent = { event: string; data: any };

// Splits an SSE text buffer into complete messages; returns the rest. Exported for the unit test.
export function parseSse(buffer: string): { messages: Array<{ id?: string; event: string; data: string }>; rest: string } {
  const messages: Array<{ id?: string; event: string; data: string }> = [];
  const blocks = buffer.split(/\r?\n\r?\n/);
  const rest = blocks.pop() ?? "";
  for (const block of blocks) {
    let id: string | undefined;
    let event = "message";
    const data: string[] = [];
    for (const line of block.split(/\r?\n/)) {
      if (!line || line.startsWith(":")) continue;
      const colon = line.indexOf(":");
      const field = colon === -1 ? line : line.slice(0, colon);
      const value = colon === -1 ? "" : line.slice(colon + 1).replace(/^ /, "");
      if (field === "id") id = value;
      else if (field === "event") event = value;
      else if (field === "data") data.push(value);
    }
    if (data.length || event !== "message") messages.push({ id, event, data: data.join("\n") });
  }
  return { messages, rest };
}

export function startRealtime(dispatch: (event: RealtimeEvent) => void = (event) => window.dispatchEvent(new CustomEvent("via-realtime", { detail: event }))): () => void {
  let stopped = false;
  let controller: AbortController | null = null;
  let lastId = "";
  let delay = 3000;

  async function run() {
    while (!stopped) {
      controller = new AbortController();
      try {
        const headers: Record<string, string> = { Accept: "text/event-stream" };
        if (lastId) headers["Last-Event-ID"] = lastId;
        const response = await auth.authorizedFetch("/v1/events", { headers, signal: controller.signal });
        if (response.status === 429) delay = 15000;       // too many open streams for this user: back off
        if (response.ok && response.body) {
          delay = 3000;
          const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
          let buffer = "";
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += value;
            const parsed = parseSse(buffer);
            buffer = parsed.rest;
            for (const message of parsed.messages) {
              if (message.id) lastId = message.id;
              let data: any = message.data;
              try { data = JSON.parse(message.data); } catch { /* keep the text */ }
              dispatch({ event: message.event, data });
            }
          }
        }
      } catch (error) {
        if (stopped) return;
        if ((error as { status?: number })?.status === 401) return;   // the session ended: the app signs out by itself
      }
      if (!stopped) await new Promise((resolve) => window.setTimeout(resolve, delay));
    }
  }

  void run();
  return () => { stopped = true; controller?.abort(); };
}
