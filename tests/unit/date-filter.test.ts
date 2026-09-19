import { describe, it, expect } from 'vitest';
import { parseDateRangeBoundaries, repository } from '@/lib/db/repository';

describe('Date Boundary Filtering (Spec Section 14, 52)', () => {
  it('correctly sets UTC boundaries for start of fromDate and end of toDate', () => {
    const { fromDate, toDate } = parseDateRangeBoundaries('2026-09-05', '2026-09-10');
    
    expect(fromDate).toBeDefined();
    expect(toDate).toBeDefined();

    // From date starts at 00:00:00.000
    expect(fromDate?.toISOString()).toBe('2026-09-05T00:00:00.000Z');

    // To date includes the entire day up to 23:59:59.999
    expect(toDate?.toISOString()).toBe('2026-09-10T23:59:59.999Z');
  });

  it('filters Sep 1, Sep 5, Sep 10, Sep 15 with range Sep 5 -> Sep 10 and returns ONLY Sep 5 and Sep 10', async () => {
    const userId = 'usr_date_test';

    // Create a temporary email account for foreign key relation
    const account = await repository.createEmailAccount({
      userId,
      provider: 'gmail',
      email: `test_date_${Date.now()}@example.com`,
      providerAccountId: `test_date_${Date.now()}`,
      encryptedAccessToken: 'mock_test_token',
      status: 'IDLE',
    });

    try {
      // Insert 4 test emails: Sep 1, Sep 5, Sep 10, Sep 15
      await repository.saveBatchEmails([
        {
          userId,
          emailAccountId: account.id,
          providerMessageId: 'msg_sep_1',
          sender: 'Test Sender 1',
          senderEmail: 'test1@example.com',
          subject: 'Job Email Sep 1',
          receivedAt: new Date('2026-09-01T14:30:00.000Z'),
          category: 'APPLICATION',
          classification: 'JOB',
          deterministicClassification: 'JOB',
          isJobRelated: true,
        },
        {
          userId,
          emailAccountId: account.id,
          providerMessageId: 'msg_sep_5',
          sender: 'Test Sender 5',
          senderEmail: 'test5@example.com',
          subject: 'Job Email Sep 5',
          receivedAt: new Date('2026-09-05T09:00:00.000Z'),
          category: 'INTERVIEW',
          classification: 'JOB',
          deterministicClassification: 'JOB',
          isJobRelated: true,
        },
        {
          userId,
          emailAccountId: account.id,
          providerMessageId: 'msg_sep_10',
          sender: 'Test Sender 10',
          senderEmail: 'test10@example.com',
          subject: 'Job Email Sep 10',
          receivedAt: new Date('2026-09-10T22:45:00.000Z'),
          category: 'ASSESSMENT',
          classification: 'JOB',
          deterministicClassification: 'JOB',
          isJobRelated: true,
        },
        {
          userId,
          emailAccountId: account.id,
          providerMessageId: 'msg_sep_15',
          sender: 'Test Sender 15',
          senderEmail: 'test15@example.com',
          subject: 'Job Email Sep 15',
          receivedAt: new Date('2026-09-15T11:20:00.000Z'),
          category: 'OFFER',
          classification: 'JOB',
          deterministicClassification: 'JOB',
          isJobRelated: true,
        },
      ]);

      // Query with filter: from = 2026-09-05, to = 2026-09-10
      const result = await repository.getEmails({
        userId,
        from: '2026-09-05',
        to: '2026-09-10',
      });

      // Verify: Only Sep 5 and Sep 10 are returned
      expect(result.total).toBe(2);
      expect(result.emails.map(e => e.providerMessageId).sort()).toEqual(['msg_sep_10', 'msg_sep_5']);

      // Verify Sep 1 and Sep 15 are excluded
      const messageIds = result.emails.map(e => e.providerMessageId);
      expect(messageIds).not.toContain('msg_sep_1');
      expect(messageIds).not.toContain('msg_sep_15');
    } finally {
      // Clean up test account (cascades emails in Postgres)
      await repository.deleteEmailAccount(account.id, userId);
    }
  });
});
