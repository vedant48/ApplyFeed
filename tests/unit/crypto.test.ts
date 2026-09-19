import { describe, it, expect } from 'vitest';
import { encryptToken, decryptToken } from '@/lib/crypto';

describe('Token Encryption & Decryption', () => {
  it('should encrypt and decrypt a token accurately', () => {
    const originalToken = 'ya29.a0AfH6SMAexample_google_oauth_token_12345';
    const encrypted = encryptToken(originalToken);
    
    expect(encrypted).not.toBe(originalToken);
    expect(encrypted.split(':')).toHaveLength(3);

    const decrypted = decryptToken(encrypted);
    expect(decrypted).toBe(originalToken);
  });

  it('should return empty string when empty input is provided', () => {
    expect(encryptToken('')).toBe('');
    expect(decryptToken('')).toBe('');
  });

  it('should throw an error for malformed encrypted data', () => {
    expect(() => decryptToken('invalid-format')).toThrow('Invalid encrypted token format');
  });
});
