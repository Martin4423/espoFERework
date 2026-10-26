import { describe, expect, it } from "vitest";
import { publicRoute } from "./client.ts";

describe("publicRoute", () => {
  it("recognises the three public pages", () => {
    expect(publicRoute({ pathname: "/reset-password", search: "?token=abc" })).toEqual({ page: "reset-password", token: "abc" });
    expect(publicRoute({ pathname: "/lead-confirm/", search: "?token=x_y" })).toEqual({ page: "lead-confirm", token: "x_y" });
    expect(publicRoute({ pathname: "/forms/0198-aa", search: "" })).toEqual({ page: "lead-form", id: "0198-aa" });
  });
  it("leaves the application alone", () => {
    expect(publicRoute({ pathname: "/", search: "" })).toBeNull();
    expect(publicRoute({ pathname: "/forms/a/b", search: "" })).toBeNull();
  });
  it("gives an empty token when none is in the address", () => {
    expect(publicRoute({ pathname: "/reset-password", search: "" })).toEqual({ page: "reset-password", token: "" });
  });
});
