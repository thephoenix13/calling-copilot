/**
 * server/utils/mi-prompts.js
 *
 * Single source of truth for all Market Intelligence pipeline prompts and
 * schemas. Verbatim from Zeople-MI-Algorithm-Spec §14.3 – §14.9.
 *
 * IMPORTANT: The strings exported here are sent under cache_control:
 *   {type: 'ephemeral'} on the system block of every report. Anything that
 *   varies between requests (timestamps, UUIDs, JSON.stringify of unsorted
 *   objects) MUST stay OUT of these prompts to keep the cache warm.
 */

'use strict';

// ── Enum allowlists (Stage 0 — JD parser) ────────────────────────────────
// Verbatim from spec §14.8.

const ALLOWED_VALUES = {
  industries: [
    'Information Technology', 'Financial Services', 'Healthcare & Pharma',
    'E-commerce & Retail', 'Manufacturing', 'Consulting', 'Telecommunications',
    'BFSI', 'Education & EdTech', 'Media & Entertainment', 'Automotive',
    'Real Estate', 'Energy & Utilities', 'Other',
  ],
  employmentTypes: ['Full-time', 'Contract', 'Part-time', 'Freelance', 'Internship'],
  experienceLevels: [
    'Fresher (0-1 years)', 'Junior (1-3 years)', 'Mid-level (3-5 years)',
    'Senior (5-8 years)', 'Lead (8-12 years)', 'Principal/Architect (12+ years)',
    'Director/VP Level',
  ],
  noticePeriods: ['Immediate', '15 days', '30 days', '45 days', '60 days', '90 days'],
  locations: [
    'Bengaluru', 'Mumbai', 'Delhi NCR', 'Hyderabad', 'Pune', 'Chennai',
    'Kolkata', 'Ahmedabad', 'Jaipur', 'Chandigarh', 'Kochi', 'Indore',
    'Coimbatore', 'Remote (India)', 'Pan India',
  ],
};

// ── Stage 0 — JD parser ──────────────────────────────────────────────────

const PARSE_JD_SYSTEM_PROMPT = `You are a job description parser. Extract structured fields from the provided job description text.
You MUST only use values from the allowed lists provided in the tool schema. If a field cannot be determined or doesn't match any allowed value, return null for that field.
For mustHaveSkills, extract the key technical skills mentioned as requirements.
For experienceLevel, if the JD mentions a custom range like "4-6 years", pick the closest matching option from the allowed list.`;

const PARSE_JD_TOOL = {
  name: 'extract_job_fields',
  description: 'Extract structured job description fields from raw JD text.',
  strict: true,
  input_schema: {
    type: 'object',
    additionalProperties: false,
    required: ['title', 'mustHaveSkills'],
    properties: {
      title: { type: 'string' },
      location:        { type: 'string', enum: ALLOWED_VALUES.locations },
      industry:        { type: 'string', enum: ALLOWED_VALUES.industries },
      employmentType:  { type: 'string', enum: ALLOWED_VALUES.employmentTypes },
      experienceLevel: { type: 'string', enum: ALLOWED_VALUES.experienceLevels },
      noticePeriod:    { type: 'string', enum: ALLOWED_VALUES.noticePeriods },
      mustHaveSkills:  { type: 'array', items: { type: 'string' } },
      clientName:      { type: 'string' },
    },
  },
};

// ── Stage 2 — Research agent (verbatim from spec §14.3 + §14.4) ──────────

const RESEARCH_SYSTEM_PROMPT = `You are an expert recruitment market research analyst specializing in the Indian hiring market.
Your responses MUST include SPECIFIC NUMBERS and DATA - never vague statements.

CRITICAL DATA REQUIREMENTS - You MUST provide:
1. TALENT POOL: Specific numbers (e.g., "45,000 professionals with this skill set in Bangalore")
2. SALARY DATA: Exact figures in LPA format (e.g., "Min: 8 LPA, Median: 15 LPA, 75th percentile: 22 LPA, Max: 35 LPA")
3. COMPANIES: Name 8-12 specific companies actively hiring with approximate open positions
4. NOTICE PERIODS: Typical ranges (e.g., "60-90 days for senior roles, 30 days for mid-level")
5. TIME TO HIRE: Realistic timelines (4-8 weeks typical)
6. GROWTH RATES: Percentage figures for demand growth

MANDATORY SOURCE DIVERSITY - Use data from ALL these categories:
PRIMARY JOB PORTALS (cite specific data from each):
- Naukri.com (largest Indian job portal - cite job posting counts, trends)
- LinkedIn India (professional network - cite talent pool sizes)
- Glassdoor India (salary data and company reviews)
- Shine.com (job trends)
- TimesJobs (market insights)

SALARY DATABASES (cite specific salary ranges):
- AmbitionBox (Indian salary benchmarks)
- PayScale India (compensation data)
- Glassdoor Salaries (company-specific data)
- Levels.fyi (for tech roles)

INDUSTRY REPORTS (cite for trends and forecasts):
- TeamLease Employment Reports
- Michael Page India Salary Guide
- Mercer India Compensation Survey
- Aon Hewitt Salary Increase Survey
- NASSCOM reports (for IT/Tech)
- Deloitte India HR Trends
- KPMG India Workforce Reports

CRITICAL: Do NOT over-rely on Indeed.com. It has limited India coverage. Prioritize Naukri and LinkedIn.

Structure your response with these EXACT sections:
1. DEMAND ANALYSIS - Include job posting counts, YoY growth %, hot locations with numbers
2. TALENT AVAILABILITY - Total pool size, active vs passive split, city-wise breakdown with numbers
3. SALARY BENCHMARKS - Min, 25th percentile, Median, 75th percentile, Max (all in LPA)
4. COMPETITOR COMPANIES - List 8-12 companies with approximate open positions
5. JOINING TIMELINES - Notice periods, time-to-hire estimates, buyout trends
6. TALENT REPUTATION - Glassdoor ratings (out of 5) for top 3-5 companies hiring this role, include employee recommendation percentages
7. POSITIONING RECOMMENDATIONS - Strategic advice based on market data
8. OVERALL ROLE AVAILABILITY - Combined talent availability for candidates with ALL required skills together`;

function buildResearchUserPrompt(jc) {
  const detailedSection = jc.detailedJobDescription
    ? `- Detailed Job Description:\n${jc.detailedJobDescription}\n`
    : '';
  return `Conduct comprehensive Indian recruitment market research for this position:

JOB DETAILS:
- Job Title: ${jc.title}
- Location: ${jc.location}
- Industry: ${jc.industry}
- Experience Level: ${jc.experienceLevel}
- Employment Type: ${jc.employmentType}
- Required Skills (ALL must be present): ${(jc.mustHaveSkills || []).join(', ')}
- Preferred Notice Period: ${jc.noticePeriod || 'Standard (60-90 days)'}
${detailedSection}
RESEARCH REQUIREMENTS - Provide SPECIFIC DATA for each:

1. DEMAND ANALYSIS:
   - Current number of open positions on Naukri.com and LinkedIn
   - Year-over-year growth percentage in job postings
   - Top 5 cities by demand with job counts

2. TALENT AVAILABILITY:
   - Total estimated talent pool with this skill combination
   - Percentage actively looking vs passive candidates
   - Breakdown by Tier 1, Tier 2, Tier 3 cities

3. SALARY BENCHMARKS (in LPA - Lakhs Per Annum):
   - Minimum CTC
   - 25th Percentile
   - Median CTC
   - 75th Percentile
   - Maximum CTC
   Cite sources: AmbitionBox, Glassdoor, PayScale

4. COMPETITOR COMPANIES:
   - List 8-12 companies actively hiring for this role
   - Include approximate number of open positions per company
   - Note any major hiring drives or freezes

5. JOINING TIMELINES:
   - Typical notice period range (30/60/90 days)
   - Expected time-to-hire (aim for 4-8 weeks maximum)
   - Buyout/early release trends
   - Consider that the client prefers candidates with notice period: ${jc.noticePeriod || 'Flexible'}

6. TALENT REPUTATION (CRITICAL - from Glassdoor India):
   - Get Glassdoor ratings (out of 5.0) for the top 3-5 companies actively hiring for this role
   - Include employee recommendation percentages (e.g., "80% would recommend to a friend")
   - Focus on companies mentioned in the competitor analysis section
   - Source: Glassdoor India ratings and reviews

7. POSITIONING RECOMMENDATIONS:
   - How to attract top talent
   - Competitive advantages to highlight
   - Urgency factors

8. OVERALL ROLE AVAILABILITY (CRITICAL):
   - Estimate how many candidates have ALL the required skills combined: ${(jc.mustHaveSkills || []).join(' + ')}
   - This is typically MUCH smaller than individual skill pools
   - Classify the combined skill set: Vanilla (10,000+), Niche (1,000-10,000), or Super Niche (<1,000)
   - Estimate immediate availability (candidates in notice period or looking)
   - Estimate 30-day and 60-day availability

CITATION REQUIREMENT: Cite at least 5-7 different sources from Naukri, LinkedIn, Glassdoor, AmbitionBox, industry reports. Do NOT rely heavily on Indeed.`;
}

// ── Stage 3 — Structurer (verbatim from spec §14.5 – §14.7) ──────────────

const STRUCTURE_SYSTEM_PROMPT = `You are a data extraction agent. Extract structured data from research documents.
CRITICAL: Return ONLY valid JSON with no markdown formatting, no explanations, no extra text.
Keep all string values concise (under 200 characters each) to avoid truncation.

IMPORTANT: Extract ACTUAL DATA from the research. If specific numbers are mentioned, use them.
Only use "Not available" if the research truly has no relevant data for that field.
Prefer approximate estimates over "Not available" when the research provides context.`;

// Verbatim from spec §14.6.
const STRUCTURED_DATA_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'demandAnalysis', 'talentAvailability', 'salaryBenchmarks', 'competitorAnalysis',
    'joiningTimelines', 'keyTrends', 'talentReputation', 'positioningRecommendations',
    'skillAvailability',
  ],
  properties: {
    demandAnalysis: {
      type: 'object', additionalProperties: false,
      required: ['jobPostingTrends', 'growthRate', 'hotLocations', 'confidence'],
      properties: {
        jobPostingTrends: { type: 'string', description: 'Specific trend description with numbers when available' },
        growthRate:       { type: 'string', description: "Year-over-year percentage, e.g. '15% YoY'" },
        hotLocations:     { type: 'array', items: { type: 'string' }, minItems: 1 },
        confidence:       { type: 'string', enum: ['high', 'medium', 'low'] },
      },
    },
    talentAvailability: {
      type: 'object', additionalProperties: false,
      required: ['totalPool', 'activeJobSeekers', 'passiveCandidates', 'tierCityBreakdown', 'confidence'],
      properties: {
        totalPool:         { type: 'string', description: "Number estimate, e.g. '25,000 professionals'" },
        activeJobSeekers:  { type: 'string', description: "Percentage, e.g. '18%'" },
        passiveCandidates: { type: 'string', description: "Percentage, e.g. '82%'" },
        // Anthropic json_schema requires fixed property shapes; use the three
        // canonical tier labels as keys.
        tierCityBreakdown: {
          type: 'object', additionalProperties: false,
          required: ['Tier 1', 'Tier 2', 'Tier 3'],
          properties: {
            'Tier 1': { type: 'string', description: "% of pool in Tier 1 cities (Bengaluru, Mumbai, Delhi NCR, Hyderabad, Pune, Chennai)" },
            'Tier 2': { type: 'string', description: "% of pool in Tier 2 cities" },
            'Tier 3': { type: 'string', description: "% of pool in Tier 3 cities" },
          },
        },
        confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
      },
    },
    salaryBenchmarks: {
      type: 'object', additionalProperties: false,
      required: ['minCTC', 'percentile25', 'medianCTC', 'percentile75', 'maxCTC', 'confidence'],
      properties: {
        minCTC:       { type: 'string', description: "Minimum CTC in LPA, e.g. '8 LPA'" },
        percentile25: { type: 'string' },
        medianCTC:    { type: 'string' },
        percentile75: { type: 'string' },
        maxCTC:       { type: 'string' },
        confidence:   { type: 'string', enum: ['high', 'medium', 'low'] },
      },
    },
    competitorAnalysis: {
      type: 'object', additionalProperties: false,
      required: ['topHiringCompanies', 'confidence'],
      properties: {
        topHiringCompanies: {
          type: 'array', minItems: 1,
          items: {
            type: 'object', additionalProperties: false,
            required: ['name', 'openPositions'],
            properties: {
              name:          { type: 'string' },
              openPositions: { type: 'string', description: "Number or estimate, e.g. '45 positions'" },
            },
          },
        },
        confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
      },
    },
    joiningTimelines: {
      type: 'object', additionalProperties: false,
      required: ['averageNoticePeriod', 'typicalTimeToHire', 'buyoutTrends', 'preferredNoticePeriodFit', 'confidence'],
      properties: {
        averageNoticePeriod:       { type: 'string', description: "e.g. '60-90 days'" },
        typicalTimeToHire:         { type: 'string', description: 'MAXIMUM 8 weeks — enforced post-parse' },
        buyoutTrends:              { type: 'string' },
        preferredNoticePeriodFit:  { type: 'string', description: "How well the talent pool matches the client's preferred notice period" },
        confidence:                { type: 'string', enum: ['high', 'medium', 'low'] },
      },
    },
    keyTrends: {
      type: 'object', additionalProperties: false,
      required: ['trends', 'confidence'],
      properties: {
        trends:     { type: 'array', items: { type: 'string' }, minItems: 1 },
        confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
      },
    },
    talentReputation: {
      type: 'object', additionalProperties: false,
      required: ['companies', 'ratingSource', 'confidence'],
      properties: {
        companies: {
          type: 'array',
          items: {
            type: 'object', additionalProperties: false,
            required: ['name', 'rating'],
            properties: {
              name:               { type: 'string' },
              rating:             { type: 'number', description: '0–5 Glassdoor rating' },
              recommendationRate: { type: 'string', description: "e.g. '80% recommend'" },
            },
          },
        },
        ratingSource: { type: 'string', description: "e.g. 'Glassdoor Rating - India'" },
        confidence:   { type: 'string', enum: ['high', 'medium', 'low'] },
      },
    },
    positioningRecommendations: {
      type: 'object', additionalProperties: false,
      required: ['recommendations', 'confidence'],
      properties: {
        recommendations: { type: 'array', items: { type: 'string' }, minItems: 1 },
        confidence:      { type: 'string', enum: ['high', 'medium', 'low'] },
      },
    },
    skillAvailability: {
      type: 'object', additionalProperties: false,
      required: ['skills', 'confidence'],
      properties: {
        skills: {
          type: 'array', minItems: 1,
          // Anthropic json_schema does not support maxItems; the "exactly one
          // row" constraint is enforced post-parse by applyBusinessRules().
          description: 'EXACTLY ONE row representing the combined-skill pool — not per-skill rows',
          items: {
            type: 'object', additionalProperties: false,
            required: ['skill', 'skillType', 'experienceRange', 'location', 'availableProfiles', 'immediate', 'thirtyDays', 'sixtyDays', 'notes'],
            properties: {
              skill:             { type: 'string', description: "e.g. 'Overall: Senior NetSuite Consultant'" },
              skillType:         { type: 'string', enum: ['Vanilla', 'Niche', 'Super Niche'] },
              experienceRange:   { type: 'string' },
              location:          { type: 'string' },
              availableProfiles: { type: 'string', description: 'Total candidates with ALL required skills combined' },
              immediate:         { type: 'string', description: 'Candidates in notice period or actively looking' },
              thirtyDays:        { type: 'string' },
              sixtyDays:         { type: 'string' },
              notes:             { type: 'string', description: 'Why this classification was chosen' },
            },
          },
        },
        confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
      },
    },
  },
};

function buildStructureUserPrompt(jc, researchContent) {
  const detailedSection = jc.detailedJobDescription
    ? `Detailed Job Description:\n${jc.detailedJobDescription.substring(0, 1000)}\n`
    : '';
  return `Extract structured data from this research about "${jc.title}" in ${jc.location}.
Required Skills: ${(jc.mustHaveSkills || []).join(', ') || 'Not specified'}
Experience Level: ${jc.experienceLevel || 'Not specified'}
Preferred Notice Period: ${jc.noticePeriod || 'Flexible'}
${detailedSection}Research content:
${(researchContent || '').substring(0, 6000)}

CRITICAL INSTRUCTIONS for skillAvailability:
- Create ONLY ONE ROW for the overall role, NOT separate rows per skill
- The "skill" field should be "Overall: ${jc.title}"
- Classify based on candidates who have ALL these skills TOGETHER: ${(jc.mustHaveSkills || []).join(' + ')}
- This combined pool is typically MUCH SMALLER than individual skill pools
- Classification guide:
  * Vanilla (10,000+): Common skill combinations, easy to find
  * Niche (1,000-10,000): Specialized but available, moderate search effort
  * Super Niche (<1,000): Rare combination, difficult to find, premium compensation needed
- The notes should explain why the classification was chosen

CRITICAL: typicalTimeToHire MUST be 8 weeks maximum. Cap any longer estimate at 8 weeks.`;
}

// ── Stage 4 — Executive summary (verbatim from spec §14.9) ───────────────

const EXEC_SUMMARY_SYSTEM_PROMPT = 'You are an executive report writer. Write concise, professional summaries for business executives.';

function buildExecSummaryUserPrompt(jc, sd) {
  const detailedSection = jc.detailedJobDescription
    ? `\nRole Overview: ${jc.detailedJobDescription.substring(0, 300)}...`
    : '';
  const trends = (sd.keyTrends?.trends || []).slice(0, 2).join(', ');
  return `Write a 3-4 sentence executive summary for this recruitment market intelligence report:

Job: ${jc.title}
Location: ${jc.location}
Industry: ${jc.industry}
Experience: ${jc.experienceLevel}
Preferred Notice Period: ${jc.noticePeriod || 'Flexible'}
${detailedSection}

Key findings:
- Salary range: ${sd.salaryBenchmarks?.minCTC || 'N/A'} to ${sd.salaryBenchmarks?.maxCTC || 'N/A'}
- Demand: ${sd.demandAnalysis?.jobPostingTrends || 'N/A'}
- Top trends: ${trends || 'N/A'}
- Joining timeline: ${sd.joiningTimelines?.typicalTimeToHire || 'N/A'}

Write ONLY the summary paragraph, no headers or formatting. Include a reference to the notice period considerations if relevant.`;
}

// ── Stage 5 — Reputation enrichment (focused web search per spec §8) ─────

const REPUTATION_SYSTEM_PROMPT = `You are an expert recruitment market research analyst. Use the web to find current Glassdoor India ratings and employee recommendation percentages for the requested companies. Return SPECIFIC NUMBERS only — ratings out of 5.0 and recommendation percentages.`;

function buildReputationUserPrompt(companyNames) {
  const list = companyNames.map(n => `- ${n}`).join('\n');
  return `Find current Glassdoor India data for these companies:
${list}

For each company, return:
- Glassdoor rating (X.X out of 5.0)
- Employee recommendation percentage (e.g., "78% would recommend to a friend")
- Source URL

Cite Glassdoor India only. Do not infer ratings — only report what you can find on Glassdoor.`;
}

// ── Post-processing rules (spec §6 + §14.7) ──────────────────────────────

/** Cap typicalTimeToHire at 8 weeks. Handles ranges like "6-12 weeks" too. */
function capTimeToHire(value) {
  if (!value || typeof value !== 'string') return value;
  const range = value.match(/(\d+)\s*[-–]\s*(\d+)/);
  if (range) {
    const lo = Math.min(Number(range[1]), 8);
    const hi = Math.min(Number(range[2]), 8);
    return value.replace(range[0], `${lo}-${hi}`);
  }
  const single = value.match(/(\d+)/);
  if (single) {
    const n = Math.min(Number(single[1]), 8);
    return value.replace(single[0], String(n));
  }
  return value;
}

/** Classify a combined-skill row as Vanilla / Niche / Super Niche by count. */
function classifySkillRow(row) {
  if (!row) return row;
  const numericProfiles = parseProfileCount(row.availableProfiles);
  let classification = row.skillType;
  if (numericProfiles != null) {
    if      (numericProfiles >= 10000) classification = 'Vanilla';
    else if (numericProfiles >= 1000)  classification = 'Niche';
    else                               classification = 'Super Niche';
  }
  return { ...row, skillType: classification };
}

/** Best-effort parse of strings like "45,000", "1.5K", "2L", "1 lakh", "1cr". */
function parseProfileCount(s) {
  if (!s || typeof s !== 'string') return null;
  const cleaned = s.toLowerCase().replace(/[,\s]/g, '');
  const m = cleaned.match(/(\d+(?:\.\d+)?)\s*(k|m|l|lakh|lakhs|cr|crore|crores)?/);
  if (!m) return null;
  const n = parseFloat(m[1]);
  if (Number.isNaN(n)) return null;
  const u = m[2];
  if (!u)                    return Math.round(n);
  if (u === 'k')             return Math.round(n * 1000);
  if (u === 'm')             return Math.round(n * 1_000_000);
  if (['l','lakh','lakhs'].includes(u)) return Math.round(n * 100_000);
  if (['cr','crore','crores'].includes(u)) return Math.round(n * 10_000_000);
  return Math.round(n);
}

/** Apply all post-parse business rules. Returns a new structuredData object. */
function applyBusinessRules(structuredData) {
  const out = { ...structuredData };
  if (out.joiningTimelines?.typicalTimeToHire) {
    out.joiningTimelines = {
      ...out.joiningTimelines,
      typicalTimeToHire: capTimeToHire(out.joiningTimelines.typicalTimeToHire),
    };
  }
  if (Array.isArray(out.skillAvailability?.skills) && out.skillAvailability.skills.length > 0) {
    // Spec §6 demands EXACTLY one row representing the combined-skill pool.
    // Schema enforces maxItems:1 already, but be safe — keep the first.
    const row = out.skillAvailability.skills[0];
    out.skillAvailability = {
      ...out.skillAvailability,
      skills: [classifySkillRow(row)],
    };
  }
  return out;
}

/** Extract URLs from the Stage-2 research content blocks (text + citations). */
function extractCitations(researchContent) {
  if (!Array.isArray(researchContent)) return [];
  const urls = new Set();
  for (const block of researchContent) {
    // Anthropic web_search produces blocks of type "web_search_tool_result"
    // and citation blocks attached to text spans.
    if (block?.type === 'web_search_tool_result' && Array.isArray(block.content)) {
      for (const r of block.content) {
        if (r?.url) urls.add(r.url);
      }
    }
    if (Array.isArray(block?.citations)) {
      for (const c of block.citations) {
        if (c?.url) urls.add(c.url);
      }
    }
  }
  return [...urls];
}

/** Inject the citation list into every section's `sources` field. */
function injectSources(structuredData, sources) {
  if (!Array.isArray(sources) || sources.length === 0) return structuredData;
  const out = {};
  for (const [key, val] of Object.entries(structuredData)) {
    out[key] = val && typeof val === 'object'
      ? { ...val, sources }
      : val;
  }
  return out;
}

module.exports = {
  ALLOWED_VALUES,
  // Stage 0
  PARSE_JD_SYSTEM_PROMPT,
  PARSE_JD_TOOL,
  // Stage 2
  RESEARCH_SYSTEM_PROMPT,
  buildResearchUserPrompt,
  // Stage 3
  STRUCTURE_SYSTEM_PROMPT,
  STRUCTURED_DATA_SCHEMA,
  buildStructureUserPrompt,
  // Stage 4
  EXEC_SUMMARY_SYSTEM_PROMPT,
  buildExecSummaryUserPrompt,
  // Stage 5
  REPUTATION_SYSTEM_PROMPT,
  buildReputationUserPrompt,
  // Post-processing
  capTimeToHire,
  classifySkillRow,
  parseProfileCount,
  applyBusinessRules,
  extractCitations,
  injectSources,
};
