import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { GET as getEmailsHandler } from '@/app/api/emails/route';
import { GET as getEmailDetailHandler, PATCH as patchEmailHandler } from '@/app/api/emails/[id]/route';
import { GET as getAccountsHandler } from '@/app/api/email/accounts/route';

describe('API Route Handlers (Spec Section 50)', () => {
  it('GET /api/email/accounts returns sanitized accounts without exposing secret tokens', async () => {
    const req = new NextRequest('http://localhost:3000/api/email/accounts');
    const res = await getAccountsHandler(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(Array.isArray(data.accounts)).toBe(true);
    expect(data.accounts.length).toBeGreaterThanOrEqual(1);

    // Ensure tokens are NOT exposed
    for (const acc of data.accounts) {
      expect(acc.encryptedAccessToken).toBeUndefined();
      expect(acc.encryptedRefreshToken).toBeUndefined();
      expect(acc.email).toBeDefined();
      expect(acc.provider).toBeDefined();
    }
  });

  it('GET /api/emails supports composable search, category, needsAttention and pagination', async () => {
    // 1. All emails
    const req1 = new NextRequest('http://localhost:3000/api/emails?page=1&limit=10');
    const res1 = await getEmailsHandler(req1);
    expect(res1.status).toBe(200);
    const data1 = await res1.json();
    expect(data1.emails.length).toBeGreaterThan(0);
    expect(data1.total).toBeGreaterThanOrEqual(data1.emails.length);

    // 2. Search for "Frontend"
    const req2 = new NextRequest('http://localhost:3000/api/emails?search=Frontend');
    const res2 = await getEmailsHandler(req2);
    const data2 = await res2.json();
    expect(data2.emails.length).toBeGreaterThanOrEqual(1);
    expect(data2.emails.some((e: any) => e.company === 'Acme' || e.role?.includes('Frontend'))).toBe(true);

    // 3. Needs attention filter
    const req3 = new NextRequest('http://localhost:3000/api/emails?needsAttention=true');
    const res3 = await getEmailsHandler(req3);
    const data3 = await res3.json();
    for (const em of data3.emails) {
      expect(em.requiresAttention).toBe(true);
    }
  });

  it('GET /api/emails/[id] and PATCH /api/emails/[id] updates read status', async () => {
    const reqList = new NextRequest('http://localhost:3000/api/emails');
    const resList = await getEmailsHandler(reqList);
    const { emails } = await resList.json();
    const targetEmail = emails[0];

    // GET detail
    const params = Promise.resolve({ id: targetEmail.id });
    const reqDetail = new NextRequest(`http://localhost:3000/api/emails/${targetEmail.id}`);
    const resDetail = await getEmailDetailHandler(reqDetail, { params });
    expect(resDetail.status).toBe(200);
    const detailData = await resDetail.json();
    expect(detailData.email.id).toBe(targetEmail.id);
    expect(detailData.email.deepLink).toBeDefined();

    // PATCH isRead: true
    const reqPatch = new NextRequest(`http://localhost:3000/api/emails/${targetEmail.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ isRead: true }),
    });
    const resPatch = await patchEmailHandler(reqPatch, { params });
    expect(resPatch.status).toBe(200);
    const patchData = await resPatch.json();
    expect(patchData.email.isRead).toBe(true);
  });
});
