export type PatchFn = (documentId: string, tiptapJson: unknown) => Promise<boolean>;

export function createAutosave(
  documentId: string,
  delayMs: number,
  patchFn: PatchFn,
): { trigger: (json: unknown) => void; cancel: () => void } {
  let timerId: ReturnType<typeof setTimeout> | null = null;

  function trigger(json: unknown) {
    if (timerId !== null) clearTimeout(timerId);
    timerId = setTimeout(() => {
      timerId = null;
      void patchFn(documentId, json);
    }, delayMs);
  }

  function cancel() {
    if (timerId !== null) {
      clearTimeout(timerId);
      timerId = null;
    }
  }

  return { trigger, cancel };
}
