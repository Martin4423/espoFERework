import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../http.ts", () => ({ apiJson: async () => ({ items: [] }) }));

import { rememberUsers, mentionedIds, clearLookupCache } from "./lookup.ts";
import { setSchema } from "./schema.ts";
import { toScreenHistory, toScreenNote } from "./stream.ts";
import { toScreenNotification } from "./notifications.ts";
import type { ViaEntityMeta } from "./metadata.ts";

const f = (key: string, type: string, properties: Record<string, unknown> = {}) => ({ key, type, label: key, required: false, readOnly: false, core: false, properties });
beforeEach(() => {
  setSchema([{ key: "deal", labelSingular: "Deal", labelPlural: "Deals", hasOwner: true, hasTeams: true, builtIn: true,
    fields: [f("name", "string"), f("amount", "decimal", { scale: 2 }), f("ownerId", "link", { target: "user" }), f("account", "link", { target: "account" }), f("closeAt", "dateTime")] }] as unknown as ViaEntityMeta[]);
  clearLookupCache();
});

describe("notes", () => {
  it("becomes a Post of the stream", () => {
    const note = toScreenNote({ id: "n1", entity: "deal", recordId: "d1", authorId: "u1", authorName: "Ada", body: "Hello @Bob", mentions: ["u2"], createdAt: "2026-01-15T12:00:00.123456Z", updatedAt: "2026-01-15T12:05:00.000000Z", edited: true });
    expect(note).toMatchObject({ id: "n1", type: "Post", post: "Hello @Bob", parentType: "Deal", parentId: "d1", createdAt: "2026-01-15 12:00:00", createdByName: "Ada", createdById: "u1", isEdited: true });
  });
});

describe("history", () => {
  const names = new Map([["u1", "Ada"], ["u2", "Bob"]]);

  it("turns an update into an Update note with was and became in screen attributes", () => {
    const row = toScreenHistory("deal", "d1", { id: 5, action: "update", actorId: "u1", at: "2026-01-15T12:00:00.000000Z",
      changes: { name: { from: "A", to: "B" }, amount: { from: "1.00", to: "2.50" }, ownerId: { from: "u1", to: "u2" }, accountId: { from: null, to: "a1" }, closeAt: { to: "2026-02-01T10:00:00.000000Z" } } }, names)!;
    expect(row).toMatchObject({ id: "h5", type: "Update", parentType: "Deal", createdByName: "Ada" });
    expect(row.data.fields).toEqual(["name", "amount", "assignedUser", "account", "closeAt"]);
    expect(row.data.attributes.was).toMatchObject({ name: "A", amount: 1, assignedUserId: "u1", assignedUserName: "Ada", accountId: null });
    expect(row.data.attributes.became).toMatchObject({ name: "B", amount: 2.5, assignedUserId: "u2", assignedUserName: "Bob", accountId: "a1", closeAt: "2026-02-01 10:00:00" });
  });

  it("turns a create into a Create note and drops deletions", () => {
    expect(toScreenHistory("deal", "d1", { id: 1, action: "create", actorId: null, at: "2026-01-15T12:00:00.000000Z", changes: { name: { to: "A" } } }, names)).toMatchObject({ type: "Create", createdByName: "" });
    expect(toScreenHistory("deal", "d1", { id: 2, action: "delete", actorId: "u1", at: "2026-01-15T12:00:00.000000Z", changes: {} }, names)).toBeNull();
  });
});

describe("mentions", () => {
  it("finds the users whose name follows an @, the longest name first", () => {
    rememberUsers([{ id: "u1", name: "Eva" }, { id: "u2", name: "Eva Nováková" }, { id: "u3", name: "Jan" }]);
    expect(mentionedIds("Hi @Eva Nováková and @Jan, not @Evan").sort()).toEqual(["u2", "u3"]);
    expect(mentionedIds("@Eva and @Eva Nováková").sort()).toEqual(["u1", "u2"]);
  });
  it("ignores names without an @ and caps the list at twenty", () => {
    rememberUsers(Array.from({ length: 30 }, (_, i) => ({ id: `u${i}`, name: `User${String(i).padStart(2, "0")}` })));
    expect(mentionedIds("User01 without at")).toEqual([]);
    expect(mentionedIds(Array.from({ length: 30 }, (_, i) => `@User${String(i).padStart(2, "0")}`).join(" "))).toHaveLength(20);
  });
});

describe("notifications", () => {
  const base = { id: "x", entity: "deal", recordId: "d1", noteId: "n1", actorId: "u1", actorName: "Ada", payload: { snippet: "Hello" }, createdAt: "2026-01-15T12:00:00.000000Z", read: false };
  it("maps a note, a mention and an assignment to the screens' types", () => {
    expect(toScreenNotification({ ...base, kind: "note" })).toMatchObject({ type: "Note", read: false, createdByName: "Ada", noteData: { post: "Hello", parentType: "Deal", parentId: "d1" } });
    expect(toScreenNotification({ ...base, kind: "mention" })).toMatchObject({ type: "MentionInPost" });
    expect(toScreenNotification({ ...base, kind: "assignment", noteId: null })).toMatchObject({ type: "Assign", relatedType: "Deal", relatedId: "d1" });
  });
});
