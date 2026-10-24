"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const context = { window: {} };
vm.runInNewContext(
  fs.readFileSync(path.join(__dirname, "..", "proofread.js"), "utf8"),
  context,
);
const { findIssues } = context.window.YeobaekProofread;

function apply(text, issues) {
  for (const issue of [...issues].reverse()) {
    assert.equal(text.slice(issue.start, issue.end), issue.original);
    text =
      text.slice(0, issue.start) + issue.replacement + text.slice(issue.end);
  }
  return text;
}

test("suggests common Korean typos and applies all with stable offsets", () => {
  const source =
    "됬다. 어의없다. 몇일 후 금새 역활을 정할께. 설겆이는 왠만하면 오랫만에.";
  const issues = findIssues(source);
  assert.equal(issues.length, 9);
  assert.equal(
    apply(source, issues),
    "됐다. 어이없다. 며칠 후 금세 역할을 정할게. 설거지는 웬만하면 오랜만에.",
  );
  assert.ok(issues.every((issue) => issue.reason.length > 0));
});

test("UTF-16 offsets remain correct with emoji, newlines, quotes, and repeats", () => {
  const source = "🌿 서연: “됬어.”\n도윤: “됬어?” 어의 없네.\n내가 잘할께요.";
  const issues = findIssues(source);
  assert.equal(issues.length, 4);
  assert.equal(
    apply(source, issues),
    "🌿 서연: “됐어.”\n도윤: “됐어?” 어이 없네.\n내가 잘할게요.",
  );
  for (let i = 1; i < issues.length; i++)
    assert.ok(issues[i - 1].end <= issues[i].start);
});

test("avoids broad contextual correction and proper-name substrings", () => {
  const source =
    "서연과 도윤은 오래간만에 만났다. 어의는 왕을 진료했다.\n안 돼. 되었다. 돼지. 왠지 웬만하면 오랫동안. 난 안할래.\n김역활이라는 이름. 백설겆이라는 이름. 하지 않을께름.";
  assert.equal(findIssues(source).length, 0);
});

test("correct text is unchanged and scanner state does not leak between runs", () => {
  const text =
    "며칠 후 금세 돌아왔다. 오랜만이다. 곰곰이 생각하며 일일이 살폈다. 내가 할게.";
  assert.equal(findIssues(text).length, 0);
  assert.equal(findIssues("몇일 후").length, 1);
  assert.equal(findIssues("몇일 후").length, 1);
  assert.equal(findIssues(null).length, 0);
});

test("adverb-only and endings guards avoid matching longer words", () => {
  assert.equal(findIssues("웬지름 금새김 곰곰히니 할께름 일일히든").length, 0);
  assert.equal(
    apply("웬지 곰곰히 일일히", findIssues("웬지 곰곰히 일일히")),
    "왠지 곰곰이 일일이",
  );
});
