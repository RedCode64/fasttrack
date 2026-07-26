import { describe, expect, it } from "vitest";

import {
  canAddClient,
  canAddDocument,
  canSync,
  capState,
  createDocumentWarning,
  FREE_CLIENT_CAP,
  FREE_DOCUMENT_CAP,
} from "./gating";

/**
 * The caps are a product decision, not an implementation detail: the paywall
 * copy, the App Store review notes, and `docs/appstore/pricing.md` all quote
 * them. Pinning the literals here means changing a cap has to be deliberate —
 * every other assertion below is relative to the constants and so would pass
 * at any value.
 */
describe("free tier caps", () => {
  it("allows 5 clients", () => {
    expect(FREE_CLIENT_CAP).toBe(5);
  });
  it("allows 10 documents — one estimate and one invoice per free client", () => {
    expect(FREE_DOCUMENT_CAP).toBe(10);
  });
});

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

/**
 * `capState` drives what the user is *told* before they invest effort in a
 * form; `canAddClient` / `canAddDocument` above remain the actual gate. A cap
 * of 5 is used throughout so the boundaries read concretely.
 */
describe("capState", () => {
  const CAP = 5;

  it("is ok while there is headroom", () => {
    expect(capState(0, CAP, false)).toBe("ok");
    expect(capState(3, CAP, false)).toBe("ok");
  });

  it("warns on the last free one", () => {
    expect(capState(CAP - 1, CAP, false)).toBe("last");
  });

  it("reports reached at the cap", () => {
    expect(capState(CAP, CAP, false)).toBe("reached");
  });

  it("still reports reached past the cap", () => {
    expect(capState(CAP + 3, CAP, false)).toBe("reached");
  });

  it("never warns a Pro user, at or past the cap", () => {
    expect(capState(CAP - 1, CAP, true)).toBe("ok");
    expect(capState(CAP, CAP, true)).toBe("ok");
    expect(capState(CAP + 50, CAP, true)).toBe("ok");
  });

  // The notice must never disagree with the gate: "reached" has to mean
  // blocked and nothing else, or the UI would promise work it can't do.
  it("reports reached exactly when canAddDocument blocks", () => {
    for (let count = 0; count <= FREE_DOCUMENT_CAP + 2; count += 1) {
      expect(capState(count, FREE_DOCUMENT_CAP, false) === "reached").toBe(
        !canAddDocument(count, false),
      );
    }
  });

  it("reports reached exactly when canAddClient blocks", () => {
    for (let count = 0; count <= FREE_CLIENT_CAP + 2; count += 1) {
      expect(capState(count, FREE_CLIENT_CAP, false) === "reached").toBe(
        !canAddClient(count, false),
      );
    }
  });
});

describe("createDocumentWarning", () => {
  const free = { clientCount: 0, documentCount: 0, isPro: false, createsNewClient: true };

  it("says nothing when there is headroom", () => {
    expect(createDocumentWarning(free)).toBeNull();
  });

  it("says nothing to a Pro user, however many they have", () => {
    expect(
      createDocumentWarning({
        ...free,
        clientCount: FREE_CLIENT_CAP + 9,
        documentCount: FREE_DOCUMENT_CAP + 9,
        isPro: true,
      }),
    ).toBeNull();
  });

  it("flags the client cap when a new client would exceed it", () => {
    expect(createDocumentWarning({ ...free, clientCount: FREE_CLIENT_CAP })).toEqual({
      kind: "client",
      state: "reached",
    });
  });

  it("ignores the client cap when reusing an existing client", () => {
    expect(
      createDocumentWarning({ ...free, clientCount: FREE_CLIENT_CAP, createsNewClient: false }),
    ).toBeNull();
  });

  it("flags the document cap regardless of client mode", () => {
    expect(
      createDocumentWarning({ ...free, documentCount: FREE_DOCUMENT_CAP, createsNewClient: false }),
    ).toEqual({ kind: "document", state: "reached" });
  });

  it("warns on the last free client", () => {
    expect(createDocumentWarning({ ...free, clientCount: FREE_CLIENT_CAP - 1 })).toEqual({
      kind: "client",
      state: "last",
    });
  });

  // A blocking cap always outranks a heads-up, whichever kind it is: telling
  // someone "last free client" while documents are already exhausted would
  // promise a create that cannot happen.
  it("prefers a blocking cap over a last-one warning", () => {
    expect(
      createDocumentWarning({
        ...free,
        clientCount: FREE_CLIENT_CAP - 1,
        documentCount: FREE_DOCUMENT_CAP,
      }),
    ).toEqual({ kind: "document", state: "reached" });
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
