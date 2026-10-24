/* Local-only Hunspell worker bridge. Works with classic scripts, including file://. */
(() => {
  "use strict";
  let worker, workerURL, readyTimer, ready, readyResolve, readyReject, current;
  function releaseWorkerURL() {
    if (workerURL) URL.revokeObjectURL(workerURL);
    workerURL = undefined;
  }
  const scripts = new Map();
  function loadScript(path) {
    if (scripts.has(path)) return scripts.get(path);
    const promise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = new URL(path, document.baseURI).href;
      script.onload = resolve;
      script.onerror = () => {
        scripts.delete(path);
        script.remove();
        reject(
          new Error(
            "검사 파일을 불러오지 못했습니다. ZIP의 vendor 폴더도 앱과 함께 복사해 주세요.",
          ),
        );
      };
      document.head.append(script);
    });
    scripts.set(path, promise);
    return promise;
  }
  function reset(error) {
    worker?.terminate();
    worker = undefined;
    clearTimeout(readyTimer);
    releaseWorkerURL();
    ready = undefined;
    readyReject?.(error);
    readyResolve = undefined;
    readyReject = undefined;
    const pending = current;
    current = undefined;
    pending?.reject(error);
  }
  async function ensure() {
    await Promise.all([
      loadScript("vendor/hunspell-engine.js"),
      loadScript("vendor/korean-dictionary.js"),
    ]);
    if (ready) return ready;
    if (typeof Worker !== "function" || typeof WebAssembly !== "object")
      throw new Error(
        "이 브라우저에서는 검사 엔진을 실행할 수 없습니다. 최신 Safari, Chrome 또는 Edge로 열어 주세요.",
      );
    ready = new Promise((resolve, reject) => {
      readyResolve = resolve;
      readyReject = reject;
    });
    const initialization = ready;
    const url = (workerURL = URL.createObjectURL(
      new Blob([self.YeobaekHunspellWorkerSource], { type: "text/javascript" }),
    ));
    try {
      worker = new Worker(url);
    } catch (error) {
      reset(
        new Error(
          "이 브라우저에서 검사 실행이 차단되었습니다. 최신 Safari, Chrome 또는 Edge로 다시 열어 주세요.",
        ),
      );
      return initialization;
    }
    // Keep the Blob URL alive until the worker has read and initialized it.
    readyTimer = setTimeout(
      () =>
        reset(
          new Error(
            "검사 엔진 준비가 지연되었습니다. 창을 닫고 다시 시도해 주세요.",
          ),
        ),
      30000,
    );
    worker.onmessage = ({ data }) => {
      if (data.type === "ready") {
        clearTimeout(readyTimer);
        releaseWorkerURL();
        readyResolve?.();
        readyResolve = undefined;
        readyReject = undefined;
      }
      if (data.type === "progress") current?.onProgress?.(data);
      if (data.type === "result") {
        const done = current;
        current = undefined;
        done?.resolve(data);
      }
      if (data.type === "error") {
        const error = new Error(data.message);
        error.code = data.code;
        reset(error);
      }
    };
    worker.onerror = (event) => {
      event.preventDefault();
      reset(
        new Error(
          "검사 엔진을 실행하지 못했습니다. 최신 브라우저에서 다시 열어 주세요.",
        ),
      );
    };
    worker.postMessage({
      type: "init",
      dictionary: self.YeobaekKoreanDictionary,
    });
    return ready;
  }
  function check(text, { words = [], signal, onProgress } = {}) {
    return new Promise((resolve, reject) => {
      const abortError = () =>
        new DOMException("검사를 취소했습니다.", "AbortError");
      const abort = () => {
        reset(abortError());
        reject(abortError());
      };
      if (signal?.aborted) {
        reject(abortError());
        return;
      }
      signal?.addEventListener("abort", abort, { once: true });
      const finish = (callback, value) => {
        signal?.removeEventListener("abort", abort);
        callback(value);
      };
      (async () => {
        await ensure();
        if (signal?.aborted) throw abortError();
        if (current)
          throw new Error(
            "진행 중인 검사가 있습니다. 잠시 후 다시 시도해 주세요.",
          );
        current = {
          resolve: (data) => finish(resolve, data),
          reject: (error) => finish(reject, error),
          onProgress,
        };
        worker.postMessage({ type: "check", text, words });
      })().catch((error) => finish(reject, error));
    });
  }
  window.YeobaekSpellEngine = Object.freeze({ check });
})();
