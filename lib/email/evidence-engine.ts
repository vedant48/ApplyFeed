import { extractDomainFromEmail, stripHtml } from './normalizer';
import { extractRole, extractCompany } from './extractor';

export type EmailSource =
  | 'ATS'
  | 'COMPANY_RECRUITING'
  | 'RECRUITER'
  | 'JOB_BOARD'
  | 'PERSONAL'
  | 'UNKNOWN';

export type EmailIntent =
  | 'APPLICATION'
  | 'APPLICATION_RECEIVED'
  | 'INTERVIEW'
  | 'INTERVIEW_SCHEDULE'
  | 'ASSESSMENT'
  | 'RECRUITER'
  | 'OFFER'
  | 'REJECTION'
  | 'FOLLOW_UP'
  | 'OTHER_JOB'
  | 'NOT_JOB';

export type DeterministicClassification = 'JOB' | 'UNCERTAIN' | 'NOT_JOB';

export interface EvidenceItem {
  type: string;
  reason: string;
  weight: number;
}

export interface EvidenceEngineInput {
  sender: string;
  senderEmail: string;
  subject: string;
  snippet?: string;
  bodyText?: string;
  bodyHtml?: string;
  links?: string[];
}

export interface EvidenceEngineResult {
  classification: DeterministicClassification;
  category: EmailIntent;
  source: EmailSource;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  score: number;
  requiresAttention: boolean;
  company: string | null;
  role: string | null;
  platform: string | null;
  evidence: EvidenceItem[];
}

// ----------------------------------------------------------------------
// PLATFORM & ATS REGISTRY (Supporting evidence only)
// ----------------------------------------------------------------------
interface PlatformSignature {
  name: string;
  sourceType: EmailSource;
  domains: string[];
  urlPatterns: RegExp[];
}

const PLATFORM_REGISTRY: PlatformSignature[] = [
  {
    name: 'Greenhouse',
    sourceType: 'ATS',
    domains: ['greenhouse.io', 'boards.greenhouse.io'],
    urlPatterns: [/greenhouse\.io/i, /boards\.greenhouse/i, /gh_jid=/i],
  },
  {
    name: 'Lever',
    sourceType: 'ATS',
    domains: ['lever.co', 'jobs.lever.co', 'hire.lever.co'],
    urlPatterns: [/lever\.co/i, /jobs\.lever/i, /hire\.lever/i],
  },
  {
    name: 'Ashby',
    sourceType: 'ATS',
    domains: ['ashbyhq.com', 'jobs.ashbyhq.com'],
    urlPatterns: [/ashbyhq\.com/i, /jobs\.ashby/i],
  },
  {
    name: 'Workday',
    sourceType: 'ATS',
    domains: ['myworkdayjobs.com', 'workday.com', 'myworkday.com'],
    urlPatterns: [/myworkdayjobs\.com/i, /workday\.com/i, /myworkday/i],
  },
  {
    name: 'SmartRecruiters',
    sourceType: 'ATS',
    domains: ['smartrecruiters.com', 'smrtr.io'],
    urlPatterns: [/smartrecruiters\.com/i, /smrtr\.io/i],
  },
  {
    name: 'Darwinbox',
    sourceType: 'ATS',
    domains: ['darwinbox.com', 'darwinbox.in'],
    urlPatterns: [/darwinbox\.(?:com|in)/i],
  },
  {
    name: 'LinkedIn',
    sourceType: 'JOB_BOARD',
    domains: ['linkedin.com'],
    urlPatterns: [/linkedin\.com\/jobs/i, /linkedin\.com\/comm\/jobs/i],
  },
  {
    name: 'Indeed',
    sourceType: 'JOB_BOARD',
    domains: ['indeed.com', 'indeedemail.com'],
    urlPatterns: [/indeed\.com/i, /indeedemail\.com/i],
  },
  {
    name: 'Naukri',
    sourceType: 'JOB_BOARD',
    domains: ['naukri.com'],
    urlPatterns: [/naukri\.com/i],
  },
  {
    name: 'Hirist',
    sourceType: 'JOB_BOARD',
    domains: ['hirist.tech', 'hirist.com'],
    urlPatterns: [/hirist\.(?:tech|com)/i],
  },
  {
    name: 'Wellfound',
    sourceType: 'JOB_BOARD',
    domains: ['wellfound.com', 'angel.co'],
    urlPatterns: [/wellfound\.com/i, /angel\.co/i],
  },
  {
    name: 'Google Careers',
    sourceType: 'COMPANY_RECRUITING',
    domains: ['google.com'],
    urlPatterns: [/google\.com\/about\/careers/i, /google\.com\/careers/i],
  },
  {
    name: 'Amazon Jobs',
    sourceType: 'COMPANY_RECRUITING',
    domains: ['amazon.jobs', 'mail.amazon.jobs'],
    urlPatterns: [/amazon\.jobs/i],
  },
  {
    name: 'Swiggy Careers',
    sourceType: 'COMPANY_RECRUITING',
    domains: ['careers.swiggy.in', 'swiggy.in'],
    urlPatterns: [/careers\.swiggy\.in/i],
  },
];

// ----------------------------------------------------------------------
// URL PATTERN REGISTRY (Interview & Assessment tools)
// ----------------------------------------------------------------------
const SCHEDULING_URL_PATTERNS = [
  /calendly\.com/i,
  /goodtime\.io/i,
  /chilipiper\.com/i,
  /scheduleonce\.com/i,
  /hubspot\.com\/meetings/i,
  /chime\.aws\/interview/i,
  /zoom\.us\/j\//i,
  /meet\.google\.com\//i,
];

const ASSESSMENT_URL_PATTERNS = [
  /coderpad\.io/i,
  /hackerrank\.com/i,
  /codesignal\.com/i,
  /testgorilla\.com/i,
  /codility\.com/i,
  /mettl\.com/i,
  /hackerearth\.com/i,
  /evalart\.com/i,
];

// ----------------------------------------------------------------------
// ROLE PATTERNS (Deterministic extraction & verification)
// ----------------------------------------------------------------------
const ROLE_PATTERNS = [
  /\b(?:senior\s+|staff\s+|principal\s+|lead\s+|head\s+of\s+)?software\s+(?:dev(?:elopment)?\s+)?(?:engineer|developer)(?:\s+(?:i{1,3}|iv|v|\d))?\b/i,
  /\b(?:frontend|front-end|backend|back-end|full-stack|fullstack)\s+(?:developer|engineer|architect)\b/i,
  /\bsde(?:\s+(?:i{1,3}|iv|v|\d))?\b/i,
  /\b(?:react|react\s+native|node(?:\.js)?|python|golang|java|c\+\+|rust)\s+(?:developer|engineer)\b/i,
  /\b(?:devops|site\s+reliability|sre|cloud|infrastructure|systems)\s+engineer\b/i,
  /\b(?:data|data\s+platform|machine\s+learning|ml|ai)\s+engineer\b/i,
  /\b(?:qa|test|quality\s+assurance|automation)\s+engineer\b/i,
  /\b(?:product\s+manager|engineering\s+manager|technical\s+lead)\b/i,
  /\b(?:ui\/ux\s+designer|product\s+designer)\b/i,
];

// ----------------------------------------------------------------------
// PHRASE REGISTRIES
// ----------------------------------------------------------------------
const PHRASES = {
  APPLICATION_RECEIVED: [
    /\bapplication\s+(?:has\s+been\s+|was\s+)?received\b/i,
    /\bthank\s+you\s+for\s+applying\b/i,
    /\bthanks\s+for\s+applying\b/i,
    /\bwe\s+received\s+your\s+application\b/i,
    /\bapplication\s+(?:successfully\s+)?submitted\b/i,
    /\bapplication\s+confirmation\b/i,
    /\byour\s+application\s+for\s+.+?\s+(?:is|has\s+been)\s+received\b/i,
    /\bwelcome!\s+your\s+application\s+for\b/i,
    /\bconfirming\s+your\s+application\b/i,
  ],
  INTERVIEW: [
    /\binterview\s+invitation\b/i,
    /\binvite\s+(?:you\s+)?to\s+(?:an\s+)?interview\b/i,
    /\bschedule\s+(?:an\s+|your\s+)?interview\b/i,
    /\binterview\s+schedule\b/i,
    /\btechnical\s+interview\b/i,
    /\bcoding\s+interview\b/i,
    /\bphone\s+screen\b/i,
    /\bscreening\s+call\b/i,
    /\bonsite\s+interview\b/i,
    /\bvirtual\s+interview\b/i,
    /\bmeet\s+with\s+the\s+(?:hiring\s+)?team\b/i,
    /\bconversation\s+with\s+the\s+hiring\s+team\b/i,
    /\bschedule\s+a\s+(?:quick\s+)?(?:chat|call)\b/i,
  ],
  ASSESSMENT: [
    /\bcoding\s+assessment\b/i,
    /\btechnical\s+assessment\b/i,
    /\bonline\s+assessment\b/i,
    /\bcoding\s+challenge\b/i,
    /\btake-home\s+(?:assignment|task|exercise)\b/i,
    /\btechnical\s+exercise\b/i,
    /\bcomplete\s+the\s+coding\s+test\b/i,
    /\bassessment\s+invitation\b/i,
  ],
  OFFER: [
    /\boffer\s+letter\b/i,
    /\boffer\s+of\s+employment\b/i,
    /\bemployment\s+offer\b/i,
    /\bjob\s+offer\b/i,
    /\bpleased\s+to\s+offer\b/i,
    /\boffer\s+to\s+join\b/i,
    /\bcompensation\s+package\b/i,
  ],
  REJECTION: [
    /\bdecided\s+not\s+to\s+move\s+forward\b/i,
    /\bwill\s+not\s+be\s+moving\s+forward\b/i,
    /\bnot\s+moving\s+forward\s+with\s+your\s+application\b/i,
    /\bpursue\s+other\s+candidates\b/i,
    /\bpursuing\s+other\s+candidates\b/i,
    /\bmove\s+forward\s+with\s+other\s+candidates\b/i,
    /\bunfortunately,\s+we\s+will\s+not\b/i,
    /\bafter\s+careful\s+(?:review|consideration),\s+we\s+have\s+decided\b/i,
  ],
  FOLLOW_UP: [
    /\bfollowing\s+up\s+on\s+your\s+application\b/i,
    /\bfollowing\s+up\s+regarding\s+the\s+role\b/i,
    /\bchecking\s+in\s+regarding\s+the\s+position\b/i,
    /\bapplication\s+status(?:\s+update)?\b/i,
    /\bstatus\s+of\s+your\s+application\b/i,
    /\byour\s+candidacy\b/i,
    /\bcandidate\s+portal\b/i,
    /\bcandidate\s+profile\b/i,
    /\bkeep\s+track\s+of\s+your\s+application\b/i,
    /\btrack\s+your\s+application\b/i,
    /\bapplication\s+progress\b/i,
    /\bapplication\s+referral\s+request\b/i,
    /\bregarding\s+your\s+application\b/i,
  ],
  RECRUITER_CONTEXT: [
    /\brecruiter\b/i,
    /\brecruiting\b/i,
    /\brecruitment\b/i,
    /\btalent\s+acquisition\b/i,
    /\btalent\s+team\b/i,
    /\bhiring\s+team\b/i,
    /\bhiring\s+manager\b/i,
    /\brecruiting\s+team\b/i,
    /\bopportunity\s+at\b/i,
    /\bcame\s+across\s+your\s+(?:background|profile)\b/i,
    /\bwould\s+love\s+to\s+connect\b/i,
    /\bopen\s+for\s+a\s+(?:quick\s+)?chat\b/i,
  ],
};

// ----------------------------------------------------------------------
// NEGATIVE SIGNALS (Weighted evidence only — NEVER instant discard)
// ----------------------------------------------------------------------
const NEGATIVE_PATTERNS = {
  SHOPPING: [
    /\border\s+confirmation\b/i,
    /\byour\s+(?:amazon\.com\s+)?order\s+has\s+shipped\b/i,
    /\byour\s+order\s+of\b/i,
    /\bpackage\s+has\s+shipped\b/i,
    /\bdelivered:\s+your\b/i,
    /\bpackage\s+was\s+delivered\b/i,
    /\bshipment\s+tracking\b/i,
    /\btracking\s+number\b/i,
    /\byour\s+delivery\b/i,
    /\breceipt\s+for\s+your\s+(?:order|purchase)\b/i,
    /\buber\s+eats\b/i,
    /\byour\s+ride\s+with\s+uber\b/i,
  ],
  FINANCE: [
    /\bstatement\s+is\s+ready\b/i,
    /\bmonthly\s+statement\b/i,
    /\bbank\s+statement\b/i,
    /\bpayment\s+confirmation\b/i,
    /\bpayment\s+received\b/i,
    /\binvoice\s+#\b/i,
    /\bbilling\s+alert\b/i,
  ],
  SECURITY: [
    /\bverification\s+code\b/i,
    /\bone-time\s+passcode\b/i,
    /\bsecurity\s+code:\b/i,
    /\bpassword\s+reset\b/i,
    /\breset\s+your\s+password\b/i,
    /\blogin\s+alert\b/i,
    /\botp\s+is\b/i,
  ],
  MARKETING: [
    /\bannouncing\s+our\s+keynote\b/i,
    /\bearly\s+bird\s+registration\b/i,
    /\bstreaming\s+now\s+on\b/i,
    /\bdiscount\s+on\s+all\b/i,
    /\bflash\s+sale\b/i,
    /\bunsubscribe\s+anytime\b/i,
    /\blimited\s+time\s+offer\b/i,
  ],
  SOCIAL_NOTIF: [
    /\binvitation\s+to\s+connect\b/i,
    /\bwould\s+like\s+to\s+connect\s+on\s+linkedin\b/i,
    /\bview\s+profile\s+to\s+accept\b/i,
    /\bstarted\s+following\s+you\b/i,
    /\bliked\s+your\s+post\b/i,
    /\bcommented\s+on\s+your\b/i,
  ],
};

// ----------------------------------------------------------------------
// MAIN DETERMINISTIC EVALUATION ENGINE
// ----------------------------------------------------------------------
export function evaluateEmailEvidence(input: EvidenceEngineInput): EvidenceEngineResult {
  const sender = input.sender || '';
  const senderEmail = input.senderEmail || '';
  const subject = input.subject || '';
  const snippet = input.snippet || '';
  const bodyText = input.bodyText || snippet || '';
  const links = input.links || [];

  const combinedText = `${sender} ${senderEmail} ${subject} ${snippet} ${bodyText}`;
  const senderDomain = extractDomainFromEmail(senderEmail) || '';

  const evidence: EvidenceItem[] = [];
  let score = 0;

  // 1. Detect Platform (Supporting evidence only)
  let detectedPlatform: string | null = null;
  let detectedSource: EmailSource = 'UNKNOWN';

  for (const plat of PLATFORM_REGISTRY) {
    let matched = false;
    if (plat.domains.some(d => senderDomain === d || senderDomain.endsWith(`.${d}`))) {
      matched = true;
    }
    if (!matched) {
      for (const pattern of plat.urlPatterns) {
        if (pattern.test(combinedText) || links.some(l => pattern.test(l))) {
          matched = true;
          break;
        }
      }
    }

    if (matched) {
      detectedPlatform = plat.name;
      detectedSource = plat.sourceType;
      break;
    }
  }

  // If no platform detected, inspect sender email for corporate recruiting patterns
  if (detectedSource === 'UNKNOWN') {
    if (
      /recruiting@|careers@|jobs@|talent@|hiring@|hr@|ta@|staffing@/i.test(senderEmail) ||
      /\.jobs$|^jobs\.|^careers\./i.test(senderDomain)
    ) {
      detectedSource = 'COMPANY_RECRUITING';
    } else if (/recruiter|talent|staffing/i.test(sender)) {
      detectedSource = 'RECRUITER';
    } else if (/application\s+referral\s+request/i.test(subject)) {
      detectedSource = 'PERSONAL';
    }
  }

  // 2. Score Platform / Source Evidence
  if (detectedSource === 'ATS') {
    score += 45;
    evidence.push({ type: 'ATS_PLATFORM', reason: `Detected ATS platform: ${detectedPlatform}`, weight: 45 });
  } else if (detectedSource === 'COMPANY_RECRUITING') {
    score += 35;
    evidence.push({ type: 'COMPANY_RECRUITING_SENDER', reason: `Company recruiting source (${senderEmail})`, weight: 35 });
  } else if (detectedSource === 'JOB_BOARD') {
    score += 30;
    evidence.push({ type: 'JOB_BOARD_SOURCE', reason: `Job board communication (${detectedPlatform})`, weight: 30 });
  } else if (detectedSource === 'PERSONAL') {
    score += 30;
    evidence.push({ type: 'PERSONAL_OUTREACH', reason: 'User outbound job/referral outreach', weight: 30 });
  }

  // 3. Inspect URLs for interview scheduling and technical assessments
  const hasSchedulingLink = links.some(l => SCHEDULING_URL_PATTERNS.some(p => p.test(l)));
  if (hasSchedulingLink) {
    score += 45;
    evidence.push({ type: 'SCHEDULING_URL', reason: 'Interview scheduling link detected (Calendly/GoodTime/Chime/Zoom)', weight: 45 });
  }

  const hasAssessmentLink = links.some(l => ASSESSMENT_URL_PATTERNS.some(p => p.test(l)));
  if (hasAssessmentLink) {
    score += 45;
    evidence.push({ type: 'ASSESSMENT_URL', reason: 'Coding/assessment platform link detected (CoderPad/HackerRank/etc.)', weight: 45 });
  }

  // 4. Intent Phrase Evaluation
  let detectedIntent: EmailIntent = 'NOT_JOB';

  // Check Offer
  if (PHRASES.OFFER.some(p => p.test(subject) || p.test(snippet) || p.test(bodyText))) {
    score += 55;
    detectedIntent = 'OFFER';
    evidence.push({ type: 'OFFER_PHRASE', reason: 'Job offer terminology detected', weight: 55 });
  }
  // Check Interview
  else if (PHRASES.INTERVIEW.some(p => p.test(subject) || p.test(snippet) || p.test(bodyText)) || hasSchedulingLink) {
    score += 50;
    detectedIntent = hasSchedulingLink ? 'INTERVIEW_SCHEDULE' : 'INTERVIEW';
    evidence.push({ type: 'INTERVIEW_PHRASE', reason: 'Interview invitation or scheduling context detected', weight: 50 });
  }
  // Check Assessment
  else if (PHRASES.ASSESSMENT.some(p => p.test(subject) || p.test(snippet) || p.test(bodyText)) || hasAssessmentLink) {
    score += 45;
    detectedIntent = 'ASSESSMENT';
    evidence.push({ type: 'ASSESSMENT_PHRASE', reason: 'Technical coding challenge / assessment context detected', weight: 45 });
  }
  // Check Application Received
  else if (PHRASES.APPLICATION_RECEIVED.some(p => p.test(subject) || p.test(snippet) || p.test(bodyText))) {
    score += 45;
    detectedIntent = 'APPLICATION_RECEIVED';
    evidence.push({ type: 'APPLICATION_RECEIVED_PHRASE', reason: 'Application receipt confirmation detected', weight: 45 });
  }
  // Check Rejection
  else if (PHRASES.REJECTION.some(p => p.test(subject) || p.test(snippet) || p.test(bodyText))) {
    score += 40;
    detectedIntent = 'REJECTION';
    evidence.push({ type: 'REJECTION_PHRASE', reason: 'Application rejection context detected', weight: 40 });
  }
  // Check Follow-up / Status
  else if (PHRASES.FOLLOW_UP.some(p => p.test(subject) || p.test(snippet) || p.test(bodyText))) {
    score += 35;
    detectedIntent = 'FOLLOW_UP';
    evidence.push({ type: 'FOLLOW_UP_PHRASE', reason: 'Application status update or referral follow-up detected', weight: 35 });
  }
  // Check Recruiter Context
  else if (PHRASES.RECRUITER_CONTEXT.some(p => p.test(subject) || p.test(snippet) || p.test(bodyText))) {
    score += 25;
    detectedIntent = 'RECRUITER';
    evidence.push({ type: 'RECRUITER_CONTEXT_PHRASE', reason: 'Recruiter communication context detected', weight: 25 });
  }

  // 5. Job Role Pattern Detection
  let detectedRole = extractRole(subject, bodyText);
  if (!detectedRole) {
    for (const pattern of ROLE_PATTERNS) {
      const m = subject.match(pattern) || snippet.match(pattern) || bodyText.match(pattern);
      if (m) {
        detectedRole = m[0].trim();
        break;
      }
    }
  }

  if (detectedRole) {
    score += 20;
    evidence.push({ type: 'ROLE_DETECTED', reason: `Recognized professional role: ${detectedRole}`, weight: 20 });
  }

  // 6. Negative Signals (Subtractive weights, never fatal early discard)
  let negativeScore = 0;

  if (NEGATIVE_PATTERNS.SHOPPING.some(p => p.test(subject) || p.test(snippet))) {
    negativeScore += 50;
    evidence.push({ type: 'NEGATIVE_SHOPPING', reason: 'Shopping, delivery, or ecommerce transaction context', weight: -50 });
  }

  if (NEGATIVE_PATTERNS.FINANCE.some(p => p.test(subject) || p.test(snippet))) {
    negativeScore += 50;
    evidence.push({ type: 'NEGATIVE_FINANCE', reason: 'Financial statement, invoice, or banking context', weight: -50 });
  }

  if (NEGATIVE_PATTERNS.SECURITY.some(p => p.test(subject) || p.test(snippet))) {
    negativeScore += 60;
    evidence.push({ type: 'NEGATIVE_SECURITY', reason: 'OTP code, password reset, or security alert context', weight: -60 });
  }

  if (NEGATIVE_PATTERNS.MARKETING.some(p => p.test(subject) && p.test(snippet))) {
    negativeScore += 40;
    evidence.push({ type: 'NEGATIVE_MARKETING', reason: 'Promotional discount or event marketing newsletter', weight: -40 });
  }

  if (NEGATIVE_PATTERNS.SOCIAL_NOTIF.some(p => p.test(subject) || p.test(snippet))) {
    negativeScore += 45;
    evidence.push({ type: 'NEGATIVE_SOCIAL', reason: 'Social connection request or platform notification', weight: -45 });
  }

  // Check sender email specifically for known non-job automated services (unless recruitment)
  if (
    /order-update@|auto-confirm@|shipment-tracking@|billing@|invoices?@|alerts@/i.test(senderEmail) &&
    !/job|career|interview|application/i.test(subject)
  ) {
    negativeScore += 30;
    evidence.push({ type: 'TRANSACTIONAL_SENDER', reason: 'Transactional sender address pattern', weight: -30 });
  }

  const finalScore = score - negativeScore;

  // 7. Extract Company
  let detectedCompany = extractCompany(sender, senderEmail, subject, bodyText);
  if (!detectedCompany && detectedPlatform) {
    if (detectedPlatform === 'Amazon Jobs') detectedCompany = 'Amazon';
    else if (detectedPlatform === 'Swiggy Careers') detectedCompany = 'Swiggy';
    else if (detectedPlatform === 'Google Careers') detectedCompany = 'Google';
  }

  // 8. Derive Final Classification
  let classification: DeterministicClassification = 'NOT_JOB';
  let confidence: 'HIGH' | 'MEDIUM' | 'LOW' = 'MEDIUM';

  // Has strong positive recruitment evidence
  const hasStrongPositive =
    detectedIntent === 'INTERVIEW' ||
    detectedIntent === 'INTERVIEW_SCHEDULE' ||
    detectedIntent === 'OFFER' ||
    detectedIntent === 'APPLICATION_RECEIVED' ||
    detectedIntent === 'ASSESSMENT' ||
    (detectedIntent === 'FOLLOW_UP' && (detectedRole !== null || detectedSource !== 'UNKNOWN'));

  if (finalScore >= 35 && hasStrongPositive && score > negativeScore) {
    classification = 'JOB';
    confidence = finalScore >= 60 ? 'HIGH' : 'MEDIUM';
  } else if (finalScore >= 40 && detectedSource === 'ATS') {
    classification = 'JOB';
    confidence = 'HIGH';
    if (detectedIntent === 'NOT_JOB') detectedIntent = 'APPLICATION';
  } else if (finalScore >= 40 && detectedSource === 'COMPANY_RECRUITING' && (detectedRole !== null || detectedIntent !== 'NOT_JOB')) {
    classification = 'JOB';
    confidence = 'HIGH';
    if (detectedIntent === 'NOT_JOB') detectedIntent = 'APPLICATION';
  } else if (finalScore >= 35 && detectedSource === 'JOB_BOARD' && detectedRole !== null && negativeScore === 0) {
    classification = 'JOB';
    confidence = 'MEDIUM';
    if (detectedIntent === 'NOT_JOB') detectedIntent = 'OTHER_JOB';
  } else if (finalScore >= 20 && (score > negativeScore) && (detectedSource === 'RECRUITER' || detectedIntent === 'RECRUITER' || detectedSource === 'PERSONAL')) {
    // Vague recruiter or user outbound follow-up without ATS
    if (detectedRole || detectedCompany || score >= 40) {
      classification = 'JOB';
      confidence = 'MEDIUM';
      if (detectedIntent === 'NOT_JOB') detectedIntent = 'RECRUITER';
    } else {
      // Vague without explicit role/company -> UNCERTAIN (never silently drop!)
      classification = 'UNCERTAIN';
      confidence = 'LOW';
      if (detectedIntent === 'NOT_JOB') detectedIntent = 'RECRUITER';
    }
  } else if (finalScore >= 15 && finalScore < 35 && score >= 25 && negativeScore <= 40) {
    // Borderline ambiguous emails
    classification = 'UNCERTAIN';
    confidence = 'LOW';
    if (detectedIntent === 'NOT_JOB') detectedIntent = 'OTHER_JOB';
  } else {
    classification = 'NOT_JOB';
    detectedIntent = 'NOT_JOB';
    confidence = negativeScore >= 50 ? 'HIGH' : 'MEDIUM';
  }

  const requiresAttention =
    classification === 'JOB' &&
    (detectedIntent === 'INTERVIEW' ||
      detectedIntent === 'INTERVIEW_SCHEDULE' ||
      detectedIntent === 'OFFER' ||
      detectedIntent === 'ASSESSMENT');

  return {
    classification,
    category: detectedIntent,
    source: detectedSource,
    confidence,
    score: Math.max(0, finalScore),
    requiresAttention,
    company: detectedCompany,
    role: detectedRole,
    platform: detectedPlatform,
    evidence,
  };
}
