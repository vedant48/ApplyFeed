import { describe, it, expect } from 'vitest';
import { evaluateEmailEvidence } from '@/lib/email/evidence-engine';

describe('Deterministic Evidence Engine (Zero AI/LLM)', () => {
  describe('Requirement 12: The 5 Audited Missing Emails', () => {
    it('1. Swiggy application confirmation is classified as JOB', () => {
      const result = evaluateEmailEvidence({
        sender: 'SWIGGY',
        senderEmail: 'notification@careers.swiggy.in',
        subject: 'Welcome! Your Application for Software Dev Engineer II at SWIGGY is Received',
        snippet: 'Dear Vedant, Thank you for applying for the Software Dev Engineer II position at SWIGGY. WHAT\'S NEXT? Please provide additional information...',
        bodyText: 'Dear Vedant, Thank you for applying for the Software Dev Engineer II position at SWIGGY. WHAT\'S NEXT? Please provide additional information as part of your application.',
        links: ['https://link.careers.swiggy.in/c/eJxsjzFr6zAURn9NtMlIV7IlDxrCS-AFHq-lpEOncKUruYJYNrZr1'],
      });

      expect(result.classification).toBe('JOB');
      expect(result.category).toBe('APPLICATION_RECEIVED');
      expect(result.source).toBe('COMPANY_RECRUITING');
      expect(result.company?.toLowerCase()).toContain('swiggy');
      expect(result.role?.toLowerCase()).toContain('software dev engineer');
    });

    it('2. Amazon application status update is classified as JOB', () => {
      const result = evaluateEmailEvidence({
        sender: 'noreply@mail.amazon.jobs',
        senderEmail: 'noreply@mail.amazon.jobs',
        subject: 'Amazon application: Status update',
        snippet: 'Amazon.jobs Hi Vedant, Thank you for your application for the position of Software Dev Engineer II, Amazon Leo Commerce (ID: 10503915). After careful...',
        bodyText: 'Amazon.jobs Hi Vedant, Thank you for your application for the position of Software Dev Engineer II, Amazon Leo Commerce (ID: 10503915). After careful consideration, we will not be moving forward with your application at this time.',
        links: ['https://www.amazon.jobs/en/applicant'],
      });

      expect(result.classification).toBe('JOB');
      expect(result.source).toBe('COMPANY_RECRUITING');
      expect(result.company).toBe('Amazon');
      expect(['REJECTION', 'APPLICATION', 'FOLLOW_UP']).toContain(result.category);
    });

    it('3. Amazon keep-track application email is classified as JOB', () => {
      const result = evaluateEmailEvidence({
        sender: 'noreply@mail.amazon.jobs',
        senderEmail: 'noreply@mail.amazon.jobs',
        subject: 'Keep track of your application',
        snippet: 'Amazon.jobs Hi Vedant, Thank you for your interest in Software Dev Engineer II, Amazon Leo Commerce (ID: 10503915). If you have completed the application...',
        bodyText: 'Amazon.jobs Hi Vedant, Thank you for your interest in Software Dev Engineer II, Amazon Leo Commerce (ID: 10503915). If you have completed the application, please log into your candidate dashboard to track status.',
        links: ['https://www.amazon.jobs/en/dashboard'],
      });

      expect(result.classification).toBe('JOB');
      expect(result.source).toBe('COMPANY_RECRUITING');
      expect(result.company).toBe('Amazon');
      expect(result.role?.toLowerCase()).toContain('software dev engineer');
    });

    it('4. Headout outbound referral follow-up email is classified as JOB or UNCERTAIN', () => {
      const result = evaluateEmailEvidence({
        sender: 'vedantkumar48@gmail.com',
        senderEmail: 'vedantkumar48@gmail.com',
        subject: 'Re: Application Referral Request: Software Engineer, Web at Headout',
        snippet: 'Hi Aditya Shandilya, following up to see if you had a moment to go through my earlier message on Application Referral Request: Software Engineer, Web at Headout...',
        bodyText: 'Hi Aditya Shandilya, following up to see if you had a moment to go through my earlier message on Application Referral Request: Software Engineer, Web at Headout. Would really appreciate your referral!',
      });

      // Must never be silently discarded as NOT_JOB
      expect(['JOB', 'UNCERTAIN']).toContain(result.classification);
      expect((result.company || '').toLowerCase()).toContain('headout');
      expect((result.role || '').toLowerCase()).toContain('software engineer');
    });

    it('5. Hirist job notification is classified as JOB', () => {
      const result = evaluateEmailEvidence({
        sender: 'hirist.tech',
        senderEmail: 'info@hirist.tech',
        subject: 'Unpublished Job Notification - Antino Labs - Software Development Engineer II - Frontend Architecture',
        snippet: 'Hello Vedant Kumar This is regarding your application for the posting - Antino Labs - Software Development Engineer II - Frontend Architecture...',
        bodyText: 'Hello Vedant Kumar This is regarding your application for the posting - Antino Labs - Software Development Engineer II - Frontend Architecture The company has shortlisted candidates.',
        links: ['http://postoffice.hirist.tech/CL0/hirist.tech%2Fapplied-jobs'],
      });

      expect(result.classification).toBe('JOB');
      expect(result.source).toBe('JOB_BOARD');
      expect(result.platform).toBe('Hirist');
      expect((result.role || '').toLowerCase()).toContain('software development engineer');
    });
  });

  describe('Requirement 13: Regression Matrix', () => {
    it('Amazon order is NOT_JOB (negative signal not overridden)', () => {
      const result = evaluateEmailEvidence({
        sender: 'Amazon.com',
        senderEmail: 'auto-confirm@amazon.com',
        subject: 'Your Amazon.com order has shipped',
        snippet: 'Your package containing USB-C Cable has shipped and will arrive tomorrow. Track your package here.',
        bodyText: 'Your package containing USB-C Cable has shipped and will arrive tomorrow. Total: $14.99.',
        links: ['https://www.amazon.com/gp/css/order-history'],
      });

      expect(result.classification).toBe('NOT_JOB');
      expect(result.category).toBe('NOT_JOB');
      expect(result.requiresAttention).toBe(false);
    });

    it('Amazon interview is JOB (strong positive overrides domain)', () => {
      const result = evaluateEmailEvidence({
        sender: 'Amazon Recruiting',
        senderEmail: 'recruiting@amazon.com',
        subject: 'Interview invitation — Software Development Engineer II',
        snippet: 'We would like to invite you to schedule your technical coding interview with our Alexa Shopping team.',
        bodyText: 'We would like to invite you to schedule your technical coding interview with our Alexa Shopping team. Please choose a slot.',
        links: ['https://amazon.chime.aws/interview/12345'],
      });

      expect(result.classification).toBe('JOB');
      expect(['INTERVIEW', 'INTERVIEW_SCHEDULE']).toContain(result.category);
      expect(result.company).toBe('Amazon');
      expect(result.requiresAttention).toBe(true);
    });

    it('Amazon application status is JOB', () => {
      const result = evaluateEmailEvidence({
        sender: 'Amazon Staffing',
        senderEmail: 'jobs-noreply@amazon.com',
        subject: 'Your Amazon application status update',
        snippet: 'Thank you for your interest in Software Development Engineer. We are reviewing your application.',
        bodyText: 'Thank you for your interest in Software Development Engineer. We are reviewing your application.',
        links: ['https://www.amazon.jobs/status'],
      });

      expect(result.classification).toBe('JOB');
      expect(['APPLICATION', 'APPLICATION_RECEIVED', 'FOLLOW_UP']).toContain(result.category);
    });

    it('LinkedIn connection notification is NOT_JOB', () => {
      const result = evaluateEmailEvidence({
        sender: 'LinkedIn',
        senderEmail: 'messages-noreply@linkedin.com',
        subject: 'John Doe sent you an invitation to connect',
        snippet: 'John Doe would like to connect on LinkedIn. View John\'s profile to accept.',
        bodyText: 'John Doe would like to connect on LinkedIn. View John\'s profile to accept.',
        links: ['https://www.linkedin.com/comm/mynetwork/invite-accept/123'],
      });

      expect(result.classification).toBe('NOT_JOB');
      expect(result.category).toBe('NOT_JOB');
    });

    it('LinkedIn job communication is JOB', () => {
      const result = evaluateEmailEvidence({
        sender: 'LinkedIn Job Applications',
        senderEmail: 'jobs-listings@linkedin.com',
        subject: 'Your application was viewed for Senior Frontend Developer at Spotify',
        snippet: 'Spotify viewed your application for Senior Frontend Developer submitted via LinkedIn Easy Apply.',
        bodyText: 'Spotify viewed your application for Senior Frontend Developer submitted via LinkedIn Easy Apply.',
        links: ['https://www.linkedin.com/jobs/tracker/applied/'],
      });

      expect(result.classification).toBe('JOB');
      expect(result.source).toBe('JOB_BOARD');
      expect(result.platform).toBe('LinkedIn');
    });

    it('Company marketing email is NOT_JOB', () => {
      const result = evaluateEmailEvidence({
        sender: 'Stripe',
        senderEmail: 'newsletter@stripe.com',
        subject: 'Stripe Sessions 2026: Announcing our keynote speakers and discounts',
        snippet: 'Join us at Stripe Sessions. Early bird registration is now open with 20% discount. Unsubscribe anytime.',
        bodyText: 'Join us at Stripe Sessions. Early bird registration is now open with 20% discount. Unsubscribe anytime.',
        links: ['https://stripe.com/sessions/register'],
      });

      expect(result.classification).toBe('NOT_JOB');
    });

    it('Company recruiter email without ATS is JOB or UNCERTAIN (Requirement 7 & 12)', () => {
      const result = evaluateEmailEvidence({
        sender: 'Jane Doe',
        senderEmail: 'recruiter@databricks.com',
        subject: 'Exciting opportunity at Databricks — Senior Distributed Systems Engineer',
        snippet: 'Hi Vedant, I lead engineering talent at Databricks. I came across your background and was impressed with your experience...',
        bodyText: 'Hi Vedant, I lead engineering talent at Databricks. I came across your background and was impressed with your experience. Would you be open for a quick 15-minute conversation about our infrastructure team?',
        links: [], // No ATS links!
      });

      expect(['JOB', 'UNCERTAIN']).toContain(result.classification);
      expect(result.company).toBe('Databricks');
      expect(result.role?.toLowerCase()).toContain('systems engineer');
      expect(result.evidence.length).toBeGreaterThan(0);
    });

    it('Vague recruiter email is UNCERTAIN and never silently discarded as NOT_JOB', () => {
      const result = evaluateEmailEvidence({
        sender: 'Sarah Miller',
        senderEmail: 'sarah.miller@hiring-apex.co',
        subject: 'Quick chat regarding your background',
        snippet: 'Hi Vedant, I came across your profile and would love to connect this week. Are you free tomorrow?',
        bodyText: 'Hi Vedant, I came across your profile and would love to connect this week. Are you free tomorrow? Let me know your availability.',
      });

      expect(['UNCERTAIN', 'JOB']).toContain(result.classification);
      expect(result.classification).not.toBe('NOT_JOB');
    });

    it('Security OTP email is NOT_JOB', () => {
      const result = evaluateEmailEvidence({
        sender: 'Google Security',
        senderEmail: 'no-reply@accounts.google.com',
        subject: 'Your Google verification code is 482910',
        snippet: 'Use code 482910 to verify your Google account. Do not share this code with anyone.',
        bodyText: 'Use code 482910 to verify your Google account. Do not share this code with anyone.',
      });

      expect(result.classification).toBe('NOT_JOB');
    });
  });
});
