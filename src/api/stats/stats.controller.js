const express = require('express');
const prisma = require('../../db');
const { getAllStatsJobs } = require('./stats.service');

const router = express.Router();

router.get('/queue/stats', async (req, res) => {
    try {
        const jobs = await getAllStatsJobs();
        res.json({
            jobs
        });
    } catch (error) {
        console.error('Error fetching jobs:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

module.exports = router;
