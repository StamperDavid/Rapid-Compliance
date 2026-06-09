/**
 * Office (OOXML) text extractor — Word (.docx) + PowerPoint (.pptx).
 *
 * Both formats are ZIP archives of XML. Rather than pull a heavy library
 * (officeparser ships 83MB incl. tesseract OCR — a Vercel function-size risk),
 * we unzip with the tiny pure-JS `fflate` and pull the text runs directly:
 *   - .docx → text inside <w:t> runs of word/document.xml
 *   - .pptx → text inside <a:t> runs of every ppt/slides/slideN.xml (slide order)
 *
 * Legacy binary .doc/.ppt are NOT OOXML (not zip) — they won't unzip and resolve
 * to '' (graceful; deep-reading them would need yet another parser).
 *
 * Pure text extraction only — good enough to feed a summarizer. Never throws.
 *
 * @module agent/parsers/office-parser
 */

import { unzipSync } from 'fflate';

/** Decode the five predefined XML entities back to characters. */
function decodeXmlEntities(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

/** Pull the text of every `<tag ...>...</tag>` run from an XML string, in order. */
function textRuns(xml: string, tag: 'w:t' | 'a:t'): string[] {
  const re = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, 'g');
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    const t = decodeXmlEntities(m[1]).trim();
    if (t.length > 0) {
      out.push(t);
    }
  }
  return out;
}

function bufToStr(bytes: Uint8Array | undefined): string {
  return bytes ? Buffer.from(bytes).toString('utf-8') : '';
}

/** Extract the readable text from a .docx buffer. Returns '' on any failure. */
export function extractDocxText(buf: Buffer): string {
  try {
    const files = unzipSync(new Uint8Array(buf));
    const xml = bufToStr(files['word/document.xml']);
    if (xml.length === 0) {
      return '';
    }
    // Insert paragraph breaks so the summary keeps some structure, then pull runs.
    const withBreaks = xml.replace(/<\/w:p>/g, '</w:p>\n');
    return textRuns(withBreaks, 'w:t').join(' ').replace(/\s+\n/g, '\n').replace(/[ \t]{2,}/g, ' ').trim();
  } catch {
    return '';
  }
}

/** Extract the readable text from a .pptx buffer (all slides, in order). Returns '' on failure. */
export function extractPptxText(buf: Buffer): string {
  try {
    const files = unzipSync(new Uint8Array(buf));
    const slideNames = Object.keys(files)
      .filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n))
      .sort((a, b) => {
        const na = Number(/slide(\d+)\.xml$/.exec(a)?.[1] ?? 0);
        const nb = Number(/slide(\d+)\.xml$/.exec(b)?.[1] ?? 0);
        return na - nb;
      });
    const slides = slideNames
      .map((n) => textRuns(bufToStr(files[n]), 'a:t').join(' ').trim())
      .filter((s) => s.length > 0);
    return slides.join('\n\n').trim();
  } catch {
    return '';
  }
}

/**
 * Extract text from a Word or PowerPoint document by MIME type. Returns '' for
 * anything that isn't a modern .docx/.pptx (incl. legacy binary .doc/.ppt).
 */
export function parseOfficeDocument(buf: Buffer, contentType: string): string {
  const ct = contentType.toLowerCase();
  if (ct.includes('wordprocessingml')) {
    return extractDocxText(buf);
  }
  if (ct.includes('presentationml')) {
    return extractPptxText(buf);
  }
  return '';
}
