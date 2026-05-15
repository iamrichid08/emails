require('dotenv').config();
const express = require('express');
const nodemailer = require('nodemailer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const http = require('http');
const { Server } = require('socket.io');
const db = require('./db');

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);
});

let transporter = null;

function createTransporter() {
    return nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: process.env.SMTP_PORT || 587,
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
        }
    });
}

if (process.env.SMTP_USER && process.env.SMTP_PASS) {
    transporter = createTransporter();
    console.log('SMTP configured and ready');
} else {
    console.log('SMTP not configured - set SMTP_USER, SMTP_PASS in .env');
}

async function sendEmail(mailOptions) {
    const transport = createTransporter();
    return await transport.sendMail(mailOptions);
}

// Background Processing
async function processQueue() {
    db.get("SELECT * FROM campaigns WHERE status = 'processing' LIMIT 1", [], async (err, campaign) => {
        if (campaign) return; // Already processing

        db.get("SELECT * FROM campaigns WHERE status = 'pending' LIMIT 1", [], async (err, campaign) => {
            if (err || !campaign) return;

            db.run("UPDATE campaigns SET status = 'processing' WHERE id = ?", [campaign.id]);
            
            const recipients = await new Promise((resolve) => {
                db.all("SELECT * FROM recipients WHERE campaign_id = ?", [campaign.id], (err, rows) => resolve(rows));
            });

            const batchSize = parseInt(process.env.BATCH_SIZE) || 10;
            const delay = parseInt(process.env.DELAY_BETWEEN_BATCHES) || 2000;
            const attachments = JSON.parse(campaign.attachments || '[]');

            const totalRecipients = recipients.length;
            
            for (let i = 0; i < recipients.length; i += batchSize) {
                const batch = recipients.slice(i, i + batchSize);
                await Promise.all(batch.map(async (recipient) => {
                    try {
                        await sendEmail({
                            from: `"${campaign.from_name || 'Bulk Sender'}" <${campaign.from_email || process.env.SMTP_USER}>`,
                            to: recipient.email,
                            subject: replaceVariables(campaign.subject, recipient),
                            html: replaceVariables(campaign.html, recipient),
                            attachments: attachments
                        });
                        db.run("UPDATE recipients SET status = 'sent' WHERE id = ?", [recipient.id]);
                    } catch (error) {
                        db.run("UPDATE recipients SET status = 'failed', error_message = ? WHERE id = ?", [error.message, recipient.id]);
                    }
                }));

                const processedCount = Math.min(i + batchSize, totalRecipients);
                const progress = Math.round((processedCount / totalRecipients) * 100);
                io.emit('progress', { progress, processedCount, total: totalRecipients, campaignId: campaign.id });

                if (i + batchSize < recipients.length) await new Promise(resolve => setTimeout(resolve, delay));
            }
            
            db.run("UPDATE campaigns SET status = 'completed' WHERE id = ?", [campaign.id]);
        });
    });
}

// Enqueue campaign
app.post('/api/send-bulk', async (req, res) => {
    const { recipients, subject, html, fromName, fromEmail, attachments } = req.body;

    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
        return res.status(400).json({ success: false, error: 'No recipients provided' });
    }

    db.run(
        "INSERT INTO campaigns (status, subject, html, from_name, from_email, attachments) VALUES ('pending', ?, ?, ?, ?, ?)",
        [subject, html, fromName, fromEmail, JSON.stringify(attachments)],
        function(err) {
            if (err) return res.status(500).json({ success: false, error: err.message });
            const campaignId = this.lastID;

            const stmt = db.prepare("INSERT INTO recipients (campaign_id, email, name) VALUES (?, ?, ?)");
            recipients.forEach(r => stmt.run(campaignId, r.email, r.name));
            stmt.finalize();

            res.json({ success: true, campaignId });
            
            // Trigger processing
            processQueue();
        }
    );
});

function replaceVariables(template, data) {
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => data[key] || match);
}

app.get('/api/status', (req, res) => {
    res.json({
        smtpConfigured: !!transporter,
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: process.env.SMTP_PORT || 587
    });
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

server.listen(PORT, () => {
    console.log(`
========================================`);
    console.log(`🚀 Bulk Email Sender Running`);
    console.log(`========================================`);
    console.log(`📧 Open in browser: http://localhost:${PORT}`);
    console.log(`========================================
`);
});
