export function extractLinks(content: string): string[] {
  if (!content) return [];
  const urlRegex = /(https?:\/\/[^\s"'<>()]+)/gi;
  const matches = content.match(urlRegex) || [];
  // Deduplicate and filter out obvious asset/tracking pixel links
  const unique = Array.from(new Set(matches));
  return unique.filter(link => {
    const l = link.toLowerCase();
    return !l.endsWith('.png') && !l.endsWith('.jpg') && !l.endsWith('.gif') && !l.endsWith('.svg');
  });
}

export function stripHtml(html: string): string {
  if (!html) return '';
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export function extractDomainFromEmail(email: string): string | null {
  if (!email) return null;
  const parts = email.split('@');
  if (parts.length < 2) return null;
  return parts[1].trim().toLowerCase();
}

export function cleanSnippet(text: string, maxLength: number = 200): string {
  const stripped = stripHtml(text);
  if (stripped.length <= maxLength) return stripped;
  return stripped.substring(0, maxLength).trim() + '...';
}

/**
 * Detects whether a plain text email body is merely a dummy placeholder inserted
 * by email systems (e.g. "Please Enable HTML", "To view this email, please enable HTML", etc.)
 */
export function isPlaceholderPlainText(text: string | null | undefined): boolean {
  if (!text) return true;
  const trimmed = text.trim();
  if (trimmed.length === 0) return true;

  const placeholderRegexes = [
    /^(please\s+)?(enable\s+html|view\s+in\s+browser|switch\s+to\s+html)/i,
    /^(to\s+view|if\s+you\s+are\s+unable\s+to\s+view).*?(enable\s+html|web\s+browser)/i,
    /please\s+enable\s+html/i,
    /this\s+email\s+requires\s+html/i,
    /^please\s+enable\s+javascript/i,
  ];

  return placeholderRegexes.some(rx => rx.test(trimmed));
}

/**
 * Intelligently chooses the best body text between plainText, html, and snippet.
 * Guarantees that dummy placeholders like "Please Enable HTML" are rejected in favor of
 * stripped text from the rich HTML payload.
 */
export function resolveBestBodyText(plainText: string, html: string, snippet: string): string {
  const strippedHtml = html ? stripHtml(html) : '';
  const isPlainPlaceholder = isPlaceholderPlainText(plainText);

  // If plainText is a placeholder, discard it immediately in favor of stripped HTML
  if (isPlainPlaceholder) {
    return strippedHtml || snippet || '';
  }

  const plainTrimmed = plainText.trim();
  // If plainText is extremely short (< 60 chars) and stripped HTML has significantly richer content
  if (plainTrimmed.length < 60 && strippedHtml.length > 120) {
    return strippedHtml;
  }

  return plainTrimmed || strippedHtml || snippet || '';
}

