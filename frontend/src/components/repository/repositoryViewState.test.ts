import { describe, expect, it } from "vitest";

import {
  readRepositoryExpansion,
  repositoryExpansionStorageKey,
  storeRepositoryExpansion,
} from "./repositoryViewState";

describe("repository view state", () => {
  it("uses a separate expansion key for every view", () => {
    expect(repositoryExpansionStorageKey("tree")).toBe("fet-repository-expansion:tree");
    expect(repositoryExpansionStorageKey("folders")).not.toBe(repositoryExpansionStorageKey("tree"));
  });

  it("validates persisted expansion values", () => {
    const storage = {
      getItem: () => JSON.stringify({ collapsedIds: [3, 3, -1, "4"], rootCollapsed: true }),
    };
    expect(readRepositoryExpansion("key", storage)).toEqual({ collapsedIds: [3], rootCollapsed: true });
    expect(readRepositoryExpansion("key", { getItem: () => "invalid" })).toEqual({
      collapsedIds: [],
      rootCollapsed: false,
    });
  });

  it("stores a serializable expansion state", () => {
    let stored = "";
    storeRepositoryExpansion(
      "key",
      { collapsedIds: [1, 2], rootCollapsed: false },
      { setItem: (_key, value) => { stored = value; } },
    );
    expect(JSON.parse(stored)).toEqual({ collapsedIds: [1, 2], rootCollapsed: false });
  });
});
