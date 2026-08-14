const rateLimit = require("express-rate-limit");

const apilimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 20000, // limit each IP to 100 requests per windowMs
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  message: { status: 'failure', message: 'Too many attempts, try again later.' },
});

const computeLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 200,
  message: { status: 'failure', message: 'Rate limit exceeded.' },
});

module.exports = { apilimiter, authLimiter, computeLimiter };
