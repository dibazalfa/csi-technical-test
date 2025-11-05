const prisma = require('../../db')
const { getQueueStats } = require('./stats.repository')

const getAllStatsJobs = async () => {
    const { stats, avg } = await getQueueStats()
    const pick = s => {
        for (const item of stats) {
            if (item.status === s)
                return item._count.status
        }
        return 0
    }

    return {
        pending: pick('PENDING'),
        processing: pick('PROCESSING'),
        retry: pick('RETRY'),
        success: pick('SUCCESS'),
        failed: pick('FAILED'),
        avg_attempts_success: avg._avg.attempts ?? 0
    }
}

module.exports = {
    getAllStatsJobs
}
