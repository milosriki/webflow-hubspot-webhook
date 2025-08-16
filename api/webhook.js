const axios = require('axios');
const crypto = require('crypto');

module.exports = async (req, res) => {
  // Only accept POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }
  
  try {
    // Log request headers and body for debugging
    console.log('Webhook request headers:', JSON.stringify(req.headers, null, 2));
    console.log('Webhook request body:', JSON.stringify(req.body, null, 2));
    
    // Get the signature from the headers
    const signature = req.headers['x-webflow-signature'];
    
    // Verify the webhook signature if present
    if (signature) {
      const secret = process.env.WEBFLOW_WEBHOOK_SECRET || 'fec3fc4bb106510005307877b17057d4a35d28188ffddceddf7c1cfb57e90ce3';
      const payload = JSON.stringify(req.body);
      const hmac = crypto.createHmac('sha256', secret);
      const digest = hmac.update(payload).digest('hex');
      
      if (signature !== digest) {
        console.warn('Invalid webhook signature');
        return res.status(403).json({ error: 'Invalid signature' });
      }
      console.log('Webhook signature verified successfully');
    } else {
      console.log('No webhook signature found in request');
    }
    
    // Extract form data from Webflow webhook
    const formData = req.body.data || {};
    console.log('Form data extracted:', formData);
    
    // Form ID and name for logging
    const formId = req.body.formId || 'unknown';
    const formName = req.body.formName || 'unknown';
    console.log(`Processing form: ${formName} (ID: ${formId})`);
    
    // Format phone number if present
    let phoneNumber = formData.phone || formData.Phone || formData.phoneNumber || formData.phone_number || '';
    // Strip any non-digit characters except + at the beginning
    if (phoneNumber) {
      // If it starts with a + followed by country code, leave it
      if (!phoneNumber.startsWith('+')) {
        // If it doesn't have a +, we'll format it as just the digits
        phoneNumber = phoneNumber.replace(/\D/g, '');
      }
    }
    
    // Comprehensive field mapping to handle various field naming conventions
    const hubspotData = {
      properties: {
        // Email field variations
        email: formData.email || formData.Email || formData.EMAIL || formData.userEmail || formData.user_email || '',
        
        // First name field variations
        firstname: formData.firstname || formData.firstName || formData.first_name || formData.FirstName || formData.Firstname || formData.first || formData.fname || '',
        
        // Last name field variations
        lastname: formData.lastname || formData.lastName || formData.last_name || formData.LastName || formData.Lastname || formData.last || formData.lname || '',
        
        // Phone field with formatting
        phone: phoneNumber,
        
        // Company field variations
        company: formData.company || formData.Company || formData.companyName || formData.company_name || '',
        
        // Address field variations
        address: formData.address || formData.Address || formData.street_address || formData.streetAddress || '',
        city: formData.city || formData.City || '',
        state: formData.state || formData.State || formData.province || formData.Province || '',
        zip: formData.zip || formData.Zip || formData.zipCode || formData.zip_code || formData.postalCode || formData.postal_code || '',
        country: formData.country || formData.Country || '',
        
        // Remove metadata fields that don't exist in HubSpot
        // form_id: formId,
        // form_name: formName,
        // form_submission_source: 'Webflow Form via Custom Webhook',
      }
    };
    
    // Remove empty properties
    Object.keys(hubspotData.properties).forEach(key => {
      if (!hubspotData.properties[key]) {
        delete hubspotData.properties[key];
      }
    });
    
    console.log('Data to send to HubSpot:', JSON.stringify(hubspotData, null, 2));
    
    // Send to HubSpot
    const hubspotResponse = await axios({
      method: 'POST',
      url: 'https://api.hubapi.com/crm/v3/objects/contacts',
      headers: {
        'Authorization': `Bearer ${process.env.HUBSPOT_API_KEY}`,
        'Content-Type': 'application/json'
      },
      data: hubspotData
    });
    
    console.log('HubSpot API response:', JSON.stringify(hubspotResponse.data, null, 2));
    
    // Return success response
    return res.status(200).json({ 
      success: true,
      message: 'Data sent to HubSpot successfully',
      hubspotContactId: hubspotResponse.data.id
    });
  } catch (error) {
    // Log error details
    console.error('Error processing webhook:', error.message);
    if (error.response) {
      console.error('HubSpot API error response:', JSON.stringify(error.response.data, null, 2));
    }
    
    // Return error response
    return res.status(500).json({ 
      success: false, 
      error: error.message,
      details: error.response?.data || 'No additional details available'
    });
  }
};
