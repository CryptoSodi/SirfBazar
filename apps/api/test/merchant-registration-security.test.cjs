const assert = require('node:assert/strict');
const { test } = require('node:test');
const { AuthService } = require('../src/auth/auth.service.ts');

test('merchant registration cannot change an existing account before OTP verification', async () => {
  let writes = 0;
  const auth = Object.create(AuthService.prototype);
  auth.isMockOtp = true;
  auth.enforceOtpRequestLimit = async () => undefined;
  auth.prisma = { user: {
    findFirst: async () => ({ id: 'existing-customer', cnic: '1234512345671', merchant: null }),
    update: async () => { writes++; },
    create: async () => { writes++; },
  } };
  await assert.rejects(auth.startMerchantRegistration({
    firstName: 'Wrong', lastName: 'Person', channel: 'mobile', contact: '03001234567',
    cnic: '1234512345671', password: 'attacker-password',
  }), /account already uses these details/);
  assert.equal(writes, 0);
});
