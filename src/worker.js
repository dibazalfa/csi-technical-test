const prisma = require('./db');

function backoffDelay(attempt) {
    const base = Math.pow(2, Math.max(0, attempt - 1)) // 1,2,4,8,16
    const jitter = Math.random() * 0.3
    return Math.ceil(base * (1 + jitter)) * 1000
}

async function claimJob() {
    const [job] = await prisma.$transaction(async (tx) => {
        return tx.$queryRaw
            `UPDATE notification_jobs
            SET status='PROCESSING',
            attempts = attempts + 1, 
            updated_at=NOW()
            WHERE id = (
                SELECT id FROM notification_jobs
                WHERE status IN ('PENDING','RETRY') AND next_run_at <= NOW()
                ORDER BY next_run_at ASC
                FOR UPDATE SKIP LOCKED
                LIMIT 1
            )
            RETURNING *`
    })
    return job ?? null
}

async function markJobSuccess(id) {
    await prisma.job.update({
        where: { id },
        data: {
            status: 'SUCCESS',
            processed_at: new Date(),
            updated_at: new Date()
        }
    })
}

async function markJobRetryorFail(job) {
    const attempts = job.attempts
    const max = job.max_attempts
    const status = attempts < max ? 'RETRY' : 'FAILED'
    const delay = status === 'RETRY' ? backoffDelay(attempts) : 0
    const nextRunAt = status === 'RETRY' ? new Date(Date.now() + delay) : job.next_run_at

    await prisma.job.update({
        where: { id: job.id },
        data: {
            status,
            next_run_at: nextRunAt,
            last_error: 'Simulated transient failure',
            updated_at: new Date()
        }
    })

    return status;
}

async function processLoop() {
    console.log("Worker started, waiting for jobs...")

    while (true) {
        const job = await claimJob()
        if (!job) {
            await new Promise(r => setTimeout(r, 500))
            continue
        }

        const ok = Math.random() <= 0.7
        if (ok) {
            await markJobSuccess(job.id)
            console.log(JSON.stringify({
                status: 'SUCCESS',
                jobId: job.id,
                attempt: job.attempts
            }, null, 2))

        } else {
            const status = await markJobRetryorFail(job)
            if (status === 'RETRY') {
                console.log(JSON.stringify({
                    status: job.attempts < job.max_attempts ? 'RETRY' : 'FAILED',
                    jobId: job.id,
                    attempt: job.attempts,
                    nextRunAt: job.next_run_at,
                }, null, 2))
            } else if (status === 'FAILED') {
                console.log(JSON.stringify({
                    status: job.attempts < job.max_attempts ? 'RETRY' : 'FAILED',
                    jobId: job.id,
                    attempt: job.attempts,
                    last_error: 'Simulated transient failure'
                }, null, 2))
            }
        }
    }
}

processLoop().catch(e => {
    console.error(e)
    process.exit(1)
}).finally(() => prisma.$disconnect())

