/**
 * Seed script — 10 Jobs + 100 Candidates
 * Run: node seed.js  (from project root)
 */

const { db } = require('./db'); // reuses existing connection + ensures schema is created

// ── Get admin user ───────────────────────────────────────────────────────────
const admin = db.prepare("SELECT id FROM users WHERE email = 'pratik@zeople-ai.com'").get();
if (!admin) { console.error('Admin user not found. Run the server once first to seed users.'); process.exit(1); }
const UID = admin.id;

// ── Jobs ─────────────────────────────────────────────────────────────────────
const JOBS = [
  {
    title: 'Senior React Developer',
    department: 'Engineering',
    client_name: 'Razorpay',
    location: 'Bangalore (Hybrid)',
    employment_type: 'Full-time',
    description: 'Build and maintain scalable frontend applications for our payments dashboard. Own the component library, mentor junior devs, and collaborate with product on new features.',
    experience_min: 4, experience_max: 8,
    salary_min: 25, salary_max: 40,
    openings_count: 2,
    required_skills: ['React', 'JavaScript', 'TypeScript', 'Redux', 'HTML/CSS', 'REST APIs'],
    preferred_skills: ['Next.js', 'GraphQL', 'Jest', 'Figma', 'Node.js'],
    status: 'active',
  },
  {
    title: 'Node.js Backend Engineer',
    department: 'Engineering',
    client_name: 'Zepto',
    location: 'Mumbai (On-site)',
    employment_type: 'Full-time',
    description: 'Design and build high-throughput microservices for our quick-commerce platform. Handle millions of daily transactions with sub-100ms latency.',
    experience_min: 3, experience_max: 7,
    salary_min: 20, salary_max: 35,
    openings_count: 3,
    required_skills: ['Node.js', 'Express', 'MongoDB', 'Redis', 'REST APIs', 'Microservices'],
    preferred_skills: ['Kafka', 'Docker', 'PostgreSQL', 'AWS', 'TypeScript'],
    status: 'active',
  },
  {
    title: 'Full Stack Developer (MERN)',
    department: 'Product Engineering',
    client_name: 'Freshworks',
    location: 'Chennai (Hybrid)',
    employment_type: 'Full-time',
    description: 'End-to-end ownership of product features across the MERN stack. Work with cross-functional teams on our CRM SaaS product.',
    experience_min: 2, experience_max: 5,
    salary_min: 12, salary_max: 22,
    openings_count: 4,
    required_skills: ['React', 'Node.js', 'MongoDB', 'Express', 'JavaScript', 'Git'],
    preferred_skills: ['TypeScript', 'Docker', 'AWS', 'Redis', 'Jest'],
    status: 'active',
  },
  {
    title: 'Data Engineer',
    department: 'Data Platform',
    client_name: 'Swiggy',
    location: 'Bangalore (Hybrid)',
    employment_type: 'Full-time',
    description: 'Build and maintain data pipelines processing 50M+ daily events. Own the ETL infrastructure that powers our analytics and ML teams.',
    experience_min: 3, experience_max: 6,
    salary_min: 18, salary_max: 32,
    openings_count: 2,
    required_skills: ['Python', 'Apache Spark', 'SQL', 'Airflow', 'Kafka', 'AWS'],
    preferred_skills: ['Databricks', 'dbt', 'Snowflake', 'Scala', 'Docker'],
    status: 'active',
  },
  {
    title: 'DevOps / Platform Engineer',
    department: 'Infrastructure',
    client_name: 'PhonePe',
    location: 'Bangalore (On-site)',
    employment_type: 'Full-time',
    description: 'Own and scale our Kubernetes-based infrastructure serving 400M+ users. Drive CI/CD maturity, observability, and cost optimisation.',
    experience_min: 4, experience_max: 8,
    salary_min: 22, salary_max: 38,
    openings_count: 2,
    required_skills: ['Kubernetes', 'Docker', 'AWS', 'Terraform', 'CI/CD', 'Linux'],
    preferred_skills: ['Helm', 'Prometheus', 'Grafana', 'Jenkins', 'Python', 'Go'],
    status: 'active',
  },
  {
    title: 'Product Manager — SaaS B2B',
    department: 'Product',
    client_name: 'Chargebee',
    location: 'Chennai / Remote',
    employment_type: 'Full-time',
    description: 'Define and execute product strategy for our billing and subscription management suite. Work closely with enterprise customers and engineering teams.',
    experience_min: 4, experience_max: 8,
    salary_min: 28, salary_max: 50,
    openings_count: 1,
    required_skills: ['Product Management', 'Roadmapping', 'User Research', 'Agile', 'Data Analysis'],
    preferred_skills: ['SQL', 'B2B SaaS', 'Jira', 'Figma', 'Mixpanel'],
    status: 'active',
  },
  {
    title: 'QA Automation Engineer',
    department: 'Quality Engineering',
    client_name: 'Infosys BPM',
    location: 'Pune (Hybrid)',
    employment_type: 'Full-time',
    description: 'Build and maintain automation frameworks for web, API, and mobile testing. Champion quality across 3 product squads.',
    experience_min: 2, experience_max: 6,
    salary_min: 8, salary_max: 18,
    openings_count: 5,
    required_skills: ['Selenium', 'Java', 'TestNG', 'API Testing', 'JIRA', 'Agile'],
    preferred_skills: ['Appium', 'Postman', 'RestAssured', 'Jenkins', 'SQL', 'Python'],
    status: 'active',
  },
  {
    title: 'Machine Learning Engineer',
    department: 'AI/ML',
    client_name: 'Meesho',
    location: 'Bangalore (Hybrid)',
    employment_type: 'Full-time',
    description: 'Build recommendation and ranking models that drive discovery for 150M+ users. Own the full ML lifecycle from experimentation to production deployment.',
    experience_min: 3, experience_max: 7,
    salary_min: 25, salary_max: 45,
    openings_count: 2,
    required_skills: ['Python', 'Machine Learning', 'TensorFlow', 'SQL', 'Statistics', 'Feature Engineering'],
    preferred_skills: ['PyTorch', 'Spark', 'MLflow', 'AWS SageMaker', 'Recommendation Systems', 'A/B Testing'],
    status: 'active',
  },
  {
    title: 'Android Developer (Kotlin)',
    department: 'Mobile Engineering',
    client_name: 'CRED',
    location: 'Bangalore (On-site)',
    employment_type: 'Full-time',
    description: 'Build delightful Android experiences for our 12M+ premium user base. Own performance, animations, and architectural quality of the CRED app.',
    experience_min: 3, experience_max: 7,
    salary_min: 20, salary_max: 38,
    openings_count: 2,
    required_skills: ['Kotlin', 'Android SDK', 'Jetpack Compose', 'MVVM', 'REST APIs', 'Git'],
    preferred_skills: ['Coroutines', 'Hilt', 'Room', 'Firebase', 'Unit Testing', 'CI/CD'],
    status: 'active',
  },
  {
    title: 'Technical Project Manager',
    department: 'Delivery',
    client_name: 'Wipro Digital',
    location: 'Hyderabad (Hybrid)',
    employment_type: 'Full-time',
    description: 'Lead delivery of enterprise digital transformation projects. Manage cross-functional teams, client stakeholders, and project P&L.',
    experience_min: 6, experience_max: 12,
    salary_min: 25, salary_max: 42,
    openings_count: 2,
    required_skills: ['Project Management', 'Agile', 'Scrum', 'Stakeholder Management', 'Risk Management', 'JIRA'],
    preferred_skills: ['PMP', 'Cloud Platforms', 'Budget Management', 'Confluence', 'Technical Background'],
    status: 'active',
  },
];

// ── Candidate data pools ──────────────────────────────────────────────────────
const FIRST_NAMES = ['Arjun','Priya','Rahul','Sneha','Vikram','Anjali','Rohit','Divya','Karan','Meera',
  'Aditya','Pooja','Siddharth','Nisha','Manish','Kavita','Rajesh','Sunita','Amit','Ritu',
  'Deepak','Preeti','Suresh','Geeta','Vivek','Swati','Gaurav','Rekha','Nikhil','Asha',
  'Sachin','Usha','Vinod','Lata','Pankaj','Seema','Ravi','Nandini','Ajay','Chitra',
  'Mohit','Pallavi','Saurabh','Madhuri','Tarun','Vandana','Arun','Shruti','Harish','Anita'];

const LAST_NAMES = ['Sharma','Patel','Verma','Singh','Kumar','Gupta','Joshi','Mehta','Nair','Rao',
  'Reddy','Iyer','Pillai','Shah','Mishra','Dubey','Pandey','Tiwari','Chauhan','Bose',
  'Das','Malhotra','Kapoor','Khanna','Chopra','Sinha','Bhat','Menon','Krishnan','Venkat'];

const COMPANIES = ['Infosys','TCS','Wipro','HCL Technologies','Tech Mahindra','Accenture','Cognizant',
  'Capgemini','IBM India','Oracle India','Mphasis','Hexaware','Mindtree','LTIMindtree',
  'Persistent Systems','Zensar','NIIT Technologies','Cyient','Mastech','Infoedge',
  'Zomato','Swiggy','Flipkart','Paytm','BYJU\'s','Ola','Nykaa','PolicyBazaar','Dunzo','Groww'];

const LOCATIONS = ['Bangalore','Mumbai','Pune','Hyderabad','Chennai','Delhi NCR','Noida','Kolkata','Ahmedabad','Kochi'];

const EDUCATIONS = [
  'B.E. Computer Science, VTU Bangalore',
  'B.Tech Computer Science, IIT Delhi',
  'B.E. Information Technology, Anna University Chennai',
  'B.Tech CSE, NIT Trichy',
  'MCA, Symbiosis Pune',
  'B.Tech ECE, Osmania University Hyderabad',
  'B.E. CSE, Pune University',
  'M.Tech CSE, IIT Bombay',
  'B.Tech IT, BITS Pilani',
  'B.E. Computer Science, Mumbai University',
];

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function pickN(arr, n) {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}
function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function randFloat(min, max) { return Math.round((Math.random() * (max - min) + min) * 10) / 10; }

// Candidate templates per role-type
const CANDIDATE_TYPES = [
  // React/Frontend (15)
  ...Array(15).fill(null).map((_, i) => ({
    _type: 'frontend',
    current_title: pick(['Frontend Developer','Senior Frontend Engineer','React Developer','UI Developer','Senior React Developer']),
    skills: pickN(['React','JavaScript','TypeScript','Redux','HTML/CSS','REST APIs','Next.js','GraphQL','Jest','Webpack','Figma','Vue.js','Angular','Node.js','Git','Tailwind CSS'], randInt(5, 10)),
    experience_years: randFloat(2, 9),
  })),
  // Node.js/Backend (15)
  ...Array(15).fill(null).map((_, i) => ({
    _type: 'backend',
    current_title: pick(['Backend Developer','Node.js Developer','Senior Backend Engineer','Software Engineer - Backend','API Developer']),
    skills: pickN(['Node.js','Express','MongoDB','Redis','REST APIs','Microservices','Kafka','Docker','PostgreSQL','AWS','TypeScript','MySQL','Git','Linux','RabbitMQ'], randInt(5, 10)),
    experience_years: randFloat(2, 8),
  })),
  // Full Stack (15)
  ...Array(15).fill(null).map((_, i) => ({
    _type: 'fullstack',
    current_title: pick(['Full Stack Developer','MERN Stack Developer','Software Engineer','Senior Software Engineer','Full Stack Engineer']),
    skills: pickN(['React','Node.js','MongoDB','Express','JavaScript','Git','TypeScript','Docker','AWS','Redux','MySQL','REST APIs','HTML/CSS','Jest','Redis'], randInt(6, 11)),
    experience_years: randFloat(1, 6),
  })),
  // Data Engineer (10)
  ...Array(10).fill(null).map((_, i) => ({
    _type: 'data',
    current_title: pick(['Data Engineer','Senior Data Engineer','Big Data Engineer','ETL Developer','Data Platform Engineer']),
    skills: pickN(['Python','Apache Spark','SQL','Airflow','Kafka','AWS','Databricks','dbt','Snowflake','Scala','Docker','PySpark','Hive','Hadoop','BigQuery'], randInt(5, 9)),
    experience_years: randFloat(2, 8),
  })),
  // DevOps (10)
  ...Array(10).fill(null).map((_, i) => ({
    _type: 'devops',
    current_title: pick(['DevOps Engineer','Platform Engineer','SRE','Cloud Engineer','Infrastructure Engineer']),
    skills: pickN(['Kubernetes','Docker','AWS','Terraform','CI/CD','Linux','Helm','Prometheus','Grafana','Jenkins','Python','Ansible','Azure','GCP','Git'], randInt(5, 10)),
    experience_years: randFloat(3, 9),
  })),
  // Product Manager (8)
  ...Array(8).fill(null).map((_, i) => ({
    _type: 'pm',
    current_title: pick(['Product Manager','Senior Product Manager','Associate Product Manager','Product Lead','Group Product Manager']),
    skills: pickN(['Product Management','Roadmapping','User Research','Agile','Data Analysis','SQL','B2B SaaS','Jira','Figma','Mixpanel','A/B Testing','Stakeholder Management'], randInt(4, 8)),
    experience_years: randFloat(3, 10),
  })),
  // QA (8)
  ...Array(8).fill(null).map((_, i) => ({
    _type: 'qa',
    current_title: pick(['QA Engineer','Test Engineer','SDET','Automation Engineer','Senior QA Engineer']),
    skills: pickN(['Selenium','Java','TestNG','API Testing','JIRA','Agile','Appium','Postman','RestAssured','Jenkins','SQL','Python','JUnit','Cucumber','Manual Testing'], randInt(5, 9)),
    experience_years: randFloat(1, 7),
  })),
  // ML Engineer (8)
  ...Array(8).fill(null).map((_, i) => ({
    _type: 'ml',
    current_title: pick(['Machine Learning Engineer','Data Scientist','AI Engineer','Senior ML Engineer','Applied Scientist']),
    skills: pickN(['Python','Machine Learning','TensorFlow','SQL','Statistics','Feature Engineering','PyTorch','Spark','MLflow','AWS SageMaker','Recommendation Systems','A/B Testing','NLP','Computer Vision','Pandas'], randInt(5, 9)),
    experience_years: randFloat(2, 8),
  })),
  // Android (7)
  ...Array(7).fill(null).map((_, i) => ({
    _type: 'android',
    current_title: pick(['Android Developer','Senior Android Engineer','Mobile Developer','Android Engineer']),
    skills: pickN(['Kotlin','Android SDK','Jetpack Compose','MVVM','REST APIs','Git','Coroutines','Hilt','Room','Firebase','Unit Testing','Java','CI/CD','RxJava'], randInt(5, 9)),
    experience_years: randFloat(2, 8),
  })),
  // TPM (4)
  ...Array(4).fill(null).map((_, i) => ({
    _type: 'tpm',
    current_title: pick(['Technical Project Manager','Delivery Manager','Program Manager','Senior TPM']),
    skills: pickN(['Project Management','Agile','Scrum','Stakeholder Management','Risk Management','JIRA','PMP','Budget Management','Confluence','Technical Background','Cloud Platforms'], randInt(5, 8)),
    experience_years: randFloat(5, 14),
  })),
];

// ── Seed jobs ─────────────────────────────────────────────────────────────────
console.log('Seeding 10 jobs…');
const insertJob = db.prepare(`
  INSERT INTO jobs (user_id, title, department, client_name, location, employment_type,
    description, experience_min, experience_max, salary_min, salary_max, openings_count,
    required_skills, preferred_skills, status)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const insertJobs = db.transaction(() => {
  for (const j of JOBS) {
    insertJob.run(
      UID, j.title, j.department, j.client_name, j.location, j.employment_type,
      j.description, j.experience_min, j.experience_max, j.salary_min, j.salary_max,
      j.openings_count, JSON.stringify(j.required_skills), JSON.stringify(j.preferred_skills), j.status
    );
  }
});
insertJobs();
console.log('  ✓ 10 jobs inserted');

// ── Seed 100 candidates ───────────────────────────────────────────────────────
console.log('Seeding 100 candidates…');

const usedNames = new Set();
function uniqueName() {
  let name;
  do {
    name = `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`;
  } while (usedNames.has(name));
  usedNames.add(name);
  return name;
}

const insertCandidate = db.prepare(`
  INSERT INTO candidates (user_id, name, email, phone, location, current_title,
    current_company, experience_years, skills, education, resume_text, status)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')
`);

function makeResumeText(name, title, company, exp, skills, location, education, ctc, expected) {
  return `${name} | ${title} | ${location} | ${exp} years experience
Current: ${company} — ${title}
Skills: ${skills.join(', ')}
Education: ${education}
CTC: ₹${ctc} LPA | Expected: ₹${expected} LPA | Notice: ${pick(['15','30','45','60','90'])} days

Summary:
${exp > 5 ? 'Senior' : 'Mid-level'} ${title} with ${exp} years of experience in ${skills.slice(0, 3).join(', ')}.
Worked on scalable systems at ${company}. Strong track record of delivering high-quality projects.

Recent Projects:
- Built and maintained core systems using ${skills[0]} and ${skills[1] || skills[0]}
- Collaborated with cross-functional teams in Agile environment
- Improved system performance by 30% through optimization initiatives`;
}

const insertCandidates = db.transaction(() => {
  for (const template of CANDIDATE_TYPES) {
    const name      = uniqueName();
    const loc       = pick(LOCATIONS);
    const company   = pick(COMPANIES);
    const edu       = pick(EDUCATIONS);
    const exp       = template.experience_years;
    const ctc       = Math.round(exp * randFloat(1.8, 2.8));
    const expected  = ctc + randInt(2, 6);
    const email     = `${name.toLowerCase().replace(/ /g, '.')}${randInt(10,99)}@gmail.com`;
    const phone     = `+91 ${randInt(70000,99999)} ${randInt(10000,99999)}`;
    const resume    = makeResumeText(name, template.current_title, company, exp, template.skills, loc, edu, ctc, expected);

    insertCandidate.run(
      UID, name, email, phone, loc, template.current_title,
      company, exp, JSON.stringify(template.skills), edu, resume
    );
  }
});
insertCandidates();
console.log('  ✓ 100 candidates inserted');

// ── Summary ───────────────────────────────────────────────────────────────────
const jobCount  = db.prepare('SELECT COUNT(*) as n FROM jobs WHERE user_id = ?').get(UID).n;
const candCount = db.prepare('SELECT COUNT(*) as n FROM candidates WHERE user_id = ?').get(UID).n;
console.log(`\n✅ Done! DB now has ${jobCount} jobs and ${candCount} candidates for user: pratik@zeople-ai.com`);
