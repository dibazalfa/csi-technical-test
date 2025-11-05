const prisma = require('../../db')

const getQueueStats = async () => {
    const stats = await prisma.job.groupBy({
        by: ['status'],
        _count: {
            status: true
        }
    })

    const avg = await prisma.job.aggregate({
        where: { status: 'SUCCESS' },
        _avg: {
            attempts: true
        }
    })

    return {
        stats,
        avg
    };
}

module.exports = {
    getQueueStats
}
