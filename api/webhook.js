const axios = require('axios');

module.exports = async (req, res) => {
  // Set CORS headers first
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // Handle OPTIONS request for CORS
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // Only accept POST requests
  if (req.method !== 'POST') {
    return res.status(405).end();
  }
  
  try {
    // Log incoming request for debugging
    console.log('=== WEBHOOK RECEIVED ===');
    console.log('Time:', new Date().toISOString());
    console.log('Headers:', JSON.stringify(req.headers, null, 2));
    console.log('Body:', JSON.stringify(req.body, null, 2));
    
    // Extract form data - Webflow sends it in req.body directly or in req.body.data
    const formData = req.body.data || req.body || {};
    
    // Log extracted data
    console.log('Form Data Fields:', Object.keys(formData));
    
    // Create HubSpot contact properties
    const properties = {};
    
    // Map email (check various possible field names)
    if (formData.email || formData.Email || formData.EMAIL) {
      properties.email = (formData.email || formData.Email || formData.EMAIL).toLowerCase().trim();
    }
    
    // Map names - handle both combined and separate fields
    if (formData['First Name'] || formData.firstname || formData.FirstName) {
      properties.firstname = formData['First Name'] || formData.firstname || formData.FirstName;
    }
    
    if (formData['Last Name'] || formData.lastname || formData.LastName) {
      properties.lastname = formData['Last Name'] || formData.lastname || formData.LastName;
    }
    
    // If names come as a single field
    if (formData.name || formData.Name) {
      const fullName = (formData.name || formData.Name).trim();
      const nameParts = fullName.split(' ');
      if (!properties.firstname) properties.firstname = nameParts[0];
      if (!properties.lastname && nameParts.length > 1) {
        properties.lastname = nameParts.slice(1).join(' ');
      }
    }
    
    // Map company if present
    if (formData.company || formData.Company) {
      properties.company = formData.company || formData.Company;
    }
    
    // Handle phone number with UAE formatting
    if (formData.phone || formData.Phone || formData.mobile) {
      let phone = (formData.phone || formData.Phone || formData.mobile).toString();
      // Remove all non-digits
      phone = phone.replace(/\D/g, '');
      
      // Format for UAE
      if (phone.startsWith('971')) {
        properties.phone = '+' + phone;
      } else if (phone.startsWith('00971')) {
        properties.phone = '+' + phone.substring(2);
      } else if (phone.startsWith('0')) {
        properties.phone = '+971' + phone.substring(1);
      } else if (phone.length === 9) {
        // Assume it's a UAE mobile without country code
        properties.phone = '+971' + phone;
      } else {
        properties.phone = '+971' + phone;
      }
    }
    
    // Map location if present
    if (formData.location || formData.Location) {
      properties.city = formData.location || formData.Location;
    }
    
    // Map any fitness goal or other custom fields to notes
    let notes = [];
    
    // Handle Gender field
    if (formData.Gender || formData.gender) {
      const gender = formData.Gender || formData.gender;
      notes.push(`Gender: ${gender}`);
    }
    
    // Handle Goal field (including "Goal [Webflow Test]" format)
    const goalField = formData.goal || formData['Goal [Webflow Test]'] || formData['Fitness Goal'];
    if (goalField) {
      let goalText = goalField;
      
      // Convert goal values to readable text if needed
      switch(goalField.toLowerCase()) {
        case 'lose-weight':
        case 'lose weight':
          goalText = 'Lose weight';
          break;
        case 'improve-health':
        case 'improve health':
          goalText = 'Improve health';
          break;
        case 'build-muscle':
        case 'build muscle':
          goalText = 'Build muscle';
          break;
        case 'not-sure':
        case 'not sure':
          goalText = 'Not sure';
          break;
        default:
          goalText = goalField; // Use as-is if not a predefined value
      }
      notes.push(`Fitness Goal: ${goalText}`);
    }
    
    // Add page submitted information if available
    if (formData['Page submitted on']) {
      notes.push(`Submitted from: ${formData['Page submitted on']}`);
    }
    
    // Add location if present
    if (formData.location || formData.Location) {
      const location = formData.location || formData.Location;
      properties.city = location;
      notes.push(`Location: ${location}`);
    }
    
    // Combine notes
    if (notes.length > 0) {
      properties.notes = notes.join(' | ');
    }
    
    // Log what we're sending to HubSpot
    console.log('Sending to HubSpot:', JSON.stringify(properties, null, 2));
    
    // Check if we have minimum required data
    if (!properties.email) {
      console.error('ERROR: No email found in submission');
      // Still return 200 to prevent Webflow error
      return res.status(200).end();
    }
    
    // Send to HubSpot
    const hubspotResponse = await axios({
      method: 'POST',
      url: 'https://api.hubapi.com/crm/v3/objects/contacts',
      headers: {
        'Authorization': `Bearer ${process.env.HUBSPOT_API_KEY}`,
        'Content-Type': 'application/json'
      },
      data: { properties },
      validateStatus: function (status) {
        // Don't throw error for duplicate contacts (409)
        return status < 500;
      }
    });
    
    if (hubspotResponse.status === 409) {
      console.log('Contact already exists, updating instead...');
      
      // Try to update existing contact
      try {
        // First search for the contact
        const searchResponse = await axios({
          method: 'POST',
          url: 'https://api.hubapi.com/crm/v3/objects/contacts/search',
          headers: {
            'Authorization': `Bearer ${process.env.HUBSPOT_API_KEY}`,
            'Content-Type': 'application/json'
          },
          data: {
            filterGroups: [{
              filters: [{
                propertyName: 'email',
                operator: 'EQ',
                value: properties.email
              }]
            }]
          }
        });
        
        if (searchResponse.data.results && searchResponse.data.results.length > 0) {
          const contactId = searchResponse.data.results[0].id;
          
          // Update the existing contact
          await axios({
            method: 'PATCH',
            url: `https://api.hubapi.com/crm/v3/objects/contacts/${contactId}`,
            headers: {
              'Authorization': `Bearer ${process.env.HUBSPOT_API_KEY}`,
              'Content-Type': 'application/json'
            },
            data: { properties }
          });
          
          console.log('Updated existing contact:', contactId);
        }
      } catch (updateError) {
        console.error('Error updating contact:', updateError.message);
      }
    } else if (hubspotResponse.status === 201) {
      console.log('SUCCESS: Contact created with ID:', hubspotResponse.data.id);
    } else {
      console.log('HubSpot Response Status:', hubspotResponse.status);
      console.log('HubSpot Response:', hubspotResponse.data);
    }
    
    // CRITICAL: Return empty 200 response for Webflow
    // This prevents the "Form Submission Failed" message
    return res.status(200).end();
    
  } catch (error) {
    console.error('=== ERROR ===');
    console.error('Error Type:', error.name);
    console.error('Error Message:', error.message);
    
    if (error.response) {
      console.error('HubSpot Error Status:', error.response.status);
      console.error('HubSpot Error Data:', JSON.stringify(error.response.data, null, 2));
      
      // Log specific field errors if present
      if (error.response.data && error.response.data.message) {
        console.error('HubSpot Message:', error.response.data.message);
      }
    }
    
    console.error('Full Error:', error);
    
    // IMPORTANT: Still return 200 to prevent Webflow from showing error
    // This ensures users don't see "Form Submission Failed"
    return res.status(200).end();
  }
};
