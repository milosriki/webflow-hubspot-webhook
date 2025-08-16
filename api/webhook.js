const axios = require('axios');
const crypto = require('crypto');

module.exports = async (req, res) => {
  // Only accept POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }
  
  try {
    // Log request headers and body for debugging
    console.log('WEBHOOK DEBUG - Headers:', JSON.stringify(req.headers, null, 2));
    console.log('WEBHOOK DEBUG - Body:', JSON.stringify(req.body, null, 2));
    
    // Get the signature from the headers
    const signature = req.headers['x-webflow-signature'];
    
    // Verify the webhook signature if present
    if (signature) {
      const secret = process.env.WEBFLOW_WEBHOOK_SECRET || 'fec3fc4bb106510005307877b17057d4a35d28188ffddceddf7c1cfb57e90ce3';
      const payload = JSON.stringify(req.body);
      const hmac = crypto.createHmac('sha256', secret);
      const digest = hmac.update(payload).digest('hex');
      
      if (signature !== digest) {
        console.warn('WEBHOOK DEBUG - Invalid signature');
        return res.status(403).json({ error: 'Invalid signature' });
      }
      console.log('WEBHOOK DEBUG - Signature verified');
    } else {
      console.log('WEBHOOK DEBUG - No signature found');
    }
    
    // Extract form data from Webflow webhook
    const formData = req.body.data || {};
    console.log('WEBHOOK DEBUG - Form data:', formData);
    
    // Log all available field names for debugging
    console.log('WEBHOOK DEBUG - Available fields:', Object.keys(formData));
    
    // Create properties object for HubSpot - standard property names
    const properties = {};
    
    // Handle email (required field)
    if (formData.email) properties.email = formData.email;
    else if (formData.Email) properties.email = formData.Email;
    else if (formData.EMAIL) properties.email = formData.EMAIL;
    
    // Handle first name
    if (formData.firstname) properties.firstname = formData.firstname;
    else if (formData.firstName) properties.firstname = formData.firstName;
    else if (formData.first_name) properties.firstname = formData.first_name;
    else if (formData.FirstName) properties.firstname = formData.FirstName;
    
    // Handle last name
    if (formData.lastname) properties.lastname = formData.lastname;
    else if (formData.lastName) properties.lastname = formData.lastName;
    else if (formData.last_name) properties.lastname = formData.last_name;
    else if (formData.LastName) properties.lastname = formData.LastName;
    
    // Handle phone - FORMAT FOR UAE
    let phoneValue = '';
    const rawPhone = formData.phone || formData.Phone || formData.phoneNumber || formData.phone_number || '';
    
    if (rawPhone) {
      console.log('WEBHOOK DEBUG - Raw phone:', rawPhone);
      
      // Clean the phone number - remove all non-digits
      let digits = rawPhone.replace(/\D/g, '');
      console.log('WEBHOOK DEBUG - Digits only:', digits);
      
      // UAE phone number formatting
      // HubSpot expects UAE numbers in format: +971xxxxxxxxx
      if (digits.startsWith('971')) {
        // Already has country code, just add the plus
        phoneValue = '+' + digits;
      } else if (digits.startsWith('00971')) {
        // Has 00 prefix, replace with +
        phoneValue = '+' + digits.substring(2);
      } else if (digits.startsWith('0')) {
        // Local number starting with 0, replace with +971
        phoneValue = '+971' + digits.substring(1);
      } else {
        // Assume it's a local number without the leading 0
        phoneValue = '+971' + digits;
      }
      
      console.log('WEBHOOK DEBUG - Formatted phone:', phoneValue);
      properties.phone = phoneValue;
    }
    
    // Handle company
    if (formData.company) properties.company = formData.company;
    else if (formData.Company) properties.company = formData.Company;
    
    // Log what we're sending to HubSpot
    console.log('WEBHOOK DEBUG - Sending to HubSpot:', { properties });
    
    try {
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
      
      // Always return a 200 success to Webflow
      return res.status(200).json({ 
        success: true,
        message: 'Form submission processed successfully',
        contactId: hubspotResponse.data.id
      });
    } catch (hubspotError) {
      console.error('WEBHOOK DEBUG - HubSpot API error:', hubspotError.message);
      if (hubspotError.response && hubspotError.response.data) {
        console.error('WEBHOOK DEBUG - HubSpot error details:', hubspotError.response.data);
      }
      
      // IMPORTANT: Return a 200 status even if HubSpot has an error
      // This prevents Webflow from showing an error message to the user
      return res.status(200).json({
        success: true,
        message: 'Form submission received',
        hubspotError: hubspotError.message
      });
    }
  } catch (error) {
    console.error('WEBHOOK DEBUG - General error:', error.message);
    
    // IMPORTANT: Return a 200 status code regardless of errors
    // This prevents Webflow from showing an error message
    return res.status(200).json({ 
      success: true,
      message: 'Form submission received',
      error: error.message
    });
  }
};
