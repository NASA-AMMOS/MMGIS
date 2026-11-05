const { rateLimit } = require("express-rate-limit");

const apilimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 3000, // limit each IP to 3000 requests per windowMs
});

// Per address; only wrong credentials count, so people sharing one NAT or VPN can all sign in
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  skipSuccessfulRequests: true,
  requestWasSuccessful: (req, res) => res.statusCode !== 401 && !res.locals.loginFailed,
  message: { status: 'failure', message: 'Too many attempts. Try again in 15 minutes.' },
});

const failedLoginLimit = () => {
  const n = parseInt(process.env.AUTH_MAX_FAILED_LOGINS, 10);
  return Number.isInteger(n) && n > 0 ? n : 5;
};

// "CORP\\Alice", fullwidth "ａｌｉｃｅ" and "alİce" count as "alice" (directories match the dotted capital
// İ as i); on the local form "alice@corp.example.org" does too. Provider forms keep "@domain", since
// alice@one.org and alice@two.org can be two people; LDAP also counts per directory entry.
const accountKey = (username, form = 'local') => {
  const key = String(username)
    .normalize('NFKC')
    .trim()
    .replace(/\u0130/g, 'I')
    .toLowerCase()
    .replace(/^[^\\]*\\/, '');
  return form === 'local' ? key.split('@')[0] : key;
};

// Failed logins per account and login form, so MMGIS stops before a directory locks the account.
// Only wrong credentials count: a 401, or a 200 with res.locals.loginFailed. Forms count
// separately so directory failures can't lock out a local (recovery) account.
// Provider forms count from any address, so MMGIS stops before the directory locks the account
// everywhere; deliberately, that lets someone who knows a username keep it off that form for a while.
// The local form has no directory to protect, so it counts per address, with a ceiling 10x higher
// across addresses; nobody can then lock a local SuperAdmin out with a handful of requests.
// Counts are kept in each server process's memory.
const failedLoginLimiter = (limit, keyGenerator) =>
  rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    limit,
    keyGenerator,
    skip: (req) => !(req.body && typeof req.body.username === 'string' && req.body.username.trim() !== ''),
    skipSuccessfulRequests: true,
    requestWasSuccessful: (req, res) => res.statusCode !== 401 && !res.locals.loginFailed,
    message: { status: 'failure', message: 'Too many failed sign-ins for this account. Try again in 15 minutes.' },
  });
const accountLimiters = new Map();
function accountLimiterFor(form) {
  if (!accountLimiters.has(form)) {
    const byAccount = (req) => accountKey(req.body.username, form);
    const limiters =
      form === 'local'
        ? [
            failedLoginLimiter(() => 10 * failedLoginLimit(), byAccount),
            failedLoginLimiter(() => failedLoginLimit(), (req) => `${byAccount(req)}|${req.ip}`),
          ]
        : [failedLoginLimiter(() => failedLoginLimit(), byAccount)];
    // Mounted on both /api/users/login and /api/auth/local/login, so count each request once
    const once = (req, res, next) => {
      if (req.accountLimited) return next();
      req.accountLimited = true;
      return limiters[0](req, res, (err) => (err || !limiters[1] ? next(err) : limiters[1](req, res, next)));
    };
    once.resetKey = (key) => limiters.forEach((l) => l.resetKey(key));
    accountLimiters.set(form, once);
  }
  return accountLimiters.get(form);
}
const accountLimiter = accountLimiterFor('local');

// Clears an account's failed logins on every provider form and the local per-account ceiling
// (not local per-address counts), e.g. once an admin fixed why it was refused
function resetFailedLogins(username) {
  accountLimiters.forEach((l, form) => l.resetKey(accountKey(username, form)));
}

// Account admins creating accounts through /signup are not limited
function skipAccountAdmins(req) {
  const { ensurePrincipal } = require('../API/permissions/authorize');
  const policy = require('../API/permissions/policy');
  return ensurePrincipal(req)
    .then((p) => policy.can(p, 'accounts.manage'))
    .catch(() => false);
}

const signupLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  message: { status: 'failure', message: 'Too many attempts, try again later.' },
  skip: skipAccountAdmins,
});

const resetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  message: { status: 'failure', message: 'Too many attempts, try again later.' },
});

const computeLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 200,
  message: { status: 'failure', message: 'Rate limit exceeded.' },
});

module.exports = { apilimiter, authLimiter, failedLoginLimit, accountLimiter, accountLimiterFor, resetFailedLogins, accountKey, signupLimiter, resetLimiter, computeLimiter };
