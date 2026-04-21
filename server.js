const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');

const app = express();
app.use(cors({ origin: '*' })); 
app.use(express.json());

// Securely connects to Neon via Render's Environment Variables
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

app.post('/api/scan', async (req, res) => {
    const { query } = req.body; 

    try {
        let dbResult = await pool.query('SELECT * FROM participants WHERE nmf_id = $1 OR phone = $1', [query]);
        let type = 'Regular Event';
        let tableName = 'participants';

        if (dbResult.rows.length === 0) {
            dbResult = await pool.query('SELECT * FROM th_participants WHERE nmf_id = $1 OR phone = $1', [query]);
            type = 'Treasure Hunt';
            tableName = 'th_participants';
        }

        if (dbResult.rows.length === 0) {
            return res.json({ success: false, message: "PARTICIPANT NOT FOUND", details: null });
        }

        const participant = dbResult.rows[0];
        const details = {
            id: participant.nmf_id,
            name: participant.full_name,
            institution: participant.institution,
            phone: participant.phone,
            type: type,
            payment: participant.payment_status || "unpaid"
        };

        if (details.payment.toLowerCase() !== 'paid') {
            return res.json({ success: false, message: `ACCESS DENIED: ${details.payment.toUpperCase()}`, details: details });
        }

        if (participant.checked_in) {
            return res.json({ success: false, message: "ALREADY CHECKED IN!", details: details });
        }

        await pool.query(`UPDATE ${tableName} SET checked_in = true WHERE id = $1`, [participant.id]);
        
        return res.json({ success: true, message: "CHECK-IN SUCCESSFUL!", details: details });

    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: "Server error connecting to database.", details: null });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));
