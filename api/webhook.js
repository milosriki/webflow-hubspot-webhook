const axios = require('axios');
const crypto = require('crypto');

module.exports = async (req, res) => {
  // Only accept POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }
  
  try {
    // Get the signature from the headers
    const signature = req.headers['x-webflow-signature'];
    
    // Verify the webhook signature
    const secret = process.env.WEBFLOW_WEBHOOK_SECRET || 'fec3fc4bb106510005307877b17057d4a35d28188ffddceddf7c1cfb57e90ce3';
    const payload = JSON.stringify(req.body);
    const hmac = crypto.createHmac('sha256', secret);
    const digest = hmac.update(payload).digest('hex');
    
    // If signatures
