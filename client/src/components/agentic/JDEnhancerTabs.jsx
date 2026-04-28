import { saveAs } from 'file-saver';
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx';
import { jsPDF } from 'jspdf';

// ── Highlight marker helpers ─────────────────────────────────────────────────
export function stripMarkers(text) {
  return (text || '').replace(/\[\[NOTES_HIGHLIGHT\]\]|\[\[\/NOTES_HIGHLIGHT\]\]/g, '');
}

// ── Inline markdown + highlight renderer ─────────────────────────────────────
// Handles: **bold**, *italic*, [[NOTES_HIGHLIGHT]]...[[/NOTES_HIGHLIGHT]]
function renderInline(str) {
  const pattern = /\[\[NOTES_HIGHLIGHT\]\]([\s\S]*?)\[\[\/NOTES_HIGHLIGHT\]\]|\*\*([^*\n]+)\*\*|\*([^*\n]+)\*/g;
  const result = [];
  let last = 0, m, k = 0;
  while ((m = pattern.exec(str)) !== null) {
    if (m.index > last) result.push(str.slice(last, m.index));
    if (m[1] !== undefined)
      result.push(
        <mark key={k++} style={{ background: '#fef08a', color: '#1a1a1a', padding: '0 2px', borderRadius: '2px' }}>
          {m[1]}
        </mark>
      );
    else if (m[2] !== undefined) result.push(<strong key={k++}>{m[2]}</strong>);
    else if (m[3] !== undefined) result.push(<em key={k++}>{m[3]}</em>);
    last = pattern.lastIndex;
  }
  if (last < str.length) result.push(str.slice(last));
  return result.length === 1 && typeof result[0] === 'string' ? result[0] : result;
}

// Block-level markdown renderer: headings, bullets, paragraphs
function renderMd(text) {
  if (!text) return null;
  const lines = text.split('\n');
  const nodes = [];
  const listBuf = [];
  let k = 0;

  function flushList() {
    if (!listBuf.length) return;
    nodes.push(
      <ul key={k++}>
        {listBuf.splice(0).map((item, i) => <li key={i}>{item}</li>)}
      </ul>
    );
  }

  for (const line of lines) {
    let m;
    if ((m = line.match(/^###\s+(.*)/))) {
      flushList(); nodes.push(<h3 key={k++}>{renderInline(m[1])}</h3>);
    } else if ((m = line.match(/^##\s+(.*)/))) {
      flushList(); nodes.push(<h2 key={k++}>{renderInline(m[1])}</h2>);
    } else if ((m = line.match(/^#\s+(.*)/))) {
      flushList(); nodes.push(<h1 key={k++}>{renderInline(m[1])}</h1>);
    } else if ((m = line.match(/^[-*]\s+(.*)/))) {
      listBuf.push(renderInline(m[1]));
    } else if (line.trim() === '') {
      flushList();
    } else {
      flushList(); nodes.push(<p key={k++}>{renderInline(line)}</p>);
    }
  }
  flushList();
  return nodes;
}

// Try to JSON-parse a value that might be a raw string (possibly with markdown fences)
function tryParse(value) {
  if (typeof value !== 'string') return value;
  try { return JSON.parse(value.trim()); } catch {}
  // Strip markdown code fences the AI sometimes adds despite being told not to
  const stripped = value.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '');
  try { return JSON.parse(stripped.trim()); } catch {}
  // Brace extraction fallback
  const s = value.indexOf('{'), e = value.lastIndexOf('}');
  if (s !== -1 && e !== -1 && e > s) { try { return JSON.parse(value.slice(s, e + 1)); } catch {} }
  return null;
}

// ── Tab: Formatted JD ────────────────────────────────────────────────────────
export function FormattedJDTab({ content, editing, editDraft, onEditChange }) {
  if (editing) {
    return (
      <textarea
        className="jde-edit-textarea"
        value={editDraft}
        onChange={e => onEditChange(e.target.value)}
      />
    );
  }
  return <div className="jde-md-wrap">{renderMd(content || '')}</div>;
}

// ── Tab: Recruiter Brief ─────────────────────────────────────────────────────
export function RecruiterBriefTab({ content, editing, editDraft, onEditChange }) {
  if (editing) {
    return (
      <textarea
        className="jde-edit-textarea"
        value={editDraft}
        onChange={e => onEditChange(e.target.value)}
      />
    );
  }
  return <div className="jde-md-wrap">{renderMd(content || '')}</div>;
}

// ── Tab: Clarification Questions ─────────────────────────────────────────────
const CATEGORY_LABELS = {
  domainAndIndustry:       'Domain & Industry',
  primarySkills:           'Primary Skills',
  secondarySkills:         'Secondary Skills',
  projectsAndExperience:   'Projects & Experience',
  processAndTimeline:      'Process & Timeline',
  compensationAndBenefits: 'Compensation & Benefits',
  otherClarifications:     'Other Clarifications',
};

export function ClarificationsTab({ content }) {
  const data = tryParse(content);

  if (!data || typeof data !== 'object') {
    return (
      <div className="jde-tab-empty">
        {content ? <div className="jde-md-wrap">{renderMd(String(content))}</div> : 'No clarification questions generated.'}
      </div>
    );
  }

  return (
    <div className="jde-clarifications">
      {Object.entries(CATEGORY_LABELS).map(([key, label]) => {
        const questions = data[key];
        if (!questions?.length) return null;
        return (
          <div key={key} className="jde-clar-category">
            <h4 className="jde-clar-category-title">{label}</h4>
            <div className="jde-clar-questions">
              {questions.map((q, i) => (
                <div key={i} className="jde-clar-card">
                  <div className="jde-clar-q">{q.question}</div>
                  {q.rationale && <div className="jde-clar-rationale">{q.rationale}</div>}
                  <input
                    className="jde-clar-response"
                    placeholder="Client response…"
                    defaultValue={q.response || ''}
                  />
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Tab: Reachout Material ───────────────────────────────────────────────────
export function ReachoutTab({ content, editing, editDraft, onEditChange }) {
  const data = tryParse(content);

  if (!data || typeof data !== 'object') {
    if (editing) return <textarea className="jde-edit-textarea" value={editDraft} onChange={e => onEditChange(e.target.value)} />;
    return <div className="jde-md-wrap">{renderMd(String(content || ''))}</div>;
  }

  const { companyScript, whatsapp, linkedin, pitch, questions } = data;

  if (editing) {
    const editableText = [
      whatsapp  ? `WhatsApp:\n${whatsapp}`  : '',
      linkedin  ? `LinkedIn:\n${linkedin}`  : '',
      pitch     ? `Call Pitch:\n${pitch}`   : '',
    ].filter(Boolean).join('\n\n---\n\n');
    return <textarea className="jde-edit-textarea" value={editDraft || editableText} onChange={e => onEditChange(e.target.value)} />;
  }

  return (
    <div className="jde-reachout">
      {companyScript && (
        <div className="jde-reachout-section">
          <div className="jde-reachout-label">Company Script</div>
          <div className="jde-reachout-box jde-reachout-box--script">{companyScript}</div>
        </div>
      )}
      {whatsapp && (
        <div className="jde-reachout-section">
          <div className="jde-reachout-label">WhatsApp Message</div>
          <div className="jde-reachout-box">{whatsapp}</div>
        </div>
      )}
      {linkedin && (
        <div className="jde-reachout-section">
          <div className="jde-reachout-label">LinkedIn Message</div>
          <div className="jde-reachout-box">{linkedin}</div>
        </div>
      )}
      {pitch && (
        <div className="jde-reachout-section">
          <div className="jde-reachout-label">Call Pitch Script</div>
          <div className="jde-reachout-box jde-reachout-box--pitch">{pitch}</div>
        </div>
      )}
      {questions?.phoneScreening?.length > 0 && (
        <div className="jde-reachout-section">
          <div className="jde-reachout-label">Phone Screening Questions</div>
          <div className="jde-screening-list">
            {questions.phoneScreening.map((q, i) => (
              <div key={i} className="jde-screening-card">
                <div className="jde-screening-q">Q{i + 1}: {q.question}</div>
                {q.idealAnswer && <div className="jde-screening-answer"><strong>Ideal:</strong> {q.idealAnswer}</div>}
                {q.explanation && <div className="jde-screening-explain">{q.explanation}</div>}
                {q.validationCues?.length > 0 && (
                  <div className="jde-screening-cues">
                    {q.validationCues.map((c, ci) => <span key={ci} className="jde-cue-badge">{c}</span>)}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      {questions?.sourcingFocus?.length > 0 && (
        <div className="jde-reachout-section">
          <div className="jde-reachout-label">Sourcing Focus</div>
          <ul className="jde-sourcing-focus">
            {questions.sourcingFocus.map((s, i) => <li key={i}>{s}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}

// ── Tab: Sourcing Keywords ───────────────────────────────────────────────────
export function KeywordsTab({ content }) {
  const data = tryParse(content);

  if (!data || typeof data !== 'object') {
    return (
      <div className="jde-tab-empty">
        {content ? <div className="jde-md-wrap">{renderMd(String(content))}</div> : 'No keywords generated.'}
      </div>
    );
  }

  const { primaryKeywords, secondaryKeywords, booleanStrings, skillOnlyBooleanStrings, exclusions } = data;
  const copyText = (text) => navigator.clipboard.writeText(text).catch(() => {});

  return (
    <div className="jde-keywords">
      {primaryKeywords?.length > 0 && (
        <div className="jde-kw-section">
          <div className="jde-kw-label">Primary Keywords</div>
          <div className="jde-kw-chips">
            {primaryKeywords.map(k => <span key={k} className="skill-chip jde-kw-primary">{k}</span>)}
          </div>
        </div>
      )}
      {secondaryKeywords?.length > 0 && (
        <div className="jde-kw-section">
          <div className="jde-kw-label">Secondary Keywords</div>
          <div className="jde-kw-chips">
            {secondaryKeywords.map(k => <span key={k} className="skill-chip jde-kw-secondary">{k}</span>)}
          </div>
        </div>
      )}
      {booleanStrings?.length > 0 && (
        <div className="jde-kw-section">
          <div className="jde-kw-label">Boolean Search Strings</div>
          {booleanStrings.map((s, i) => (
            <div key={i} className="jde-bool-row">
              <code className="jde-bool-code">{s}</code>
              <button className="jde-bool-copy" onClick={() => copyText(s)}>Copy</button>
            </div>
          ))}
        </div>
      )}
      {skillOnlyBooleanStrings?.length > 0 && (
        <div className="jde-kw-section">
          <div className="jde-kw-label">Skills-Only Boolean Strings</div>
          {skillOnlyBooleanStrings.map((s, i) => (
            <div key={i} className="jde-bool-row">
              <code className="jde-bool-code">{s}</code>
              <button className="jde-bool-copy" onClick={() => copyText(s)}>Copy</button>
            </div>
          ))}
        </div>
      )}
      {exclusions?.length > 0 && (
        <div className="jde-kw-section">
          <div className="jde-kw-label">Exclusions</div>
          <div className="jde-kw-chips">
            {exclusions.map(k => <span key={k} className="skill-chip jde-kw-exclusion">{k}</span>)}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Download helpers ─────────────────────────────────────────────────────────

function mdToParagraphs(text) {
  return (text || '').split('\n').map(line => {
    const h1 = line.match(/^#\s+(.+)/);
    const h2 = line.match(/^##\s+(.+)/);
    const h3 = line.match(/^###\s+(.+)/);
    const bullet = line.match(/^[-*]\s+(.+)/);
    if (h3) return new Paragraph({ text: h3[1], heading: HeadingLevel.HEADING_3 });
    if (h2) return new Paragraph({ text: h2[1], heading: HeadingLevel.HEADING_2 });
    if (h1) return new Paragraph({ text: h1[1], heading: HeadingLevel.HEADING_1 });
    if (bullet) return new Paragraph({ text: `• ${bullet[1]}` });

    const runs = [];
    let rest = stripMarkers(line);
    const parts = rest.split(/(\*\*[^*]+\*\*)/g);
    parts.forEach(p => {
      const b = p.match(/^\*\*(.+)\*\*$/);
      runs.push(new TextRun({ text: b ? b[1] : p, bold: !!b }));
    });
    return new Paragraph({ children: runs.length ? runs : [new TextRun(rest)] });
  });
}

function clarsToParagraphs(content) {
  const data = tryParse(content) || content;
  const paras = [];
  Object.entries(CATEGORY_LABELS).forEach(([key, label]) => {
    const qs = data?.[key];
    if (!qs?.length) return;
    paras.push(new Paragraph({ text: label, heading: HeadingLevel.HEADING_2 }));
    qs.forEach((q, i) => {
      paras.push(new Paragraph({ text: `${i + 1}. ${q.question}` }));
      if (q.rationale) paras.push(new Paragraph({ children: [new TextRun({ text: `Why: ${q.rationale}`, italics: true, color: '666666' })] }));
      paras.push(new Paragraph({ text: '' }));
    });
  });
  return paras;
}

function reachoutToParagraphs(content) {
  const data = tryParse(content);
  if (!data || typeof data !== 'object') return mdToParagraphs(String(content || ''));
  const paras = [];
  const section = (title, text) => {
    if (!text) return;
    paras.push(new Paragraph({ text: title, heading: HeadingLevel.HEADING_2 }));
    paras.push(...text.split('\n').map(l => new Paragraph({ text: l })));
    paras.push(new Paragraph({ text: '' }));
  };
  section('Company Script', data.companyScript);
  section('WhatsApp Message', data.whatsapp);
  section('LinkedIn Message', data.linkedin);
  section('Call Pitch', data.pitch);
  if (data.questions?.phoneScreening?.length) {
    paras.push(new Paragraph({ text: 'Phone Screening Questions', heading: HeadingLevel.HEADING_2 }));
    data.questions.phoneScreening.forEach((q, i) => {
      paras.push(new Paragraph({ text: `Q${i + 1}: ${q.question}` }));
      if (q.idealAnswer) paras.push(new Paragraph({ children: [new TextRun({ text: `Ideal: ${q.idealAnswer}`, italics: true })] }));
    });
  }
  return paras;
}

function keywordsToParagraphs(content) {
  const data = tryParse(content);
  if (!data || typeof data !== 'object') return mdToParagraphs(String(content || ''));
  const paras = [];
  const section = (title, items) => {
    if (!items?.length) return;
    paras.push(new Paragraph({ text: title, heading: HeadingLevel.HEADING_2 }));
    items.forEach(item => paras.push(new Paragraph({ text: item })));
    paras.push(new Paragraph({ text: '' }));
  };
  section('Primary Keywords', data.primaryKeywords);
  section('Secondary Keywords', data.secondaryKeywords);
  section('Boolean Strings', data.booleanStrings);
  section('Skills-Only Boolean Strings', data.skillOnlyBooleanStrings);
  section('Exclusions', data.exclusions);
  return paras;
}

async function downloadWord(filename, paragraphs) {
  const doc = new Document({ sections: [{ children: paragraphs }] });
  const blob = await Packer.toBlob(doc);
  saveAs(blob, filename);
}

function downloadPDF(filename, sections) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const M = 15, W = 210 - M * 2;
  let y = M + 5;

  const newPage = () => { doc.addPage(); y = M + 5; };
  const checkY = (needed = 8) => { if (y + needed > 280) newPage(); };

  sections.forEach(({ title, lines }) => {
    checkY(10);
    doc.setFontSize(14); doc.setFont('helvetica', 'bold');
    doc.text(title, M, y); y += 8;
    doc.setFontSize(10); doc.setFont('helvetica', 'normal');
    lines.forEach(line => {
      if (!line.trim()) { y += 3; return; }
      const wrapped = doc.splitTextToSize(line, W);
      checkY(wrapped.length * 5 + 2);
      doc.text(wrapped, M, y); y += wrapped.length * 5 + 1;
    });
    y += 6;
  });

  doc.save(filename);
}

// ── DownloadDialog ────────────────────────────────────────────────────────────
export function DownloadDialog({ activeTab, results, saveTitle, onClose }) {
  const TAB_NAMES = { jd: 'Formatted JD', brief: 'Recruiter Brief', questions: 'Clarifications', reachout: 'Reachout Material', keywords: 'Sourcing Keywords' };
  const name = saveTitle || 'JD Enhancement';

  const buildAllWordParagraphs = () => {
    const paras = [];
    const addSection = (title, pFn) => {
      paras.push(new Paragraph({ text: title, heading: HeadingLevel.HEADING_1 }));
      paras.push(...pFn());
      paras.push(new Paragraph({ text: '' }));
    };
    if (results.formattedJD)            addSection('Formatted JD',           () => mdToParagraphs(stripMarkers(results.formattedJD)));
    if (results.recruiterBrief)         addSection('Recruiter Brief',         () => mdToParagraphs(stripMarkers(results.recruiterBrief)));
    if (results.clarificationQuestions) addSection('Clarification Questions', () => clarsToParagraphs(results.clarificationQuestions));
    if (results.reachoutMaterial)       addSection('Reachout Material',       () => reachoutToParagraphs(results.reachoutMaterial));
    if (results.sourcingKeywords)       addSection('Sourcing Keywords',       () => keywordsToParagraphs(results.sourcingKeywords));
    return paras;
  };

  const buildTabParagraphs = () => {
    const content = { jd: results.formattedJD, brief: results.recruiterBrief, questions: results.clarificationQuestions, reachout: results.reachoutMaterial, keywords: results.sourcingKeywords }[activeTab];
    const fn = {
      jd:        () => mdToParagraphs(stripMarkers(content)),
      brief:     () => mdToParagraphs(stripMarkers(content)),
      questions: () => clarsToParagraphs(content),
      reachout:  () => reachoutToParagraphs(content),
      keywords:  () => keywordsToParagraphs(content),
    }[activeTab];
    return fn ? fn() : [];
  };

  const buildPDFSections = (all = false) => {
    const sections = [];
    const addSec = (title, content) => {
      if (!content) return;
      const text = typeof content === 'string' ? stripMarkers(content) : JSON.stringify(content, null, 2);
      sections.push({ title, lines: text.split('\n') });
    };
    if (all) {
      addSec('Formatted JD', results.formattedJD);
      addSec('Recruiter Brief', results.recruiterBrief);
      if (results.clarificationQuestions) {
        const data = tryParse(results.clarificationQuestions) || results.clarificationQuestions;
        const lines = [];
        if (typeof data === 'object') {
          Object.entries(CATEGORY_LABELS).forEach(([k, lbl]) => {
            lines.push(`--- ${lbl} ---`);
            data[k]?.forEach((q, i) => lines.push(`${i + 1}. ${q.question}`, q.rationale ? `   Why: ${q.rationale}` : '', ''));
          });
        } else {
          lines.push(String(data));
        }
        sections.push({ title: 'Clarification Questions', lines });
      }
      addSec('Reachout Material', results.reachoutMaterial);
      addSec('Sourcing Keywords', results.sourcingKeywords);
    } else {
      const content = { jd: results.formattedJD, brief: results.recruiterBrief, questions: results.clarificationQuestions, reachout: results.reachoutMaterial, keywords: results.sourcingKeywords }[activeTab];
      addSec(TAB_NAMES[activeTab], content);
    }
    return sections;
  };

  const handleDownload = async (scope, format) => {
    const filename = scope === 'all' ? name : `${name} — ${TAB_NAMES[activeTab]}`;
    if (format === 'word') {
      const paras = scope === 'all' ? buildAllWordParagraphs() : buildTabParagraphs();
      await downloadWord(`${filename}.docx`, paras);
    } else {
      downloadPDF(`${filename}.pdf`, buildPDFSections(scope === 'all'));
    }
    onClose();
  };

  return (
    <div className="ag-modal-overlay" onClick={onClose}>
      <div className="ag-modal jde-download-modal" onClick={e => e.stopPropagation()}>
        <h3 className="ag-modal-title">Download</h3>
        <div className="jde-download-grid">
          <div className="jde-download-section">
            <div className="jde-download-scope">Current Tab — {TAB_NAMES[activeTab]}</div>
            <div className="jde-download-btns">
              <button className="ag-btn ag-btn--ghost" onClick={() => handleDownload('tab', 'word')}>Word (.docx)</button>
              <button className="ag-btn ag-btn--ghost" onClick={() => handleDownload('tab', 'pdf')}>PDF (.pdf)</button>
            </div>
          </div>
          <div className="jde-download-section">
            <div className="jde-download-scope">All 5 Assets</div>
            <div className="jde-download-btns">
              <button className="ag-btn ag-btn--primary" onClick={() => handleDownload('all', 'word')}>Word (.docx)</button>
              <button className="ag-btn ag-btn--primary" onClick={() => handleDownload('all', 'pdf')}>PDF (.pdf)</button>
            </div>
          </div>
        </div>
        <div className="ag-modal-actions" style={{ marginTop: 8 }}>
          <button className="ag-btn ag-btn--ghost" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
