const axios = require('axios');

module.exports = async (req, res) => {
  // Only accept POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }
  
  try {
    // Log the received data
    console.log('Webhook received:', JSON.stringify(req.body, null, 2));
    
    // Extract form data from Webflow webhook
    const formData = req.body.data;
    
    // Map Webflow fields to HubSpot properties with correct lowercase names
    const hubspotData = {
      properties: {
        email: formData.email || '',
        firstname: formData.firstName || formData.first_name || formData.firstname || '',
        lastname: formData.lastName || formData.last_name || formData.lastname || '',
        phone: formData.phone || formData.phoneNumber || formData.phone_number || '',
        // Add other fields as needed
      }
    };
    
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
    
    console.log('HubSpot response:', hubspotResponse.data);
    
    // Return success response
    return res.status(200).json({ 
      success: true,
      message: 'Data sent to HubSpot successfully' 
    });
  } catch (error) {
    // Log error details
    console.error('Error processing webhook:', error.response?.data || error.message);
    
    // Return error response
    return res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
};
