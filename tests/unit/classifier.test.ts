import { describe, it, expect } from 'vitest';
import { isDefinitelyNonJob, classifyEmail } from '@/lib/email/classifier';

describe('Two-Tier Classifier (Deterministic + AI)', () => {
  describe('Deterministic Pre-filter', () => {
    it('identifies shopping receipts and shipping notifications as non-job', () => {
      expect(isDefinitelyNonJob('Amazon.com', 'auto-confirm@amazon.com', 'Your order has shipped')).toBe(true);
      expect(isDefinitelyNonJob('Netflix', 'notification@netflix.com', 'Streaming now on Netflix')).toBe(true);
      expect(isDefinitelyNonJob('Chase', 'do-not-reply@chase.com', 'Your statement is ready')).toBe(true);
    });

    it('lets candidate job emails pass through to the AI classifier', () => {
      expect(isDefinitelyNonJob('Acme Recruiting', 'recruiting@acme.com', 'Interview invitation — Senior Frontend Engineer')).toBe(false);
      expect(isDefinitelyNonJob('Google Careers', 'jobs-noreply@google.com', 'Your application status')).toBe(false);
      expect(isDefinitelyNonJob('Razorpay Talent', 'careers@razorpay.com', 'Application received — Software Engineer II')).toBe(false);
    });
  });

  describe('Full Classification Pipeline', () => {
    it('accurately classifies an interview invitation', async () => {
      const result = await classifyEmail({
        sender: 'Acme Recruiting',
        senderEmail: 'recruiting@acme.com',
        subject: 'Interview invitation — Senior Frontend Engineer',
        snippet: 'Hi John, we would love to invite you to schedule your technical interview.',
        bodyText: 'Please pick a time using Greenhouse: https://boards.greenhouse.io/acme/123',
        links: ['https://boards.greenhouse.io/acme/123'],
      });

      expect(result.isJobRelated).toBe(true);
      expect(result.category).toBe('INTERVIEW');
      expect(result.company).toBe('Acme');
      expect(result.role).toBe('Senior Frontend Engineer');
      expect(result.platform).toBe('Greenhouse');
      expect(result.requiresAttention).toBe(true);
      expect(result.confidence).toBeGreaterThanOrEqual(0.9);
    });

    it('immediately rejects definite non-job emails without error', async () => {
      const result = await classifyEmail({
        sender: 'Amazon.com',
        senderEmail: 'auto-confirm@amazon.com',
        subject: 'Your order of USB-C cable has shipped',
        snippet: 'Track your package with tracking number 123456.',
      });

      expect(result.isJobRelated).toBe(false);
      expect(result.category).toBe('NOT_JOB_RELATED');
      expect(result.requiresAttention).toBe(false);
    });
  });
});
