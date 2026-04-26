import { createAutosave } from "@/lib/autosave";

describe("createAutosave — debounce", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  test("rapid triggers produce one patch call, not many", () => {
    const patch = jest.fn().mockResolvedValue(true);
    const autosave = createAutosave("doc-1", 2000, patch);

    const json1 = { type: "doc", content: [{ type: "text", text: "a" }] };
    const json2 = { type: "doc", content: [{ type: "text", text: "ab" }] };
    const json3 = { type: "doc", content: [{ type: "text", text: "abc" }] };

    autosave.trigger(json1);
    autosave.trigger(json2);
    autosave.trigger(json3);

    expect(patch).not.toHaveBeenCalled();

    jest.advanceTimersByTime(2000);

    expect(patch).toHaveBeenCalledTimes(1);
    expect(patch).toHaveBeenCalledWith("doc-1", json3);
  });

  test("does not fire before the delay elapses", () => {
    const patch = jest.fn().mockResolvedValue(true);
    const autosave = createAutosave("doc-1", 2000, patch);

    autosave.trigger({ type: "doc", content: [] });
    jest.advanceTimersByTime(1999);

    expect(patch).not.toHaveBeenCalled();
  });

  test("cancel prevents the pending save from firing", () => {
    const patch = jest.fn().mockResolvedValue(true);
    const autosave = createAutosave("doc-1", 2000, patch);

    autosave.trigger({ type: "doc", content: [] });
    autosave.cancel();
    jest.advanceTimersByTime(3000);

    expect(patch).not.toHaveBeenCalled();
  });

  test("separate triggers after delay each fire once", () => {
    const patch = jest.fn().mockResolvedValue(true);
    const autosave = createAutosave("doc-1", 2000, patch);

    autosave.trigger({ type: "doc", content: [] });
    jest.advanceTimersByTime(2000);
    expect(patch).toHaveBeenCalledTimes(1);

    autosave.trigger({ type: "doc", content: [] });
    jest.advanceTimersByTime(2000);
    expect(patch).toHaveBeenCalledTimes(2);
  });
});
