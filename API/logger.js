const winston = require('winston');
const moment  = require('moment');


const logger = winston.createLogger({
  level: 'info',
  colorize: true,
  timestamp: true,
  // format: winston.format.json(),
  transports: [
    //
    // - Write to all logs with level `info` and below to `combined.log` 
    // - Write all logs error (and below) to `error.log`.
    new (winston.transports.Console)({
      timestamp() {
        return moment().format('YYYY-MM-DD HH:mm:ss.SSSS');
      },
      formatter(params) {
        // Options object will be passed to the format function.
        // It's general properties are: timestamp, level, message, meta.
        const meta = params.meta !== undefined ? util.inspect(params.meta, { depth: null }) : '';
        return `[${params.timestamp}] [${params.level}] [${pkg.name}] *** ${params.message} ${meta}`;
      },
    }),
    new winston.transports.File({ filename: __dirname + '/logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: __dirname + '/logs/combined.log' })
  ],
  exceptionHandlers: [
    new (winston.transports.Console)({ json: false, timestamp: true }),
    new winston.transports.File({ filename: __dirname + '/logs/exceptions.log', json: false })
  ]
});

//
// If we're not in production then log to the `console` with the format:
// `${info.level}: ${info.message} JSON.stringify({ ...rest }) `
// 
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }));
}

module.exports = logger;