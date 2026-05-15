const fs = require('fs');
const path = require('path');

const STORAGE_FILE = path.join(__dirname, 'note.txt');

function readData() {
    if (!fs.existsSync(STORAGE_FILE)) return { campaigns: [], recipients: [] };
    const content = fs.readFileSync(STORAGE_FILE, 'utf8');
    try {
        return JSON.parse(content || '{"campaigns": [], "recipients": []}');
    } catch (e) {
        return { campaigns: [], recipients: [] };
    }
}

function writeData(data) {
    fs.writeFileSync(STORAGE_FILE, JSON.stringify(data, null, 2));
}

module.exports = {
    getAllCampaigns: () => readData().campaigns,
    getCampaign: (id) => readData().campaigns.find(c => c.id === id),
    addCampaign: (campaign) => {
        const data = readData();
        campaign.id = data.campaigns.length + 1;
        data.campaigns.push(campaign);
        writeData(data);
        return campaign.id;
    },
    updateCampaign: (id, updates) => {
        const data = readData();
        const index = data.campaigns.findIndex(c => c.id === id);
        if (index > -1) {
            data.campaigns[index] = { ...data.campaigns[index], ...updates };
            writeData(data);
        }
    },
    addRecipients: (campaignId, recipients) => {
        const data = readData();
        recipients.forEach(r => {
            data.recipients.push({
                ...r,
                id: data.recipients.length + 1,
                campaign_id: campaignId,
                status: 'pending'
            });
        });
        writeData(data);
    },
    getRecipients: (campaignId) => readData().recipients.filter(r => r.campaign_id === campaignId),
    updateRecipient: (id, updates) => {
        const data = readData();
        const index = data.recipients.findIndex(r => r.id === id);
        if (index > -1) {
            data.recipients[index] = { ...data.recipients[index], ...updates };
            writeData(data);
        }
    }
};
