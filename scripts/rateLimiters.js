const { rateLimit } = require("express-rate-limit");

const apilimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 3000, // limit each IP to 3000 requests per windowMs
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  message: { status: 'failure', message: 'Too many attempts. Try again in 15 minutes.' },
});

const failedLoginLimit = () => {
  const n = parseInt(process.env.AUTH_MAX_FAILED_LOGINS, 10);
  return Number.isInteger(n) && n > 0 ? n : 5;
};

// "CORP\\Alice" and "alice@corp.example.org" count as "alice"
const accountKey = (req) =>
  String(req.body.username)
    .trim()
    .toLowerCase()
    .replace(/^[^\\]*\\/, '')
    .replace(/@.*$/, '');

// Failed logins per account, from any address, so MMGIS stops before a directory locks the account.
// A route that answers a failed login with 200 sets res.locals.loginFailed.
const accountLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: () => failedLoginLimit(),
  keyGenerator: accountKey,
  skip: (req) => !(req.body && typeof req.body.username === 'string' && req.body.username.trim() !== ''),
  skipSuccessfulRequests: true,
  requestWasSuccessful: (req, res) => res.statusCode < 400 && !res.locals.loginFailed,
  message: { status: 'failure', message: 'Too many failed sign-ins for this account. Try again in 15 minutes.' },
});

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

module.exports = { apilimiter, authLimiter, accountLimiter, signupLimiter, resetLimiter, computeLimiter };
