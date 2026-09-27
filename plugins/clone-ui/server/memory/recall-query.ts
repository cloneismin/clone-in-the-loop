const STOP_WORDS = new Set(
  "a an and are as at be been but by can could did do does for from had has have how i if in into is it its may me my of on or our please should so some than that the their them then there these they this to us was we were what when where which who why will with would you your".split(
    " ",
  ),
);

const CJK = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u;

export function recallQueries(context: string): string[] {
  const tokens =
    context
      .normalize("NFKC")
      .toLowerCase()
      .match(/[\p{L}\p{N}]+/gu) ?? [];
  const words = new Set<string>();
  const cjk = new Set<string>();
  for (const token of tokens) {
    if (token.length < 2 || token.length > 64 || /^\p{N}+$/u.test(token) || STOP_WORDS.has(token)) continue;
    if (CJK.test(token)) {
      if (cjk.size < 4) cjk.add(token);
    } else if (words.size < 24) {
      words.add(token);
    }
  }
  const queries = [...cjk];
  if (words.size) queries.unshift([...words].join(" OR "));
  return queries;
}
