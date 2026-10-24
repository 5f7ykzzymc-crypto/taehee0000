/* Offline suggestions for common Korean typos. Every replacement needs writer review. */
(() => {
  "use strict";

  // Deliberately avoid general 되/돼, 안/않, 띄어쓰기 and dialogue-style rules:
  // those need context that a small offline dictionary cannot reliably infer.
  const rules = [
    {
      pattern: /됬/gu,
      replacement: "됐",
      reason: "“되었”의 준말은 “됐”으로 적습니다.",
    },
    {
      pattern: /(?<![가-힣])어의(?=\s*없)/gu,
      replacement: "어이",
      reason: "황당하다는 뜻의 표현은 “어이없다”입니다.",
    },
    {
      pattern: /(?<![가-힣])몇일/gu,
      replacement: "며칠",
      reason: "날짜나 며칠 동안의 기간은 “며칠”로 적습니다.",
    },
    {
      pattern: /(?<![가-힣])금새(?=$|[^가-힣])/gu,
      replacement: "금세",
      reason:
        "“금시에”의 준말로 썼다면 “금세”입니다. 금의 시세를 뜻한 경우에는 유지하세요.",
    },
    {
      pattern: /(?<![가-힣])역활/gu,
      replacement: "역할",
      reason: "맡은 임무나 구실을 뜻하는 말은 “역할”입니다.",
    },
    {
      pattern: /할께(?=$|[^가-힣]|요)/gu,
      replacement: "할게",
      reason: "의지를 나타내는 종결 어미는 “-ㄹ게”로 적습니다.",
    },
    {
      pattern: /(?<![가-힣])설겆이/gu,
      replacement: "설거지",
      reason: "그릇을 씻는 일을 뜻하는 표준 표기는 “설거지”입니다.",
    },
    {
      pattern: /(?<![가-힣])왠만/gu,
      replacement: "웬만",
      reason: "정도나 형편을 나타내는 “웬만하다”의 표기를 확인하세요.",
    },
    {
      pattern: /(?<![가-힣])오랫만/gu,
      replacement: "오랜만",
      reason: "“오래간만”의 준말은 “오랜만”입니다.",
    },
    {
      pattern: /(?<![가-힣])웬지(?=$|[^가-힣])/gu,
      replacement: "왠지",
      reason: "“왜인지”의 준말은 “왠지”입니다.",
    },
    {
      pattern: /(?<![가-힣])일일히(?=$|[^가-힣])/gu,
      replacement: "일일이",
      reason: "하나씩 빠짐없이 한다는 뜻은 “일일이”로 적습니다.",
    },
    {
      pattern: /(?<![가-힣])곰곰히(?=$|[^가-힣])/gu,
      replacement: "곰곰이",
      reason: "깊이 생각하는 모양을 나타내는 말은 “곰곰이”입니다.",
    },
  ];

  /** Offsets use UTF-16 indices, matching textarea selectionStart/setRangeText. */
  function findIssues(text) {
    if (typeof text !== "string") return [];
    const candidates = [];
    for (const rule of rules) {
      rule.pattern.lastIndex = 0;
      for (const match of text.matchAll(rule.pattern)) {
        candidates.push({
          start: match.index,
          end: match.index + match[0].length,
          original: match[0],
          replacement: rule.replacement,
          reason: rule.reason,
        });
      }
    }
    candidates.sort((a, b) => a.start - b.start || b.end - a.end);
    const issues = [];
    let end = -1;
    for (const issue of candidates) {
      if (issue.start < end) continue;
      issues.push(issue);
      end = issue.end;
    }
    return issues;
  }

  window.YeobaekProofread = Object.freeze({ findIssues });
})();
