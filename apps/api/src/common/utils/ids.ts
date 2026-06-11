import { randomBytes, randomInt } from 'crypto';

export function generateOrderNumber(): string {
  const now = new Date();
  const ymd = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(
    now.getDate(),
  ).padStart(2, '0')}`;
  return `SB${ymd}-${randomBytes(3).toString('hex').toUpperCase()}`;
}

export function generateNumericCode(length = 6): string {
  let code = '';
  for (let i = 0; i < length; i++) code += String(randomInt(0, 10));
  return code;
}

export function generateToken(bytes = 32): string {
  return randomBytes(bytes).toString('hex');
}
