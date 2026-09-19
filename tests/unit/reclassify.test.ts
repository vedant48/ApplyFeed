import { describe, it, expect } from 'vitest';
import postgres from 'postgres';
import dotenv from 'dotenv';
import { evaluateEmailEvidence } from '@/lib/email/evidence-engine';

dotenv.config({ path: '.env.local' });

describe('Explicit Reclassification of Existing Database Rows', () => {
  it('reclassifies all existing UNCLASSIFIED emails using Deterministic Evidence Engine', async () => {
    if (!process.env.DATABASE_URL) {
      console.log('Skipping live DB reclassification: DATABASE_URL not set');
      return;
    }

    const sql = postgres(process.env.DATABASE_URL);

    // Ensure we test the reclassification logic by inserting a test UNCLASSIFIED row if needed
    const testAccounts = await sql`SELECT id, user_id FROM email_accounts LIMIT 1`;
    let insertedId: string | null = null;
    
    if (testAccounts.length > 0) {
      const [inserted] = await sql`
        INSERT INTO emails (
          user_id, email_account_id, provider_message_id, sender, sender_email,
          subject, body_text, snippet, received_at, category, classification,
          deterministic_classification, is_job_related
        ) VALUES (
          ${testAccounts[0].user_id},
          ${testAccounts[0].id},
          ${'test_reclass_' + Date.now()},
          'Greenhouse Team',
          'no-reply@greenhouse.io',
          'Interview Invitation: Senior Software Engineer at Stripe',
          'Thank you for applying. We would like to invite you to schedule your technical interview: https://boards.greenhouse.io/stripe/interview',
          'Thank you for applying. We would like to invite you...',
          NOW(),
          'APPLICATION',
          'UNCLASSIFIED',
          'UNCLASSIFIED',
          true
        )
        RETURNING id
      `;
      insertedId = inserted.id;
    }

    const rows = await sql`
      SELECT id, sender, sender_email, subject, snippet, body_text, user_override, role, company, platform
      FROM emails
      WHERE classification = 'UNCLASSIFIED'
    `;

    console.log(`Reclassifying ${rows.length} UNCLASSIFIED database rows...`);

    let jobCount = 0;
    let uncertainCount = 0;
    let notJobCount = 0;

    for (const row of rows) {
      const result = evaluateEmailEvidence({
        sender: row.sender || '',
        senderEmail: row.sender_email || '',
        subject: row.subject || '',
        snippet: row.snippet || '',
        bodyText: row.body_text || row.snippet || '',
        links: [],
      });

      const effectiveClassification = row.user_override || result.classification;

      if (effectiveClassification === 'JOB') jobCount++;
      else if (effectiveClassification === 'UNCERTAIN') uncertainCount++;
      else notJobCount++;

      await sql`
        UPDATE emails
        SET
          deterministic_classification = ${result.classification},
          classification = ${effectiveClassification},
          source = ${result.source},
          category = ${result.category},
          score = ${result.score},
          confidence = ${result.confidence},
          evidence = ${JSON.stringify(result.evidence)},
          role = COALESCE(${result.role}, role),
          company = COALESCE(${result.company}, company),
          platform = COALESCE(${result.platform}, platform),
          requires_attention = ${result.requiresAttention},
          updated_at = NOW()
        WHERE id = ${row.id}
      `;
    }

    console.log(`Reclassification Complete:`);
    console.log(` - JOB: ${jobCount}`);
    console.log(` - UNCERTAIN: ${uncertainCount}`);
    console.log(` - NOT_JOB: ${notJobCount}`);

    // Verify no UNCLASSIFIED rows remain
    const unclassified = await sql`SELECT count(*) FROM emails WHERE classification = 'UNCLASSIFIED'`;
    expect(Number(unclassified[0].count)).toBe(0);

    // If we inserted a test row, verify it was reclassified to JOB and then clean up
    if (insertedId) {
      const [testRow] = await sql`SELECT classification FROM emails WHERE id = ${insertedId}`;
      expect(testRow.classification).toBe('JOB');
      await sql`DELETE FROM emails WHERE id = ${insertedId}`;
    }

    await sql.end();
  }, 20000);
});
