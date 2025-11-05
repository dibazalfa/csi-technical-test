const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');

const app = express();

app.use(cors({
    origin: '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    allowedHeaders: '*',
    optionsSuccessStatus: 204
}));

dotenv.config();

const PORT = process.env.PORT;

app.use(express.json());

const apiRouter = require('./api/notifications/notif.controller');
const internalRouter = require('./api/stats/stats.controller');

app.use('/api', apiRouter);
app.use('/internal', internalRouter);

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});