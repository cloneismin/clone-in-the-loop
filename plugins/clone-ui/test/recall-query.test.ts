import assert from "node:assert/strict";
import test from "node:test";
import { recallQueries } from "../server/memory/recall-query.ts";

const KOREAN_LAUNCH = "\ucd9c\uc2dc";
const KOREAN_USER = "\uc0ac\uc6a9\uc790";
const CJK_EXPERIENCE = "\u7528\u6237\u4f53\u9a13";
const FULLWIDTH_LAUNCH = "\uff2c\uff21\uff35\uff2e\uff23\uff28";

test("conversational recall treats quotes and negation as context rather than search operators", () => {
  assert.deepEqual(recallQueries('Please review our launch pitch: "AI for everything." -launch'), [
    "review OR launch OR pitch OR ai OR everything",
  ]);
  assert.deepEqual(recallQueries("the OR and 123 ?"), []);
});

test("mixed-language recall keeps CJK terms out of the websearch OR expression", () => {
  assert.deepEqual(
    recallQueries(`Review "${KOREAN_LAUNCH}" launch ${CJK_EXPERIENCE} ${KOREAN_LAUNCH} ${FULLWIDTH_LAUNCH}`),
    ["review OR launch", KOREAN_LAUNCH, CJK_EXPERIENCE],
  );
});

test("automatic recall bounds term counts and discards oversized tokens", () => {
  const cjkTerms = [KOREAN_LAUNCH, KOREAN_USER, "\uac80\ud1a0", "\uacb0\uacfc", "\uacc4\ud68d"];
  const queries = recallQueries(
    `${Array.from({ length: 50 }, (_, index) => `term${index}`).join(" ")} ${cjkTerms.join(" ")} ${"z".repeat(100)}`,
  );
  assert.equal(queries.length, 5);
  assert.equal(queries[0]?.split(" OR ").length, 24);
  assert.ok(queries.every((query) => !query.includes("z".repeat(100))));
});
