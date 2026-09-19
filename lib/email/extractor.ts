import { extractDomainFromEmail } from './normalizer';

const PLATFORM_PATTERNS: Array<{ name: string; matchers: RegExp[] }> = [
  {
    name: 'Greenhouse',
    matchers: [/greenhouse\.io/i, /gh_jid=/i, /boards\.greenhouse/i],
  },
  {
    name: 'Lever',
    matchers: [/lever\.co/i, /jobs\.lever/i],
  },
  {
    name: 'Workday',
    matchers: [/myworkdayjobs\.com/i, /workday\.com/i, /myworkday/i],
  },
  {
    name: 'Ashby',
    matchers: [/ashbyhq\.com/i, /jobs\.ashby/i],
  },
  {
    name: 'SmartRecruiters',
    matchers: [/smartrecruiters\.com/i, /smrtr\.io/i],
  },
  {
    name: 'LinkedIn',
    matchers: [/linkedin\.com\/jobs/i, /linkedin\.com\/comm\/jobs/i, /linkedin\.com/i],
  },
  {
    name: 'Naukri',
    matchers: [/naukri\.com/i, /naukri/i],
  },
  {
    name: 'Indeed',
    matchers: [/indeed\.com/i, /indeedemail\.com/i],
  },
  {
    name: 'Google Careers',
    matchers: [/google\.com\/about\/careers/i, /jobs-noreply@google\.com/i],
  }
];

export function detectPlatform(textToScan: string, links: string[] = []): string {
  const combined = `${textToScan} ${links.join(' ')}`;

  for (const p of PLATFORM_PATTERNS) {
    for (const regex of p.matchers) {
      if (regex.test(combined)) {
        return p.name;
      }
    }
  }

  return 'Unknown';
}

const COMMON_NON_COMPANY_DOMAINS = new Set([
  'gmail.com',
  'googlemail.com',
  'outlook.com',
  'hotmail.com',
  'yahoo.com',
  'icloud.com',
  'protonmail.com',
  'mail.com',
  'greenhouse.io',
  'lever.co',
  'ashbyhq.com',
  'smartrecruiters.com',
  'myworkdayjobs.com',
  'workday.com',
  'naukri.com',
  'indeed.com',
  'linkedin.com',
]);

export function extractCompany(
  senderName: string,
  senderEmail: string,
  subject: string,
  body: string
): string | null {
  const GENERIC_HR_WORDS = new Set([
    'talent', 'recruiting', 'careers', 'team', 'staffing', 'people', 'hiring', 'hr', 'jobs', 'global talent', 'the'
  ]);

  // 1. Check sender name patterns, e.g. "Acme Recruiting", "Stripe Talent", "Uber Careers", "Razorpay Talent Acquisition"
  if (senderName) {
    const cleanedSender = senderName.replace(/["']/g, '').trim();
    const senderSuffixMatch = cleanedSender.match(/^([^—–\-|]+?)\s+(?:Recruiting|Careers|Talent(?:\s+Acquisition)?|Team|HR|People(?:\s+Team)?|Staffing)$/i);
    if (senderSuffixMatch && senderSuffixMatch[1].length > 1) {
      const candidate = senderSuffixMatch[1].trim();
      if (!GENERIC_HR_WORDS.has(candidate.toLowerCase())) {
        return candidate;
      }
    }
  }

  // 2. Check subject patterns, e.g. "Acme: Interview invitation", "Your application to Acme", "Acme — Senior Engineer", "Role at Company"
  const subjectPatterns = [
    /(?:application|referral\s+request|interview|role|position)\s*(?:to|at|for|with)\s+([A-Z0-9][A-Za-z0-9\s&.]+?)(?:\s+for|\s+—|\s+-|\s+is|\s+has|$)/i,
    /(?:at|with)\s+([A-Z0-9][A-Za-z0-9\s&.]{1,30}?)(?:\s*(?:—|-|\||\(|$))/i,
    /^([A-Z0-9][A-Za-z0-9&.\s]{1,30}?)\s*(?:—|-|\|)\s*(?:Interview|Application|Update|Offer|Invitation|Software|Frontend|Backend)/i,
    /-\s*([A-Z0-9][A-Za-z0-9\s&.]{1,30}?)\s*-\s*(?:Software|Frontend|Backend|Engineer|Developer)/i,
  ];

  for (const pattern of subjectPatterns) {
    const match = subject.match(pattern);
    if (match && match[1]) {
      const cand = match[1].trim();
      if (!['Your', 'The', 'New', 'Job', 'Update', 'Career', 'Notification'].includes(cand)) {
        return cand;
      }
    }
  }

  // 3. Sender domain (if not a generic mail provider or ATS domain)
  const domain = extractDomainFromEmail(senderEmail);
  if (domain && !COMMON_NON_COMPANY_DOMAINS.has(domain)) {
    const domainParts = domain.split('.');
    if (domainParts.length >= 2) {
      const companyPart = domainParts[domainParts.length - 2];
      // Capitalize first letter
      if (companyPart && companyPart.length > 2 && !['careers', 'mail', 'email', 'recruiting', 'postoffice'].includes(companyPart.toLowerCase())) {
        return companyPart.charAt(0).toUpperCase() + companyPart.slice(1);
      }
    }
  }

  // Fallback: If we cannot confidently determine company, return null (never invent)
  return null;
}

export function extractRole(subject: string, body: string): string | null {
  // 1. Look for patterns in subject:
  const subjectPatterns = [
    /(?:invitation|received|status|update|assessment|offer(?:\s+of\s+employment)?|request:?)\s*(?:—|-|:)\s*([A-Za-z0-9\s/+#&.,]+?)(?:\s*(?:at|with|—|-|\||\(|$))/i,
    /(?:position|role|posting\s*-)\s*([A-Za-z0-9\s/+#&.,]+?)(?:\s*(?:at|with|—|-|\||\(|$))/i,
    /for\s+the\s+([A-Za-z0-9\s/+#&]+?\s*(?:Engineer|Developer|Manager|Designer|Architect|Lead|Scientist|Specialist|Analyst|Consultant|Associate|Intern|Director|VP))\s+(?:position|role|opportunity|at)/i,
    /\b((?:Senior\s+|Staff\s+|Principal\s+|Lead\s+)?(?:Software\s+Dev(?:elopment)?\s+Engineer|Software\s+Engineer|Frontend\s+Engineer|Backend\s+Engineer|Full\s*Stack\s+Engineer|Frontend\s+Developer|Backend\s+Developer)(?:\s+(?:I{1,3}|IV|V|\d))?)/i,
  ];

  for (const p of subjectPatterns) {
    const match = subject.match(p);
    if (match && match[1]) {
      const candidate = match[1].trim();
      if (candidate.length > 3 && candidate.length < 70) {
        return candidate;
      }
    }
  }

  // 2. Look for role phrases in body text
  const bodyRoleMatch = body.match(/(?:applying for|position of|role of|position as)\s+(?:the\s+)?([A-Za-z0-9\s/+#&]{3,50}?(?:Engineer|Developer|Manager|Designer|Architect|Lead|Scientist|Specialist|Analyst|Consultant|Associate|Intern))/i);
  if (bodyRoleMatch && bodyRoleMatch[1]) {
    return bodyRoleMatch[1].trim();
  }

  return null;
}
