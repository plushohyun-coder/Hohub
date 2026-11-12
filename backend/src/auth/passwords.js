const crypto = require('crypto');
const argon2 = require('argon2');

// OWASP-recommended Argon2id settings.
const OPTIONS = Object.freeze({ type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 });
const DUMMY_SECRET_BYTES = 32;

const hashPassword = (password) => argon2.hash(password, OPTIONS);

// Hash of a random secret, used so unknown users cost the same Argon2 work as real ones.
let dummyHashPromise;
const dummyHash = () => {
  dummyHashPromise ??= argon2.hash(crypto.randomBytes(DUMMY_SECRET_BYTES).toString('hex'), OPTIONS);
  return dummyHashPromise;
};

// Always runs exactly one Argon2 verification. A missing hash never matches.
const verifyPassword = async (storedHash, password) => {
  const candidate = String(password ?? '');
  if (typeof storedHash !== 'string' || storedHash === '') {
    await argon2.verify(await dummyHash(), candidate).catch(() => false);
    return false;
  }
  try {
    return await argon2.verify(storedHash, candidate);
  } catch {
    return false;
  }
};

module.exports = { hashPassword, verifyPassword };
