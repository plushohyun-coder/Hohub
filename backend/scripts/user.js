#!/usr/bin/env node
// Manage Hohub login accounts.
//   npm run user -- add <username> --name "Full Name" --email a@b.com --role ACCOUNTANT
//   npm run user -- disable <username>
//   npm run user -- enable <username>
// "add" asks for the password (hidden). To script it, pipe it in: printf '%s' "$PW" | npm run user -- add ...
// Running "add" for an existing username resets that user's details and password and ends their sessions.
const readline = require('readline');
const dotenv = require('dotenv');

dotenv.config();

const { config } = require('../src/config');
const { Role } = require('../src/constants');
const { hashPassword } = require('../src/auth/passwords');
const { AuthRepository } = require('../src/auth/authRepository');

const USAGE = 'usage: user add <username> --name <full name> --email <email> --role <ADMIN|ACCOUNTANT|APPROVER|VIEWER>\n       user disable|enable <username>';
const USERNAME_PATTERN = /^[A-Za-z0-9._-]{3,100}$/;
const EMAIL_PATTERN = /^[^\s@]{1,64}@[^\s@]{1,190}$/;

const fail = (message) => {
  console.error(message);
  process.exit(2);
};

const parseOptions = (args) => {
  const options = {};
  for (let i = 0; i < args.length; i += 2) {
    if (!args[i].startsWith('--') || args[i + 1] === undefined) fail(USAGE);
    options[args[i].slice(2)] = args[i + 1];
  }
  return options;
};

// Reads the password without echoing it on a terminal, or from a pipe.
const readPassword = (prompt) =>
  new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: process.stdin.isTTY });
    if (process.stdin.isTTY) {
      process.stdout.write(prompt);
      rl._writeToOutput = () => {};
    }
    let value = '';
    rl.on('line', (line) => {
      value = line;
      rl.close();
    });
    rl.on('close', () => {
      if (process.stdin.isTTY) process.stdout.write('\n');
      resolve(value);
    });
  });

const checkPassword = (password, username) => {
  const { minPasswordLength, maxPasswordLength } = config.auth;
  if (password.length < minPasswordLength || password.length > maxPasswordLength) {
    fail(`password must be ${minPasswordLength}-${maxPasswordLength} characters`);
  }
  if (password.toLowerCase().includes(username.toLowerCase())) fail('password must not contain the username');
};

const main = async () => {
  const [command, username, ...rest] = process.argv.slice(2);
  if (!command || !username || !USERNAME_PATTERN.test(username)) fail(USAGE);

  const { pool } = require('../src/config/db');
  if (!pool) fail('DATABASE_URL is not set');
  const repository = new AuthRepository(pool);

  try {
    if (command === 'add') {
      const { name, email, role } = parseOptions(rest);
      if (!name || !email || !EMAIL_PATTERN.test(email) || !Object.values(Role).includes(role)) fail(USAGE);
      const password = await readPassword('Password: ');
      checkPassword(password, username);
      const result = await repository.upsertUser({ username, fullName: name, email, role, passwordHash: await hashPassword(password) });
      console.log(result.created ? `created ${username} (${role})` : `updated ${username} (${role}); their sessions were ended`);
    } else if (command === 'disable' || command === 'enable') {
      if (!(await repository.setActive(username, command === 'enable'))) fail(`no such user: ${username}`);
      console.log(`${command}d ${username}`);
    } else {
      fail(USAGE);
    }
  } finally {
    await pool.end();
  }
};

main().catch((error) => {
  console.error('user command failed:', error.message);
  process.exit(1);
});
