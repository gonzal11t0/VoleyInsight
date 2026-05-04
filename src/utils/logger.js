const fs = require('fs').promises;
const path = require('path');
const config = require('../config');

class Logger {
  constructor() {
    this.level = config.logging.level;
    this.format = config.logging.format;
    this.logFile = config.logging.file;
    this.levels = { error: 0, warn: 1, info: 2, debug: 3 };
  }

  shouldLog(level) {
    return this.levels[level] <= this.levels[this.level];
  }

  formatMessage(level, message, meta = {}) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...meta
    };

    if (this.format === 'json') {
      return JSON.stringify(logEntry);
    }
    
    // Plain text format
    const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
    return `[${logEntry.timestamp}] ${level.toUpperCase()}: ${message}${metaStr}`;
  }

  async write(level, message, meta = {}) {
    if (!this.shouldLog(level)) return;

    const formatted = this.formatMessage(level, message, meta);
    
    // Console output
    if (level === 'error') {
      console.error(formatted);
    } else {
      console.log(formatted);
    }
    
    // File output (async, don't await to avoid blocking)
    if (this.logFile) {
      fs.appendFile(this.logFile, formatted + '\n').catch(err => {
        console.error('Failed to write to log file:', err.message);
      });
    }
  }

  error(message, meta = {}) {
    return this.write('error', message, meta);
  }

  warn(message, meta = {}) {
    return this.write('warn', message, meta);
  }

  info(message, meta = {}) {
    return this.write('info', message, meta);
  }

  debug(message, meta = {}) {
    return this.write('debug', message, meta);
  }
}

module.exports = new Logger();