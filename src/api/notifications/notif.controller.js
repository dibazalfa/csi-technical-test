const express = require('express');
const prisma = require('../../db');
const { createNotificationJob } = require('./notif.service');

const router = express.Router();

router.post('/notifications', async (req, res) => {
    try {
        const notificationData = req.body;

        const channelTypes = ['email', 'sms'];
        if (!channelTypes.includes(notificationData.channel)) {
            return res.status(400).json({ error: "Invalid channel type, input email or sms" });
        }

        const job = await createNotificationJob(notificationData);
        res.status(201).json({ job_id: job.id, status: job.status });

    } catch (error) {
        res.status(400).json({ error: "Failed to create notification job" });
    }
});

module.exports = router;
