import { evaluateEmailEvidence, EvidenceEngineResult } from './evidence-engine';
import { ClassificationResult, EmailClassificationInput } from '../ai/types';

export { evaluateEmailEvidence };
export type { EvidenceEngineResult };

/**
 * Deterministic classifier: 100% explainable, zero AI/LLM.
 * Evaluates sender, subject, body, links, ATS platforms, roles, and weighted negative evidence.
 */
export async function classifyEmail(input: EmailClassificationInput): Promise<ClassificationResult & {
  classification: 'JOB' | 'UNCERTAIN' | 'NOT_JOB';
  source: string;
  score: number;
  evidence: Array<{ type: string; reason: string; weight: number }>;
}> {
  const result = evaluateEmailEvidence({
    sender: input.sender,
    senderEmail: input.senderEmail,
    subject: input.subject,
    snippet: input.snippet,
    bodyText: input.bodyText,
    links: input.links,
  });

  return {
    isJobRelated: result.classification === 'JOB' || result.classification === 'UNCERTAIN',
    classification: result.classification,
    category: result.category === 'NOT_JOB' ? 'NOT_JOB_RELATED' : (result.category as any),
    source: result.source,
    company: result.company,
    role: result.role,
    platform: result.platform || 'Unknown',
    requiresAttention: result.requiresAttention,
    confidence: result.confidence === 'HIGH' ? 0.95 : result.confidence === 'MEDIUM' ? 0.8 : 0.5,
    score: result.score,
    evidence: result.evidence,
  };
}

/**
 * Backward compatibility helper: checks if email is definitely non-job.
 * Note: Negative signals are never an irreversible early discard in the sync pipeline.
 */
export function isDefinitelyNonJob(sender: string, senderEmail: string, subject: string): boolean {
  const result = evaluateEmailEvidence({
    sender,
    senderEmail,
    subject,
  });
  return result.classification === 'NOT_JOB' && result.score === 0;
}

export function getNonJobReason(sender: string, senderEmail: string, subject: string): string | null {
  const result = evaluateEmailEvidence({
    sender,
    senderEmail,
    subject,
  });
  if (result.classification === 'NOT_JOB') {
    const neg = result.evidence.find(e => e.weight < 0);
    return neg ? neg.type : 'non_job';
  }
  return null;
}
