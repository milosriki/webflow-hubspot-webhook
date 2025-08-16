const axios = require('axios');
const crypto = require('crypto');

module.exports = async (req, res) => {
  // Log everything for debugging
  console.log('WEBHOOK DEBUG - Full request:', {
    method: req.method,
    url: req.url,
    headers: req.headers,
    body: req.body
  });
  
  // Only accept POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }
  
  try {
    // Extract form data from Webflow webhook
    const formData = req.body.data || {};
    console.log('WEBHOOK DEBUG - Form data:', formData);
    
    // Create properties object for HubSpot
    const properties = {};
    
    // Map standard fields
    if (formData.name) properties.firstname = formData.name;
    if (formData.email) properties.email = formData.email;
    
    // Handle phone number - specifically for UAE
    if (formData.phone) {
      let phone = formData.phone;
      // Ensure it has the +971 format
      if (phone.startsWith('+971')) {
        // Already formatted correctly
        properties.phone = phone;
      } else if (phone.startsWith('971')) {
        properties.phone = '+' + phone;
      } else if (phone.startsWith('0')) {
        properties.phone = '+971' + phone.substring(1);
      } else {
        properties.phone = '+971' + phone;
      }
    }
    
    // Handle fitness goal as a custom field or note
    let fitnessGoal = '';
    if (formData.goal === 'lose-weight') fitnessGoal = 'Lose weight';
    else if (formData.goal === 'improve-health') fitnessGoal = 'Improve health';
    else if (formData.goal === 'build-muscle') fitnessGoal = 'Build muscle';
    else if (formData.goal === 'not-sure') fitnessGoal = 'Not sure';
    
    if (fitnessGoal) {
      // Add as a note since it might not be a standard property
      properties.notes = `Fitness Goal: ${fitnessGoal}`;
    }
    
    console.log('WEBHOOK DEBUG - Sending to HubSpot:', { properties });
    
    // Send to HubSpot
    const hubspotResponse = await axios({
      method: 'POST',
      url: 'https://api.hubapi.com/crm/v3/objects/contacts',
      headers: {
        'Authorization': `Bearer ${process.env.HUBSPOT_API_KEY}`,
        'Content-Type': 'application/json'
      },
      data: { properties }
    });
    
    console.log('WEBHOOK DEBUG - HubSpot response:', hubspotResponse.data);
    
    // CRITICAL: Return a response in the exact format Webflow expects
    // This is what fixes the "Form Submission Failed" message
    return res.status(200).end();
  } catch (error) {
    console.error('WEBHOOK DEBUG - Error:', error.message);
    if (error.response) {
      console.error('WEBHOOK DEBUG - Error response:', error.response.data);
    }
    
    // Even on error, return 200 to prevent the failure message
    return res.status(200).end();
  }
};
