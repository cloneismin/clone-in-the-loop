import DOMPurify from "dompurify";
import { Marked } from "marked";
import { unsafeHTML } from "lit/directives/unsafe-html.js";

const markdown = new Marked({
  gfm: true,
  breaks: true,
  renderer: {
    checkbox: ({ checked }) => (checked ? "☑ " : "☐ "),
  },
});

export function parseMarkdown(content: string): string {
  return markdown.parse(String(content || ""), { async: false });
}

export function renderMarkdown(content: string) {
  const clean = DOMPurify.sanitize(parseMarkdown(content), {
    ALLOWED_TAGS: [
      "a",
      "p",
      "br",
      "hr",
      "h1",
      "h2",
      "h3",
      "h4",
      "h5",
      "h6",
      "ul",
      "ol",
      "li",
      "strong",
      "b",
      "em",
      "i",
      "del",
      "s",
      "sup",
      "sub",
      "blockquote",
      "pre",
      "code",
      "table",
      "thead",
      "tbody",
      "tr",
      "th",
      "td",
    ],
    ALLOWED_ATTR: ["href", "title", "start", "colspan", "rowspan"],
    ALLOWED_URI_REGEXP: /^(?:https?:|mailto:|\/(?:[^/]|$)|#)/i,
    ALLOW_DATA_ATTR: false,
    ALLOW_ARIA_ATTR: false,
    RETURN_TRUSTED_TYPE: false,
  });
  return unsafeHTML(clean.replaceAll("<a ", '<a target="_blank" rel="noopener noreferrer" '));
}
