const axios = require('axios');

module.exports = async (req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // Handle OPTIONS request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'POST') {
    return res.status(405).end();
  }
  
  try {
    console.log('=== WEBHOOK RECEIVED ===');
    console.log('Time:', new Date().toISOString());
    
    // Get form data from Webflow
    const formData = req.body.data || req.body || {};
    
    // Log EVERYTHING for debugging
    console.log('RAW FORM DATA:');
    console.log(JSON.stringify(formData, null, 2));
    console.log('FIELD NAMES:', Object.keys(formData));
    
    // Initialize properties for HubSpot
    const properties = {};
    const notesData = [];
    
    // Process each field from the form
    Object.keys(formData).forEach(fieldName => {
      const value = formData[fieldName];
      if (!value || value === '') return;
      
      const fieldLower = fieldName.toLowerCase();
      
      // MAP STANDARD FIELDS
      if (fieldLower.includes('email')) {
        properties.email = value.toLowerCase().trim();
      }
      else if (fieldLower.includes('phone') || fieldLower.includes('mobile')) {
        let phone = value.toString().replace(/[\s\-\(\)\.]/g, '');
        if (!phone.startsWith('+')) {
          if (phone.startsWith('00971')) phone = '+' + phone.substring(2);
          else if (phone.startsWith('971')) phone = '+' + phone;
          else if (phone.startsWith('0')) phone = '+971' + phone.substring(1);
          else if (phone.length === 9) phone = '+971' + phone;
        }
        properties.phone = phone;
      }
      else if (fieldLower === 'first name' || fieldLower === 'firstname') {
        properties.firstname = value.trim();
      }
      else if (fieldLower === 'last name' || fieldLower === 'lastname') {
        properties.lastname = value.trim();
      }
      else if (fieldLower === 'name' && !properties.firstname) {
        const parts = value.trim().split(' ');
        properties.firstname = parts[0];
        properties.lastname = parts.slice(1).join(' ') || '';
      }
      else if (fieldLower.includes('company')) {
        properties.company = value.trim();
      }
      else if (fieldLower.includes('location') || fieldLower.includes('city')) {
        properties.city = value.trim();
        notesData.push(`Location: ${value.trim()}`);
      }
      else if (fieldLower.includes('website')) {
        properties.website = value.trim();
      }
      
      // ADD ALL CUSTOM FIELDS TO NOTES
      if (fieldLower.includes('gender')) {
        notesData.push(`Gender: ${value}`);
      }
      if (fieldLower.includes('goal')) {
        notesData.push(`Goal: ${value}`);
      }
      if (fieldLower.includes('age')) {
        notesData.push(`Age: ${value}`);
      }
      if (fieldLower.includes('message') || fieldLower.includes('comment')) {
        notesData.push(`Message: ${value}`);
      }
      if (fieldLower.includes('page')) {
        notesData.push(`Page: ${value}`);
      }
      if (fieldLower.includes('service')) {
        notesData.push(`Service: ${value}`);
      }
      if (fieldLower.includes('time') || fieldLower.includes('schedule')) {
        notesData.push(`Preferred Time: ${value}`);
      }
      if (fieldLower.includes('source') || fieldLower.includes('referral')) {
        notesData.push(`Source: ${value}`);
      }
      
      // Catch any field not already mapped
      const standardFields = ['email', 'phone', 'first', 'last', 'name', 'company', 'location', 'city', 'website'];
      const isStandard = standardFields.some(f => fieldLower.includes(f));
      
      if (!isStandard) {
        notesData.push(`${fieldName}: ${value}`);
      }
    });
    
    // Set defaults
    if (!properties.company) {
      properties.company = 'PTD FITNESS';
    }
    
    // COMBINE ALL NOTES - THIS IS CRITICAL!
    if (notesData.length > 0) {
      properties.notes = notesData.join(' | ');
      console.log('NOTES FIELD CONTENT:', properties.notes);
    } else {
      // Even if no custom data, add timestamp
      properties.notes = `Form submitted: ${new Date().toISOString()}`;
    }
    
    // Log final properties
    console.log('FINAL HUBSPOT PROPERTIES:');
    console.log(JSON.stringify(properties, null, 2));
    
    // Validate email
    if (!properties.email) {
      console.error('NO EMAIL FOUND');
      return res.status(200).json({ error: 'No email' });
    }
    
    // HUBSPOT API CALL
    let contactId = null;
    
    // First try to find existing contact
    try {
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
        contactId = searchResponse.data.results[0].id;
        const existingNotes = searchResponse.data.results[0].properties.notes || '';
        
        // Append to existing notes
        if (existingNotes && properties.notes) {
          properties.notes = existingNotes + ' | [NEW SUBMISSION] ' + properties.notes;
        }
        
        console.log('FOUND EXISTING CONTACT:', contactId);
      }
    } catch (searchErr) {
      console.log('No existing contact');
    }
    
    // UPDATE or CREATE
    if (contactId) {
      // UPDATE existing
      const updateResponse = await axios({
        method: 'PATCH',
        url: `https://api.hubapi.com/crm/v3/objects/contacts/${contactId}`,
        headers: {
          'Authorization': `Bearer ${process.env.HUBSPOT_API_KEY}`,
          'Content-Type': 'application/json'
        },
        data: { properties }
      });
      
      console.log('✅ UPDATED CONTACT:', contactId);
      console.log('Update response:', updateResponse.data);
    } else {
      // CREATE new
      const createResponse = await axios({
        method: 'POST',
        url: 'https://api.hubapi.com/crm/v3/objects/contacts',
        headers: {
          'Authorization': `Bearer ${process.env.HUBSPOT_API_KEY}`,
          'Content-Type': 'application/json'
        },
        data: { properties }
      });
      
      console.log('✅ CREATED CONTACT:', createResponse.data.id);
      console.log('Create response:', createResponse.data);
    }
    
    // Return success
    return res.status(200).json({});
    
  } catch (error) {
    console.error('ERROR:', error.message);
    if (error.response) {
      console.error('HubSpot Error:', error.response.data);
    }
    return res.status(200).json({});
  }
};
