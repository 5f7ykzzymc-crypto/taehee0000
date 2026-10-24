// Browser worker entry. Bundled with the unmodified upstream Hunspell library.
import initialize from "hunspell-wasm/wasm/hunspell.js";
import { Hunspell } from "hunspell-wasm/dist/Hunspell.js";
import wasmBase64 from "yeobaek:wasm";
let engine;
function decode(value) {
  return Uint8Array.from(atob(value), (c) => c.charCodeAt(0));
}
async function unpack(value) {
  const stream = new Blob([decode(value)])
    .stream()
    .pipeThrough(new DecompressionStream("gzip"));
  return new Response(stream).text();
}
const suffixes = [
  "",
  "은",
  "는",
  "이",
  "가",
  "을",
  "를",
  "의",
  "도",
  "와",
  "과",
  "에게",
  "에게서",
  "한테",
  "한테서",
  "로",
  "으로",
  "랑",
  "이랑",
  "처럼",
  "보다",
  "까지",
  "부터",
  "만",
  "아",
  "야",
  "이라고",
  "라고",
  "이라",
  "라",
  "이라서",
  "라서",
  "이야",
  "이가",
  "이는",
  "이도",
  "이를",
  "이의",
  "이에게",
  "이한테",
  "이었다",
  "였다",
  "이라면",
  "라면",
];
self.onmessage = async ({ data }) => {
  try {
    if (data.type === "init") {
      const [aff, dic, wasm] = await Promise.all([
        unpack(data.dictionary.aff),
        unpack(data.dictionary.dic),
        initialize({ wasmBinary: decode(wasmBase64) }),
      ]);
      engine = new Hunspell(wasm, aff, dic);
      self.postMessage({ type: "ready" });
      return;
    }
    if (data.type !== "check" || !engine)
      throw new Error("검사 엔진을 준비하지 못했습니다.");
    const allow = new Set();
    for (const word of data.words)
      for (const suffix of suffixes)
        allow.add((word + suffix).normalize("NFC"));
    const matches = [...data.text.matchAll(/[가-힣ᄀ-ᇿㄱ-ㆎ]+/gu)];
    const cache = new Map(),
      issues = [],
      allowedRanges = [];
    self.postMessage({ type: "progress", checked: 0, total: matches.length });
    for (let i = 0; i < matches.length; i++) {
      const match = matches[i],
        word = match[0].normalize("NFC");
      if (allow.has(word))
        allowedRanges.push({
          start: match.index,
          end: match.index + match[0].length,
        });
      else {
        if (!cache.has(word)) {
          const valid = engine.testSpelling(word);
          const suggestions = valid
            ? []
            : [
                ...new Set(
                  engine
                    .getSpellingSuggestions(word)
                    .map((v) => v.normalize("NFC")),
                ),
              ]
                .filter((v) => v !== word)
                .slice(0, 6);
          cache.set(word, { valid, suggestions });
        }
        const entry = cache.get(word);
        if (!entry.valid)
          issues.push({
            start: match.index,
            end: match.index + match[0].length,
            original: match[0],
            replacement: entry.suggestions[0] || "",
            suggestions: entry.suggestions,
            reason:
              "한국어 사전에서 확인되지 않는 표현입니다. 인물 이름·대사·신조어는 그대로 두거나 나만의 사전에 추가하세요.",
          });
      }
      if (i % 10 === 9 || i === matches.length - 1)
        self.postMessage({
          type: "progress",
          checked: i + 1,
          total: matches.length,
        });
    }
    self.postMessage({
      type: "result",
      issues,
      checked: matches.length,
      allowedRanges,
    });
  } catch (error) {
    self.postMessage({
      type: "error",
      message: error.message || "맞춤법 검사 중 오류가 발생했습니다.",
    });
  }
};
