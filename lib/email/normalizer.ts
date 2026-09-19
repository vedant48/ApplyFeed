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
