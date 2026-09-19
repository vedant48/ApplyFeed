import { describe, it, expect } from 'vitest';
import { detectPlatform, extractCompany, extractRole } from '@/lib/email/extractor';

describe('Metadata Extractor (Platform, Company, Role)', () => {
  describe('detectPlatform', () => {
    it('detects Greenhouse from links and body', () => {
      expect(detectPlatform('Thank you for applying', ['https://boards.greenhouse.io/acme/123'])).toBe('Greenhouse');
      expect(detectPlatform('View candidate at greenhouse.io/jobs')).toBe('Greenhouse');
    });

    it('detects Lever, Workday, Ashby, Naukri, Indeed', () => {
      expect(detectPlatform('', ['https://jobs.lever.co/company/456'])).toBe('Lever');
      expect(detectPlatform('Check myworkdayjobs.com/portal')).toBe('Workday');
      expect(detectPlatform('Ashby job board', ['https://jobs.ashbyhq.com/org'])).toBe('Ashby');
      expect(detectPlatform('Applied via naukri.com')).toBe('Naukri');
      expect(detectPlatform('Indeed application message', ['https://indeed.com/m/123'])).toBe('Indeed');
    });

    it('returns "Unknown" when no reliable evidence exists', () => {
      expect(detectPlatform('General email content without platform links')).toBe('Unknown');
    });
  });

  describe('extractCompany', () => {
    it('extracts company from sender suffix like "Acme Recruiting"', () => {
      expect(extractCompany('Acme Recruiting', 'noreply@greenhouse.io', 'Interview invitation', '')).toBe('Acme');
      expect(extractCompany('Razorpay Talent Acquisition', 'careers@razorpay.com', 'Application received', '')).toBe('Razorpay');
    });

    it('extracts company from domain when sender name is not structured', () => {
      expect(extractCompany('Talent Team', 'recruiting@stripe.com', 'Interview invitation', '')).toBe('Stripe');
    });

    it('returns null if uncertain and never invents', () => {
      expect(extractCompany('John Doe', 'john@gmail.com', 'Catch up tomorrow', '')).toBeNull();
    });
  });

  describe('extractRole', () => {
    it('extracts role from subject lines with separators', () => {
      expect(extractRole('Interview invitation — Senior Frontend Engineer', '')).toBe('Senior Frontend Engineer');
      expect(extractRole('Application received — Software Engineer II', '')).toBe('Software Engineer II');
      expect(extractRole('Offer of Employment — Full Stack Engineer', '')).toBe('Full Stack Engineer');
    });

    it('returns null when role is not detectable', () => {
      expect(extractRole('Your application status', 'We are reviewing.')).toBeNull();
    });
  });
});
