/**
 * server/services/mis-schema.js
 *
 * Curated schema descriptor for the Ask MIS agent. This is what the LLM sees
 * when it calls list_schema — NOT the raw CREATE TABLE statements. Keeping it
 * curated:
 *   1. Reduces token cost (we omit columns the agent shouldn't reason over).
 *   2. Prevents the agent from hallucinating column names — every name listed
 *      here is real, so the SQLite query planner will accept it.
 *   3. Gives the agent semantic notes (allowed enum values, what a metric
 *      means, common joins) that aren't in the raw schema.
 *
 * Domains:
 *   - jobs_pipeline          → v_jobs, v_candidates, v_sessions,
 *                              v_session_candidates, v_jd_enhancements,
 *                              v_pofu_candidates, v_job_assignees,
 *                              v_job_hiring_managers, v_users
 *   - assessments_interviews → v_assessments + invites + submissions,
 *                              v_coding_*, v_video_*
 */

const DOMAINS = {
  jobs_pipeline: {
    purpose: 'Job requisitions, candidate database, recruitment pipeline sessions, JD enhancements, and post-offer follow-up (POFU).',
    views: {
      v_jobs: {
        purpose: 'Job requisitions / openings.',
        columns: {
          id: 'INTEGER PK',
          user_id: 'INTEGER — recruiter who created the job',
          company_id: 'INTEGER',
          title: 'TEXT — job title',
          department: 'TEXT',
          client_name: 'TEXT — for agency engagements',
          location: 'TEXT',
          employment_type: "TEXT — 'Full-time' | 'Part-time' | 'Contract' | etc.",
          experience_min: 'INTEGER — years',
          experience_max: 'INTEGER — years',
          salary_min: 'INTEGER',
          salary_max: 'INTEGER',
          openings_count: 'INTEGER',
          status: "TEXT — 'draft' | 'active' | 'closed'",
          is_qualified: 'INTEGER 0/1 — has the recruiter completed the qualification Q&A',
          created_at: 'TEXT (ISO datetime)',
          updated_at: 'TEXT (ISO datetime)',
          lead_user_id: 'INTEGER — assigned lead recruiter (from job_assignees)',
          lead_name: 'TEXT — display name of the lead recruiter',
        },
      },
      v_candidates: {
        purpose: 'Candidate database — people who could potentially be hired.',
        columns: {
          id: 'INTEGER PK',
          user_id: "INTEGER — recruiter who added them",
          name: 'TEXT',
          email: 'TEXT',
          phone: 'TEXT',
          location: 'TEXT',
          current_title: 'TEXT',
          current_company: 'TEXT',
          experience_years: 'REAL',
          status: "TEXT — 'active' | 'inactive'",
          created_at: 'TEXT',
        },
      },
      v_sessions: {
        purpose: 'Pipeline sessions: a screening + interview workflow for a job.',
        columns: {
          id: 'INTEGER PK',
          user_id: 'INTEGER',
          job_id: 'INTEGER → v_jobs.id',
          name: 'TEXT',
          current_step: 'INTEGER 1–6 — workflow step the session is on',
          status: "TEXT — 'active' | 'completed' | 'archived'",
          created_at: 'TEXT',
          updated_at: 'TEXT',
        },
      },
      v_session_candidates: {
        purpose: 'Candidates moving through a pipeline session. One row per (session, candidate).',
        columns: {
          id: 'INTEGER PK',
          session_id: 'INTEGER → v_sessions.id',
          candidate_id: 'INTEGER → v_candidates.id',
          match_percentage: 'REAL 0–100',
          screening_status: "TEXT — 'pending' | 'pass' | 'fail' | 'on_hold'",
          ai_interview_score: 'INTEGER',
          decision: "TEXT — 'proceed' | 'pool' (NULL until decided)",
          interview_level: "TEXT — 'L1' | 'L2' | 'L3'",
          email_sent: 'INTEGER 0/1',
          pipeline_status: "TEXT — 'pending' | 'hold' | 'reject' | 'selected'",
          vi_invite_sent: 'INTEGER 0/1',
          vi_review: 'TEXT — recruiter notes on the VI',
          assessment_type: 'TEXT',
          interview_scheduled_at: 'TEXT',
          selected_at: 'TEXT — when pipeline_status moved to selected (time-to-hire base)',
          added_at: 'TEXT',
        },
      },
      v_jd_enhancements: {
        purpose: 'AI-enhanced job descriptions. Standalone (no job_id) or linked to a job.',
        columns: {
          id: 'INTEGER PK',
          user_id: 'INTEGER',
          title: 'TEXT',
          job_id: 'INTEGER NULLABLE → v_jobs.id',
          created_at: 'TEXT',
        },
      },
      v_pofu_candidates: {
        purpose: 'Post-Offer Follow-Up — candidates between offer acceptance and joining.',
        columns: {
          id: 'INTEGER PK',
          user_id: 'INTEGER',
          session_id: 'INTEGER NULLABLE',
          candidate_id: 'INTEGER NULLABLE',
          job_id: 'INTEGER NULLABLE → v_jobs.id',
          candidate_name: 'TEXT',
          role_title: 'TEXT',
          company_name: 'TEXT — hiring company',
          doj: 'TEXT — date of joining (target)',
          state: "TEXT — 'offer_accepted' | 'resigned' | 'bgv' | 'confirmed' | 'joined' | 'dropped'",
          risk_score: 'INTEGER 0–100',
          risk_level: "TEXT — 'low' | 'medium' | 'high'",
          last_email_at: 'TEXT',
          last_response_at: 'TEXT',
          created_at: 'TEXT',
        },
      },
      v_job_assignees: {
        purpose: 'Who is assigned to which job (lead recruiter, collaborators, sourcers).',
        columns: {
          id: 'INTEGER PK',
          job_id: 'INTEGER → v_jobs.id',
          user_id: 'INTEGER → v_users.id',
          role_on_job: "TEXT — 'lead' | 'collaborator' | 'sourcer'",
          assigned_at: 'TEXT',
        },
      },
      v_job_hiring_managers: {
        purpose: 'Hiring managers attached to a job.',
        columns: {
          id: 'INTEGER PK',
          job_id: 'INTEGER → v_jobs.id',
          user_id: 'INTEGER → v_users.id',
          added_at: 'TEXT',
        },
      },
      v_users: {
        purpose: 'People who can log into the app: recruiters, sourcers, hiring managers, leadership.',
        columns: {
          id: 'INTEGER PK',
          email: 'TEXT',
          display_name: 'TEXT',
          role: "TEXT — 'owner' | 'team_lead' | 'sr_recruiter' | 'recruiter' | 'sourcer' | 'hiring_manager'",
        },
      },
    },
    common_metrics: [
      "Active jobs:                SELECT COUNT(*) FROM v_jobs WHERE status='active'",
      "Pipeline funnel:            SELECT screening_status, COUNT(*) FROM v_session_candidates GROUP BY screening_status",
      "Selected candidates / week: SELECT date(selected_at,'weekday 0','-6 days') AS week, COUNT(*) FROM v_session_candidates WHERE pipeline_status='selected' GROUP BY week",
      "Average time-to-fill (days, on selected): SELECT AVG(julianday(sc.selected_at) - julianday(j.created_at)) FROM v_session_candidates sc JOIN v_sessions s ON s.id = sc.session_id JOIN v_jobs j ON j.id = s.job_id WHERE sc.pipeline_status='selected'",
      "Recruiter leaderboard:      SELECT u.display_name, COUNT(*) AS selections FROM v_session_candidates sc JOIN v_sessions s ON s.id = sc.session_id JOIN v_users u ON u.id = s.user_id WHERE sc.pipeline_status='selected' GROUP BY u.id ORDER BY selections DESC",
      "POFU risk distribution:     SELECT risk_level, COUNT(*) FROM v_pofu_candidates WHERE state NOT IN ('joined','dropped') GROUP BY risk_level",
    ],
  },

  assessments_interviews: {
    purpose: 'MCQ assessments, coding assessments, and video interviews — including invites and submissions.',
    views: {
      v_assessments: {
        purpose: 'MCQ assessments created by recruiters.',
        columns: {
          id: 'INTEGER PK',
          user_id: 'INTEGER',
          job_id: 'INTEGER NULLABLE → v_jobs.id',
          title: 'TEXT',
          description: 'TEXT',
          time_limit_min: 'INTEGER',
          pass_score: 'INTEGER 0–100',
          status: "TEXT — 'draft' | 'active' | 'closed'",
          created_at: 'TEXT',
        },
      },
      v_assessment_invites: {
        purpose: 'Per-candidate MCQ invitations.',
        columns: {
          id: 'INTEGER PK',
          assessment_id: 'INTEGER → v_assessments.id',
          candidate_id: 'INTEGER NULLABLE → v_candidates.id',
          candidate_name: 'TEXT',
          candidate_email: 'TEXT',
          status: "TEXT — 'pending' | 'started' | 'completed'",
          invited_at: 'TEXT',
          started_at: 'TEXT',
          completed_at: 'TEXT',
        },
      },
      v_assessment_submissions: {
        purpose: 'MCQ submissions with scores.',
        columns: {
          id: 'INTEGER PK',
          invite_id: 'INTEGER → v_assessment_invites.id',
          assessment_id: 'INTEGER → v_assessments.id',
          score: 'INTEGER 0–100',
          correct_count: 'INTEGER',
          total_questions: 'INTEGER',
          time_taken_sec: 'INTEGER',
          submitted_at: 'TEXT',
        },
      },
      v_coding_assessments: {
        purpose: 'Coding assessments created by recruiters.',
        columns: {
          id: 'INTEGER PK',
          user_id: 'INTEGER',
          job_id: 'INTEGER NULLABLE → v_jobs.id',
          title: 'TEXT',
          time_limit_min: 'INTEGER',
          pass_score: 'INTEGER 0–100',
          status: "TEXT — 'draft' | 'active' | 'closed'",
          created_at: 'TEXT',
        },
      },
      v_coding_invites: {
        purpose: 'Per-candidate coding-assessment invitations.',
        columns: {
          id: 'INTEGER PK',
          assessment_id: 'INTEGER → v_coding_assessments.id',
          candidate_id: 'INTEGER NULLABLE',
          candidate_name: 'TEXT',
          candidate_email: 'TEXT',
          status: "TEXT — 'pending' | 'started' | 'completed'",
          invited_at: 'TEXT',
          started_at: 'TEXT',
          completed_at: 'TEXT',
        },
      },
      v_coding_submissions: {
        purpose: 'Coding submissions with AI-evaluated scores.',
        columns: {
          id: 'INTEGER PK',
          invite_id: 'INTEGER → v_coding_invites.id',
          assessment_id: 'INTEGER → v_coding_assessments.id',
          score: 'INTEGER 0–100',
          time_taken_sec: 'INTEGER',
          submitted_at: 'TEXT',
        },
      },
      v_video_interviews: {
        purpose: 'Video interview rounds.',
        columns: {
          id: 'INTEGER PK',
          user_id: 'INTEGER',
          job_id: 'INTEGER NULLABLE → v_jobs.id',
          title: 'TEXT',
          question_count: 'INTEGER',
          expiry_date: 'TEXT',
          status: "TEXT — 'draft' | 'active' | 'closed'",
          created_at: 'TEXT',
        },
      },
      v_video_candidates: {
        purpose: 'Candidates invited to a video interview.',
        columns: {
          id: 'INTEGER PK',
          interview_id: 'INTEGER → v_video_interviews.id',
          candidate_id: 'INTEGER NULLABLE',
          name: 'TEXT',
          email: 'TEXT',
          status: "TEXT — 'invited' | 'in_progress' | 'completed' | 'evaluated'",
          interview_started_at: 'TEXT',
          interview_completed_at: 'TEXT',
          created_at: 'TEXT',
        },
      },
      v_video_evaluations: {
        purpose: 'AI-evaluated video interview results.',
        columns: {
          id: 'INTEGER PK',
          candidate_id: 'INTEGER → v_video_candidates.id',
          interview_id: 'INTEGER → v_video_interviews.id',
          overall_score: 'INTEGER 0–100',
          hiring_recommendation: "TEXT — e.g. 'strong_hire' | 'hire' | 'maybe' | 'no_hire'",
          created_at: 'TEXT',
        },
      },
    },
    common_metrics: [
      "MCQ completion rate:        SELECT (100.0 * SUM(CASE WHEN status='completed' THEN 1 ELSE 0 END) / COUNT(*)) AS pct FROM v_assessment_invites",
      "MCQ avg score by assessment: SELECT a.title, AVG(s.score) FROM v_assessment_submissions s JOIN v_assessments a ON a.id=s.assessment_id GROUP BY a.id",
      "MCQ pass rate (>= pass_score): SELECT (100.0 * SUM(CASE WHEN s.score >= a.pass_score THEN 1 ELSE 0 END) / COUNT(*)) FROM v_assessment_submissions s JOIN v_assessments a ON a.id=s.assessment_id",
      "Coding pass rate:           SELECT (100.0 * SUM(CASE WHEN cs.score >= ca.pass_score THEN 1 ELSE 0 END) / COUNT(*)) FROM v_coding_submissions cs JOIN v_coding_assessments ca ON ca.id=cs.assessment_id",
      "VI recommendation breakdown: SELECT hiring_recommendation, COUNT(*) FROM v_video_evaluations GROUP BY hiring_recommendation",
    ],
  },
};

/**
 * Build a compact prose schema description for one or more domains. Passed to
 * the LLM via the list_schema tool result.
 */
function buildDomainBlock(name) {
  const dom = DOMAINS[name];
  if (!dom) throw new Error(`Unknown domain: ${name}`);

  const lines = [];
  lines.push(`# Domain: ${name}`);
  lines.push(dom.purpose);
  lines.push('');
  lines.push('## Views (scope filters are already applied — query these, NEVER the raw tables)');
  for (const [viewName, view] of Object.entries(dom.views)) {
    lines.push('');
    lines.push(`### ${viewName}`);
    lines.push(view.purpose);
    lines.push('Columns:');
    for (const [col, desc] of Object.entries(view.columns)) {
      lines.push(`  - ${col}: ${desc}`);
    }
  }
  if (dom.common_metrics?.length) {
    lines.push('');
    lines.push('## Common metric patterns');
    for (const m of dom.common_metrics) lines.push(`  - ${m}`);
  }
  return lines.join('\n');
}

function listDomains() {
  return Object.keys(DOMAINS).map(k => ({ name: k, purpose: DOMAINS[k].purpose }));
}

module.exports = {
  DOMAINS,
  buildDomainBlock,
  listDomains,
};
