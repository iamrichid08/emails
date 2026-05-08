# Bulk Email Sender

A Node.js bulk email sending application with SMTP support and a modern web interface.

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure SMTP:**
   Edit the `.env` file with your SMTP credentials:
   ```env
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=your-email@gmail.com
   SMTP_PASS=your-app-password
   ```

   For Gmail, you need an [App Password](https://support.google.com/accounts/answer/185833).

3. **Start the server:**
   ```bash
   npm start
   ```

4. **Open browser:**
   Navigate to `http://localhost:3000`

## Features

- Send personalized emails to multiple recipients
- Use `{{variable}}` syntax for dynamic content
- Batch sending with configurable delays
- Real-time progress tracking
- Modern dark UI interface
- SMTP status indicator

## Usage

1. Enter sender name and email
2. Add subject and HTML content (use `{{name}}`, `{{email}}`, etc.)
3. Add recipients in JSON format
4. Click "Send Emails"
