require('dotenv').config();
const express = require('express');
const nodemailer = require('nodemailer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

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

app.post('/api/send-bulk', async (req, res) => {
    const { recipients, subject, html, fromName, fromEmail, attachments } = req.body;

    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
        return res.status(400).json({ success: false, error: 'No recipients provided' });
    }

    if (!subject || !html) {
        return res.status(400).json({ success: false, error: 'Subject and HTML content are required' });
    }

    if (!transporter) {
        return res.status(500).json({ 
            success: false, 
            error: 'SMTP not configured. Please set SMTP_USER, SMTP_PASS in .env file' 
        });
    }

    const results = { success: 0, failed: 0, errors: [] };
    const batchSize = parseInt(process.env.BATCH_SIZE) || 10;
    const delay = parseInt(process.env.DELAY_BETWEEN_BATCHES) || 2000;
    const logEntries = [];
    const timestamp = new Date().toLocaleString();

    for (let i = 0; i < recipients.length; i += batchSize) {
        const batch = recipients.slice(i, i + batchSize);
        const promises = batch.map(async (recipient) => {
            try {
                const formattedAttachments = (attachments || []).map(att => ({
                    filename: att.filename,
                    content: att.content,
                    encoding: 'base64'
                }));

                const mailOptions = {
                    from: `"${fromName || 'Bulk Sender'}" <${fromEmail || process.env.SMTP_USER}>`,
                    to: recipient.email,
                    subject: replaceVariables(subject, recipient),
                    html: replaceVariables(html, recipient),
                    attachments: formattedAttachments
                };

                await sendEmail(mailOptions);
                results.success++;
                logEntries.push(`[${timestamp}] SUCCESS: ${recipient.email}`);
                return { email: recipient.email, status: 'success' };
            } catch (error) {
                results.failed++;
                results.errors.push({ email: recipient.email, error: error.message });
                logEntries.push(`[${timestamp}] FAILED: ${recipient.email} - Error: ${error.message}`);
                return { email: recipient.email, status: 'failed', error: error.message };
            }
        });

        await Promise.all(promises);

        if (i + batchSize < recipients.length) {
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }

    // Write to note.txt
    if (logEntries.length > 0) {
        const logContent = logEntries.join('\n') + '\n';
        fs.appendFile(path.join(__dirname, 'note.txt'), logContent, (err) => {
            if (err) console.error('Error writing to note.txt:', err);
        });
    }

    res.json({
        success: true,
        total: recipients.length,
        results
    });
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

app.listen(PORT, () => {
    console.log(`\n========================================`);
    console.log(`🚀 Bulk Email Sender Running`);
    console.log(`========================================`);
    console.log(`📧 Open in browser: http://localhost:${PORT}`);
    console.log(`========================================\n`);
});
