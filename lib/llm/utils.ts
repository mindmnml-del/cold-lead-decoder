export function escapeXmlTags(text: string): string {
  return text.replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
