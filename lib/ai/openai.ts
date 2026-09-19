import { AIClassifierProvider } from './provider';
import { EmailClassificationInput, ClassificationResult, ClassificationResultSchema } from './types';
import { detectPlatform, extractCompany, extractRole } from '../email/extractor';

export class OpenAIClassifierProvider implements AIClassifierProvider {
  name = 'openai';
  private apiKey: string;
  private model: string;

  constructor(apiKey?: string, model: string = 'gpt-4o-mini') {
    this.apiKey = apiKey || process.env.OPENAI_API_KEY || '';
    this.model = process.env.OPENAI_MODEL || model;
  }

  async classifyEmail(input: EmailClassificationInput): Promise<ClassificationResult> {
    if (!this.apiKey) {
      throw new Error('OpenAI API key is missing');
    }

    const detectedPlatform = detectPlatform(`${input.snippet} ${input.bodyText || ''}`, input.links || []);
    const candidateCompany = extractCompany(input.sender, input.senderEmail, input.subject, input.bodyText || input.snippet);
    const candidateRole = extractRole(input.subject, input.bodyText || input.snippet);

    const systemPrompt = `You are a precision email classifier for a job-email aggregator.
Classify if this email is job-related and categorize it accurately.

Valid Categories:
- APPLICATION: General job application or confirmation
- APPLICATION_RECEIVED: Formal acknowledgement of application receipt
- RECRUITER: Direct message or reachout from a recruiter/talent acquisition
- ASSESSMENT: Coding challenges, HackerRank/CoderPad tests, questionnaires
- INTERVIEW: Interview invitation or confirmation
- INTERVIEW_SCHEDULE: Scheduling request / calendly / time slot picking
- REJECTION: Candidate rejection or "moving forward with others"
- OFFER: Job offer or compensation discussion
- FOLLOW_UP: Recruiter or candidate check-in / follow-up
- OTHER_JOB: Any other job-related communication
- NOT_JOB_RELATED: Marketing, spam, non-job newsletters, shopping receipts, etc.

Rules:
1. company: Extract company name only if reliable. If uncertain, return null. Never invent.
2. role: Extract role/title only if available. If unavailable, return null. Never guess.
3. platform: Return platform if evidence exists (e.g. Greenhouse, Lever, Workday, Ashby, LinkedIn, Naukri, Indeed), otherwise "Unknown".
4. requiresAttention: true for interview invites, scheduling requests, assessments, offers, or direct questions requiring response.

Respond ONLY with valid JSON matching this schema:
{
  "isJobRelated": boolean,
  "category": string,
  "company": string | null,
  "role": string | null,
  "platform": string,
  "requiresAttention": boolean,
  "confidence": number
}`;

    const userContent = `Subject: ${input.subject}
From: ${input.sender} <${input.senderEmail}>
Pre-detected hints:
- Platform: ${detectedPlatform}
- Company: ${candidateCompany || 'None'}
- Role: ${candidateRole || 'None'}
Snippet: ${input.snippet}
Body:
${(input.bodyText || '').substring(0, 2000)}`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`OpenAI classification failed (${response.status}): ${errText}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('Empty response from OpenAI');
    }

    const parsedJson = JSON.parse(content);
    return ClassificationResultSchema.parse(parsedJson);
  }
}
