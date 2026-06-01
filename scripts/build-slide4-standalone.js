// Builds a standalone single-slide PPTX containing only slide 4 (the RPO Process
// Intelligence Map) of Zeople-RPO-V1-Executive-Dark.pptx, with agent 16 relabeled
// ZBot -> ZeBot per the canonical agent catalog. The original deck is NOT modified.
const fs = require('fs');
const path = require('path');

const SRC = 'C:\\Users\\Admin\\recruiter-call-app\\.deck_extract';
const BUILD = 'C:\\Users\\Admin\\recruiter-call-app\\.deck_build';

// 1. Fresh copy of the extracted package
fs.rmSync(BUILD, { recursive: true, force: true });
fs.cpSync(SRC, BUILD, { recursive: true });

// 2. Delete every slide + slide-rels except slide4
const slidesDir = path.join(BUILD, 'ppt', 'slides');
for (const f of fs.readdirSync(slidesDir)) {
  if (f.endsWith('.xml') && f !== 'slide4.xml') fs.rmSync(path.join(slidesDir, f));
}
const relsDir = path.join(slidesDir, '_rels');
for (const f of fs.readdirSync(relsDir)) {
  if (f !== 'slide4.xml.rels') fs.rmSync(path.join(relsDir, f));
}

// 3. ZBot -> ZeBot in the surviving slide
const slidePath = path.join(slidesDir, 'slide4.xml');
let slide = fs.readFileSync(slidePath, 'utf8');
const before = (slide.match(/ZBot/g) || []).length;
slide = slide.replace(/ZBot/g, 'ZeBot');
fs.writeFileSync(slidePath, slide);

// 4. presentation.xml -> single slide in sldIdLst (slide4 is rId8)
const presPath = path.join(BUILD, 'ppt', 'presentation.xml');
let pres = fs.readFileSync(presPath, 'utf8');
pres = pres.replace(/<p:sldIdLst>[\s\S]*?<\/p:sldIdLst>/,
  '<p:sldIdLst><p:sldId id="259" r:id="rId8"/></p:sldIdLst>');
fs.writeFileSync(presPath, pres);

// 5. presentation.xml.rels -> drop slide relationships other than slide4
const presRelsPath = path.join(BUILD, 'ppt', '_rels', 'presentation.xml.rels');
let presRels = fs.readFileSync(presRelsPath, 'utf8');
presRels = presRels.replace(
  /<Relationship Id="[^"]*" Type="[^"]*\/slide" Target="slides\/(slide\d+\.xml)"\/>/g,
  (m, f) => (f === 'slide4.xml' ? m : ''));
fs.writeFileSync(presRelsPath, presRels);

// 6. [Content_Types].xml -> drop slide overrides other than slide4
const ctPath = path.join(BUILD, '[Content_Types].xml');
let ct = fs.readFileSync(ctPath, 'utf8');
ct = ct.replace(
  /<Override ContentType="[^"]*presentationml\.slide\+xml" PartName="\/ppt\/slides\/(slide\d+\.xml)"\/>/g,
  (m, f) => (f === 'slide4.xml' ? m : ''));
fs.writeFileSync(ctPath, ct);

console.log(`ZBot->ZeBot replacements: ${before}`);
console.log('Build dir ready:', BUILD);
