const prisma = require('../../db')
const { insertNotificationJob, findIdempotentJob } = require('./notif.repository')

const createNotificationJob = async (data) => {
    const existingJob = await findIdempotentJob(data.idempotency_key)

    if (existingJob) {
        return existingJob;
    }

    const job = await insertNotificationJob(data)
    return job;
}

module.exports = {
    createNotificationJob,
}
