/**
 * Unit tests for LayerInterface — the layer-type plugin renderer contract +
 * dispatcher. Covers normalizeOp/getPhase/hasOp shorthand handling and the
 * run() phase pipeline (before → main ?? coreDefault → after), including the
 * always-async return shape that GlobeRenderer.addLayer/Map_ rely on.
 */

import { test, expect } from "@playwright/test";

const {
  normalizeOp,
  getPhase,
  hasOp,
  run,
  runSync,
  LAYER_OPS,
  OP_PHASES,
  MAKE_EXTRA_PHASES,
} = require("../../src/essence/Basics/Layers_/interface/LayerInterface");

test.describe("LayerInterface constants", () => {
  test("canonical operation + phase vocabulary is stable", () => {
    expect(LAYER_OPS).toEqual([
      "make",
      "render",
      "destroy",
      "setOpacity",
      "setVisibility",
      "onToggle",
      "setStyle",
      "timeChange",
    ]);
    expect(OP_PHASES).toEqual(["before", "main", "after"]);
    expect(MAKE_EXTRA_PHASES).toEqual(["afterCommit"]);
  });
});

test.describe("normalizeOp / getPhase / hasOp", () => {
  test("a bare function is sugar for { main: fn }", () => {
    const fn = () => {};
    expect(normalizeOp(fn)).toEqual({ main: fn });
  });

  test("a phase object passes through unchanged", () => {
    const op = { before() {}, main() {} };
    expect(normalizeOp(op)).toBe(op);
  });

  test("null/undefined/invalid normalize to null", () => {
    expect(normalizeOp(null)).toBeNull();
    expect(normalizeOp(undefined)).toBeNull();
    expect(normalizeOp(42)).toBeNull();
  });

  test("getPhase resolves shorthand main and named phases", () => {
    const main = () => {};
    const before = () => {};
    const shorthand = { make: main };
    const phased = { make: { before, main } };

    expect(getPhase(shorthand, "make", "main")).toBe(main);
    expect(getPhase(shorthand, "make", "before")).toBeNull();
    expect(getPhase(phased, "make", "before")).toBe(before);
    expect(getPhase(phased, "make", "main")).toBe(main);
    // Non-function phase values resolve to null.
    expect(getPhase({ make: { main: "nope" } }, "make", "main")).toBeNull();
    expect(getPhase(null, "make", "main")).toBeNull();
  });

  test("hasOp detects any defined operation, including shorthand", () => {
    expect(hasOp({ make: () => {} }, "make")).toBe(true);
    expect(hasOp({ make: { after() {} } }, "make")).toBe(true);
    expect(hasOp({ make: () => {} }, "destroy")).toBe(false);
    expect(hasOp(null, "make")).toBe(false);
  });
});

test.describe("run() pipeline", () => {
  test("runs before → main → after in order and returns main result", async () => {
    const calls = [];
    const surfaceModule = {
      make: {
        before() {
          calls.push("before");
        },
        main() {
          calls.push("main");
          return "handle";
        },
        after() {
          calls.push("after");
        },
      },
    };

    const result = await run(surfaceModule, "make", ["arg"]);
    expect(calls).toEqual(["before", "main", "after"]);
    expect(result).toBe("handle");
  });

  test("falls back to coreDefault when the plugin defines no main", async () => {
    const calls = [];
    const surfaceModule = {
      make: {
        before() {
          calls.push("before");
        },
        after() {
          calls.push("after");
        },
      },
    };

    const result = await run(surfaceModule, "make", [], {
      coreDefault() {
        calls.push("coreDefault");
        return "core-handle";
      },
    });

    // before/after still wrap the core default.
    expect(calls).toEqual(["before", "coreDefault", "after"]);
    expect(result).toBe("core-handle");
  });

  test("plugin main overrides coreDefault (default not called)", async () => {
    let coreCalled = false;
    const result = await run({ make: () => "plugin" }, "make", [], {
      coreDefault() {
        coreCalled = true;
        return "core";
      },
    });
    expect(result).toBe("plugin");
    expect(coreCalled).toBe(false);
  });

  test("always returns a Promise and awaits async phases in order", async () => {
    const calls = [];
    const surfaceModule = {
      make: {
        async before() {
          await Promise.resolve();
          calls.push("before");
        },
        async main() {
          await Promise.resolve();
          calls.push("main");
          return "async-handle";
        },
      },
    };

    const ret = run(surfaceModule, "make", []);
    expect(typeof ret.then).toBe("function");
    expect(await ret).toBe("async-handle");
    expect(calls).toEqual(["before", "main"]);
  });

  test("with neither main nor coreDefault, resolves undefined but still runs before/after", async () => {
    const calls = [];
    const result = await run(
      {
        setStyle: {
          before() {
            calls.push("before");
          },
          after() {
            calls.push("after");
          },
        },
      },
      "setStyle",
      [],
    );
    expect(result).toBeUndefined();
    expect(calls).toEqual(["before", "after"]);
  });

  test("a rejecting phase rejects the returned Promise", async () => {
    const surfaceModule = {
      make() {
        throw new Error("boom");
      },
    };
    await expect(run(surfaceModule, "make", [])).rejects.toThrow("boom");
  });

  test("afterCommit is NOT run by run() (driven by the caller post-lock)", async () => {
    let afterCommitCalled = false;
    await run(
      {
        make: {
          main() {
            return "h";
          },
          afterCommit() {
            afterCommitCalled = true;
          },
        },
      },
      "make",
      [],
    );
    expect(afterCommitCalled).toBe(false);
  });
});

test.describe("runSync() pipeline — synchronous map/globe dispatch", () => {
  // Both engines run layer ops synchronously and callers rely on ordering
  // (map reads state after; globe cleans up after), so runSync must run
  // inline and NOT defer main onto a microtask / return a Promise.

  test("runs before → main → after inline and returns the main result", () => {
    const calls = [];
    const surfaceModule = {
      setOpacity: {
        before() {
          calls.push("before");
        },
        main() {
          calls.push("main");
          return "ok";
        },
        after() {
          calls.push("after");
        },
      },
    };

    const result = runSync(surfaceModule, "setOpacity", ["arg"]);
    // Fully synchronous — not a thenable.
    expect(result).toBe("ok");
    expect(calls).toEqual(["before", "main", "after"]);
  });

  test("falls back to coreDefault when the plugin defines no main", () => {
    const calls = [];
    const surfaceModule = {
      setVisibility: {
        before() {
          calls.push("before");
        },
        after() {
          calls.push("after");
        },
      },
    };

    const result = runSync(surfaceModule, "setVisibility", [], {
      coreDefault() {
        calls.push("coreDefault");
        return "core";
      },
    });

    expect(result).toBe("core");
    expect(calls).toEqual(["before", "coreDefault", "after"]);
  });

  test("plugin main overrides coreDefault (default not called)", () => {
    let coreCalled = false;
    const result = runSync({ destroy: () => "plugin" }, "destroy", [], {
      coreDefault() {
        coreCalled = true;
        return "core";
      },
    });
    expect(result).toBe("plugin");
    expect(coreCalled).toBe(false);
  });

  test("with no module and a coreDefault, runs the core default (built-in path)", () => {
    let ran = false;
    // Built-in types declare no map ops, so `LayerTypeRegistry.get(t)?.map`
    // is undefined and the core behavior must run unchanged.
    const result = runSync(undefined, "setStyle", [], {
      coreDefault() {
        ran = true;
        return "core-style";
      },
    });
    expect(ran).toBe(true);
    expect(result).toBe("core-style");
  });

  test("with no module and no coreDefault, is a no-op returning undefined", () => {
    expect(runSync(null, "setOpacity", [])).toBeUndefined();
  });

  test("runs main inline even when a before phase is async (no deferral)", () => {
    // The globe deletes its layer record right after dispatching destroy;
    // async run() would defer main past that cleanup once a before phase
    // exists. runSync must run main before control returns regardless.
    const calls = [];
    const surfaceModule = {
      destroy: {
        async before() {
          calls.push("before");
        },
        main() {
          calls.push("main");
        },
      },
    };
    runSync(surfaceModule, "destroy", []);
    // main already ran synchronously; core cleanup after this line is safe.
    expect(calls).toEqual(["before", "main"]);
  });

  test("reaches every canonical operation", () => {
    for (const op of LAYER_OPS) {
      let hit = null;
      const mod = {
        [op]() {
          hit = op;
          return op;
        },
      };
      expect(runSync(mod, op, [])).toBe(op);
      expect(hit).toBe(op);
    }
  });
});
