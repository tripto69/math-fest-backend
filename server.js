const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');

const app = express();
app.use(cors({ origin: '*' })); 
app.use(express.json());

// This will use the secret connection string we'll add to Render in Step 3
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

// --- SECURE LOGIN ---
app.post('/api/login', (req, res) => {
    const { username, pin } = req.body;
    const validGuards = {
        "tripto": "admin789",    // You can change these later
        "gate1": "festival2026"
    };

    if (validGuards[username] && validGuards[username] === pin) {
        res.json({ success: true });
    } else {
        res.json({ success: false, message: "Invalid Username or PIN." });
    }
});

// --- SCAN & CHECK-IN ---
app.post('/api/scan', async (req, res) => {
    const { query } = req.body; 

    try {
        // Search regular participants first
        let dbResult = await pool.query('SELECT * FROM participants WHERE nmf_id = $1 OR phone = $1', [query]);
        let type = 'Regular Event';
        let tableName = 'participants';

        // Search treasure hunt if not found
        if (dbResult.rows.length === 0) {
            dbResult = await pool.query('SELECT * FROM th_participants WHERE nmf_id = $1 OR phone = $1', [query]);
            type = 'Treasure Hunt';
            tableName = 'th_participants';
        }

        if (dbResult.rows.length === 0) {
            return res.json({ success: false, message: "PARTICIPANT NOT FOUND" });
        }

        const participant = dbResult.rows[0];

        // Validate Payment Status from your schema
        if (!participant.payment_status || participant.payment_status.toLowerCase() !== 'paid') {
            return res.json({ 
                success: false, 
                message: `ACCESS DENIED: ${participant.payment_status ? participant.payment_status.toUpperCase() : 'UNPAID'}`, 
                details: { name: participant.full_name } 
            });
        }

        // Check the new column we added in Step 1
        if (participant.checked_in) {
            return res.json({ 
                success: false, 
                message: "ALREADY CHECKED IN!", 
                details: { name: participant.full_name } 
            });
        }

        // Mark as checked in
        await pool.query(`UPDATE ${tableName} SET checked_in = true WHERE id = $1`, [participant.id]);
        
        return res.json({ 
            success: true, 
            message: "CHECK-IN SUCCESSFUL!", 
            details: {
                name: participant.full_name,
                id: participant.nmf_id,
                type: type
            } 
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: "Database Error" });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server live on port ${PORT}`));
