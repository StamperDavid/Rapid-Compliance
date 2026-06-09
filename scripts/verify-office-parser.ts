/**
 * Verify the fflate-based Office (OOXML) text extractor for .docx + .pptx.
 * Builds synthetic-but-real-shaped OOXML zips (real tag names, attributes, XML
 * entities, multiple runs, multiple slides) and asserts the text comes back.
 * Run: npx tsx scripts/verify-office-parser.ts
 */

/* eslint-disable no-console */

import { zipSync, strToU8 } from 'fflate';
import {
  extractDocxText,
  extractPptxText,
  parseOfficeDocument,
} from '../src/lib/agent/parsers/office-parser';

let fail = 0;
const ok = (name: string, cond: boolean): void => {
  console.log(`${cond ? '✅' : '❌'} ${name}`);
  if (!cond) { fail += 1; }
};

// .docx: two paragraphs, multiple runs, an entity, and a space-preserve attr.
const docxXml =
  '<?xml version="1.0"?><w:document><w:body>' +
  '<w:p><w:r><w:t>Our brand voice is</w:t></w:r>' +
  '<w:r><w:t xml:space="preserve"> bold &amp; confident.</w:t></w:r></w:p>' +
  '<w:p><w:r><w:t>Accelerate your growth.</w:t></w:r></w:p>' +
  '</w:body></w:document>';
const docxBuf = Buffer.from(zipSync({ 'word/document.xml': strToU8(docxXml) }));

// .pptx: two slides, out of file order to prove slideN sorting.
const slide2 = '<?xml version="1.0"?><p:sld><a:t>Slide Two message</a:t></p:sld>';
const slide1 = '<?xml version="1.0"?><p:sld><a:t>Deck Title</a:t><a:t>Opening point</a:t></p:sld>';
const pptxBuf = Buffer.from(
  zipSync({ 'ppt/slides/slide2.xml': strToU8(slide2), 'ppt/slides/slide1.xml': strToU8(slide1) }),
);

console.log('1) .docx');
const docxText = extractDocxText(docxBuf);
console.log('   →', JSON.stringify(docxText));
ok('reads both paragraphs', docxText.includes('Our brand voice is') && docxText.includes('Accelerate your growth.'));
ok('decodes &amp; → &', docxText.includes('bold & confident'));

console.log('\n2) .pptx');
const pptxText = extractPptxText(pptxBuf);
console.log('   →', JSON.stringify(pptxText));
ok('reads all slides', pptxText.includes('Deck Title') && pptxText.includes('Slide Two message'));
ok('slides in numeric order (slide1 before slide2)', pptxText.indexOf('Deck Title') < pptxText.indexOf('Slide Two message'));

console.log('\n3) dispatch by contentType');
ok('docx mime → docx text', parseOfficeDocument(docxBuf, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') === docxText);
ok('pptx mime → pptx text', parseOfficeDocument(pptxBuf, 'application/vnd.openxmlformats-officedocument.presentationml.presentation') === pptxText);
ok('unknown mime → empty', parseOfficeDocument(docxBuf, 'application/octet-stream') === '');

console.log('\n========================================');
console.log(fail === 0 ? '  OFFICE PARSER OK' : `  ${fail} CHECK(S) FAILED`);
process.exit(fail === 0 ? 0 : 1);
