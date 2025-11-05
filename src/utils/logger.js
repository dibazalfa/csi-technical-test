const fs = require('fs')
const path = require('path')

const LOG_DIR = path.resolve('logs')
const workerId = process.env.pm_id ?? process.pid
const LOG_PATH = path.join(LOG_DIR, `worker-${workerId}.log`)

if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR)
}

function logToFile(data) {
  const timestamp = new Date().toISOString()
  fs.appendFileSync(LOG_PATH, `[${timestamp}] ${data}\n`)
}

module.exports = logToFile 