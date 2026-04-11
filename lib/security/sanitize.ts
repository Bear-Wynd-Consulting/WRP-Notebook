/**
 * XSS prevention via DOMPurify (isomorphic — works server-side and client-side).
 *
 * Apply sanitizeContent() to all user-generated and AI-generated content
 * before rendering in React or storing to the database.
 */
import DOMPurify from "isomorphic-dompurify";

// Allowed HTML tags for rich text content
const ALLOWED_TAGS = [
  "p", "br", "strong", "em", "ul", "ol", "li",
  "h1", "h2", "h3", "h4", "h5", "h6",
  "code", "pre", "blockquote", "a", "table",
  "thead", "tbody", "tr", "th", "td",
  "hr", "del", "ins",
];

/**
 * Sanitize HTML content to prevent XSS.
 * Use on all note/source/AI-generated content before rendering or storage.
 */
export function sanitizeContent(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR: ["href", "target", "rel"],
    ALLOW_DATA_ATTR: false,
  }) as string;
}

/**
 * Strip all HTML tags — for plain text contexts.
 */
export function stripHtml(html: string): string {
  return DOMPurify.sanitize(html, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] }) as string;
}
