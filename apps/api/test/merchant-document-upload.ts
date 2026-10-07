/** Local-only contract check for private merchant document upload/download. */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const API_URL = process.env.API_URL || 'http://127.0.0.1:3001/api';
const SHOP_NAME = process.env.TEST_MERCHANT_SHOP || 'Local QA Shop';

async function jsonRequest(path: string, init: RequestInit = {}) {
  const response = await fetch(`${API_URL}${path}`, init);
  const data = await response.json().catch(() => null);
  return { response, data };
}

async function main() {
  if (process.env.CONFIRM_LOCAL_TEST_DATA !== '1' || !['127.0.0.1', 'localhost'].includes(new URL(API_URL).hostname)) {
    throw new Error('This document check is restricted to an explicitly confirmed local API.');
  }
  const merchant = await prisma.merchant.findFirst({
    where: { shopName: SHOP_NAME },
    include: { user: { select: { id: true, phoneNumber: true } } },
  });
  if (!merchant) throw new Error(`Merchant '${SHOP_NAME}' was not found.`);
  const ownerPhone = merchant.user.phoneNumber || '+923019999904';
  if (!merchant.user.phoneNumber) {
    await prisma.user.update({ where: { id: merchant.user.id }, data: { phoneNumber: ownerPhone, isPhoneVerified: true } });
  }

  await jsonRequest('/auth/send-otp', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ phoneNumber: ownerPhone }),
  });
  const login = await jsonRequest('/auth/verify-otp', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ phoneNumber: ownerPhone, code: '123456', context: 'merchant' }),
  });
  if (!login.response.ok || !login.data?.accessToken) throw new Error(`Merchant login failed (${login.response.status}).`);
  const authorization = `Bearer ${login.data.accessToken}`;

  const form = new FormData();
  form.append('documentType', 'OTHER');
  form.append('file', new Blob(['%PDF-1.4\n% Local QA merchant document\n%%EOF\n'], { type: 'application/pdf' }), 'local-qa.pdf');
  const upload = await jsonRequest('/merchant/documents/upload', { method: 'POST', headers: { authorization }, body: form });
  if (upload.response.status !== 201 || !upload.data?.id) {
    throw new Error(`Document upload failed (${upload.response.status}): ${JSON.stringify(upload.data)}`);
  }
  if (!String(upload.data.documentUrl).startsWith('/api/merchant/documents/')) {
    throw new Error('Document was not assigned a protected merchant URL.');
  }

  const unauthenticated = await fetch(`${API_URL}/merchant/documents/${upload.data.id}/file`);
  if (unauthenticated.status !== 401) throw new Error(`Unauthenticated download returned ${unauthenticated.status}, expected 401.`);
  const downloaded = await fetch(`${API_URL}/merchant/documents/${upload.data.id}/file`, { headers: { authorization } });
  if (downloaded.status !== 200 || !(await downloaded.text()).startsWith('%PDF-1.4')) {
    throw new Error('Authenticated document download did not return the uploaded PDF.');
  }

  const invalidForm = new FormData();
  invalidForm.append('documentType', 'OTHER');
  invalidForm.append('file', new Blob(['not allowed'], { type: 'text/plain' }), 'invalid.txt');
  const invalid = await jsonRequest('/merchant/documents/upload', { method: 'POST', headers: { authorization }, body: invalidForm });
  if (invalid.response.status !== 400) throw new Error(`Invalid file returned ${invalid.response.status}, expected 400.`);

  const unsafeLegacyUrl = await jsonRequest('/merchant/documents', {
    method: 'POST',
    headers: { authorization, 'content-type': 'application/json' },
    body: JSON.stringify({ documentType: 'OTHER', documentUrl: 'javascript:alert(1)' }),
  });
  if (unsafeLegacyUrl.response.status !== 400) {
    throw new Error(`Unsafe legacy URL returned ${unsafeLegacyUrl.response.status}, expected 400.`);
  }

  console.log(`PASS document ${upload.data.id}: upload 201, protected read 200, anonymous read 401, invalid type/URL 400.`);
}

main()
  .catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
