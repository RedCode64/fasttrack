import { describe, expect, it } from "vitest";

import {
  canAddClient,
  canAddDocument,
  canSync,
  FREE_CLIENT_CAP,
  FREE_DOCUMENT_CAP,
} from "./gating";

describe("canAddClient", () => {
  it("allows a free user below the cap", () => {
    expect(canAddClient(FREE_CLIENT_CAP - 1, false)).toBe(true);
  });
  it("blocks a free user at the cap", () => {
    expect(canAddClient(FREE_CLIENT_CAP, false)).toBe(false);
  });
  it("allows a Pro user past the cap", () => {
    expect(canAddClient(FREE_CLIENT_CAP + 50, true)).toBe(true);
  });
});

describe("canAddDocument", () => {
  it("allows a free user below the cap", () => {
    expect(canAddDocument(FREE_DOCUMENT_CAP - 1, false)).toBe(true);
  });
  it("blocks a free user at the cap", () => {
    expect(canAddDocument(FREE_DOCUMENT_CAP, false)).toBe(false);
  });
  it("allows a Pro user past the cap", () => {
    expect(canAddDocument(FREE_DOCUMENT_CAP + 50, true)).toBe(true);
  });
});

describe("canSync", () => {
  it("blocks free users", () => {
    expect(canSync(false)).toBe(false);
  });
  it("allows Pro users", () => {
    expect(canSync(true)).toBe(true);
  });
});
