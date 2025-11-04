const prisma = require('../../db')

const insertNotificationJob = async (data) => {
    const job = await prisma.job.create({
        data: {
            recipient: data.recipient,
            channel: data.channel,
            message: data.message,
            idempotency_key: data.idempotency_key,
        }
    })

    return job;
}

const findIdempotentJob = async (idempotencyKey) => {
    const job = await prisma.job.findUnique({
        where: { idempotency_key: idempotencyKey }
    })
    return job;
}

module.exports = {
    insertNotificationJob,
    findIdempotentJob
}