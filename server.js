require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors()); // Allows everyone to connect
app.use(express.json()); // Allows parsing JSON data

// Routes
const matchRoutes = require('./routes/matchRoutes');
app.use('/api/match', matchRoutes);

// Test Route
app.get('/', (req, res) => {
    res.send('College Connect Backend is Running! 🚀');
});

// Start Server
app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
    console.log(`To test locally: http://localhost:${port}/api/match/find-teammates`);
});