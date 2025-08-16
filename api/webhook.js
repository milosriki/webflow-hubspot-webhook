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
    // Log incoming request
    console.log('=== NEW FORM SUBMISSION ===');
    console.log('Time:', new Date().toISOString());
    
    // Extract form data
    const formData = req.body.data || req.body || {};
    
    // Log the EXACT form structure
    console.log('FORM TYPE DETECTION:');
    console.log('Form Fields Present:', Object.keys(formData));
    console.log('Full Form Data:', JSON.stringify(formData, null, 2));
    
    // Initialize HubSpot properties
    const properties = {};
    const customFields = {};
    
    // SMART FIELD MAPPING - Check every field and map intelligently
    Object.keys(formData).forEach(fieldName => {
      const fieldValue = formData[fieldName];
      const fieldNameLower = fieldName.toLowerCase();
      
      // Skip empty values
      if (!fieldValue || fieldValue === '') return;
      
      // EMAIL DETECTION
      if (fieldNameLower.includes('email') || fieldNameLower.includes('e-mail')) {
        properties.email = fieldValue.toLowerCase().trim();
      }
      // PHONE DETECTION
      else if (fieldNameLower.includes('phone') || fieldNameLower.includes('mobile') || 
               fieldNameLower.includes('tel') || fieldNameLower.includes('contact')) {
        let phone = fieldValue.toString().replace(/[\s\-\(\)\.]/g, '');
        
        // UAE phone formatting
        if (!phone.startsWith('+')) {
          if (phone.startsWith('00971')) {
            phone = '+' + phone.substring(2);
          } else if (phone.startsWith('971')) {
            phone = '+' + phone;
          } else if (phone.startsWith('0') && phone.length === 10) {
            phone = '+971' + phone.substring(1);
          } else if (phone.length === 9 && !phone.startsWith('0')) {
            phone = '+971' + phone;
          }
        }
        properties.phone = phone;
      }
      // FIRST NAME DETECTION
      else if (fieldNameLower === 'first name' || fieldNameLower === 'firstname' || 
               fieldNameLower === 'first_name' || fieldNameLower === 'fname' ||
               fieldNameLower === 'given name' || fieldNameLower === 'prenom') {
        properties.firstname = fieldValue.trim();
      }
      // LAST NAME DETECTION
      else if (fieldNameLower === 'last name' || fieldNameLower === 'lastname' || 
               fieldNameLower === 'last_name' || fieldNameLower === 'lname' ||
               fieldNameLower === 'surname' || fieldNameLower === 'family name') {
        properties.lastname = fieldValue.trim();
      }
      // FULL NAME DETECTION
      else if (fieldNameLower === 'name' || fieldNameLower === 'full name' || 
               fieldNameLower === 'fullname' || fieldNameLower === 'your name') {
        // Split full name
        const nameParts = fieldValue.trim().split(' ');
        if (!properties.firstname) {
          properties.firstname = nameParts[0];
        }
        if (!properties.lastname && nameParts.length > 1) {
          properties.lastname = nameParts.slice(1).join(' ');
        }
      }
      // COMPANY DETECTION
      else if (fieldNameLower.includes('company') || fieldNameLower.includes('organization') || 
               fieldNameLower.includes('business')) {
        properties.company = fieldValue.trim();
      }
      // LOCATION/CITY DETECTION
      else if (fieldNameLower.includes('location') || fieldNameLower.includes('city') || 
               fieldNameLower.includes('area') || fieldNameLower.includes('region') ||
               fieldNameLower.includes('dubai') || fieldNameLower.includes('emirate')) {
        properties.city = fieldValue.trim();
        customFields['Location'] = fieldValue.trim();
      }
      // WEBSITE DETECTION
      else if (fieldNameLower.includes('website') || fieldNameLower.includes('url') || 
               fieldNameLower.includes('site')) {
        properties.website = fieldValue.trim();
      }
      // JOB TITLE DETECTION
      else if (fieldNameLower.includes('job') || fieldNameLower.includes('title') || 
               fieldNameLower.includes('position') || fieldNameLower.includes('role')) {
        properties.jobtitle = fieldValue.trim();
      }
      // STATE/REGION DETECTION
      else if (fieldNameLower.includes('state') || fieldNameLower.includes('province')) {
        properties.state = fieldValue.trim();
      }
      // ZIP/POSTAL CODE DETECTION
      else if (fieldNameLower.includes('zip') || fieldNameLower.includes('postal')) {
        properties.zip = fieldValue.trim();
      }
      // ADDRESS DETECTION
      else if (fieldNameLower.includes('address') || fieldNameLower.includes('street')) {
        properties.address = fieldValue.trim();
      }
      // COUNTRY DETECTION
      else if (fieldNameLower.includes('country')) {
        properties.country = fieldValue.trim();
      }
      // MESSAGE/NOTES DETECTION
      else if (fieldNameLower.includes('message') || fieldNameLower.includes('comment') || 
               fieldNameLower.includes('note') || fieldNameLower.includes('details') ||
               fieldNameLower.includes('description')) {
        customFields['Message'] = fieldValue.trim();
      }
      // GENDER DETECTION
      else if (fieldNameLower.includes('gender') || fieldNameLower.includes('sex')) {
        customFields['Gender'] = fieldValue.trim();
      }
      // GOAL/FITNESS GOAL DETECTION
      else if (fieldNameLower.includes('goal') || fieldNameLower.includes('objective') || 
               fieldNameLower.includes('purpose') || fieldNameLower.includes('interest')) {
        let goalText = fieldValue;
        const goalLower = fieldValue.toString().toLowerCase().replace(/[-_]/g, ' ');
        
        // Standardize common fitness goals
        if (goalLower.includes('lose') && goalLower.includes('weight')) {
          goalText = 'Lose weight';
        } else if (goalLower.includes('improve') && goalLower.includes('health')) {
          goalText = 'Improve health';
        } else if (goalLower.includes('build') && goalLower.includes('muscle')) {
          goalText = 'Build muscle';
        } else if (goalLower.includes('not') && goalLower.includes('sure')) {
          goalText = 'Not sure';
        } else if (goalLower.includes('fitness')) {
          goalText = 'General fitness';
        } else if (goalLower.includes('strength')) {
          goalText = 'Build strength';
        } else if (goalLower.includes('endurance')) {
          goalText = 'Improve endurance';
        }
        
        customFields['Goal'] = goalText;
      }
      // AGE DETECTION
      else if (fieldNameLower.includes('age') || fieldNameLower === 'dob' || 
               fieldNameLower.includes('birth')) {
        customFields['Age'] = fieldValue.trim();
      }
      // BUDGET DETECTION
      else if (fieldNameLower.includes('budget') || fieldNameLower.includes('price')) {
        customFields['Budget'] = fieldValue.trim();
      }
      // PREFERRED TIME DETECTION
      else if (fieldNameLower.includes('time') || fieldNameLower.includes('schedule') || 
               fieldNameLower.includes('availability')) {
        customFields['Preferred Time'] = fieldValue.trim();
      }
      // SOURCE/REFERRAL DETECTION
      else if (fieldNameLower.includes('source') || fieldNameLower.includes('referral') || 
               fieldNameLower.includes('how did you hear')) {
        customFields['Source'] = fieldValue.trim();
      }
      // PAGE SUBMITTED DETECTION
      else if (fieldNameLower.includes('page') || fieldNameLower.includes('submitted')) {
        customFields['Page'] = fieldValue.trim();
      }
      // SERVICE TYPE DETECTION
      else if (fieldNameLower.includes('service') || fieldNameLower.includes('package') || 
               fieldNameLower.includes('plan')) {
        customFields['Service Interest'] = fieldValue.trim();
      }
      // EXPERIENCE LEVEL DETECTION
      else if (fieldNameLower.includes('experience') || fieldNameLower.includes('level')) {
        customFields['Experience Level'] = fieldValue.trim();
      }
      // ALL OTHER FIELDS - Store as custom fields
      else {
        customFields[fieldName] = fieldValue;
      }
    });
    
    // BUILD COMPREHENSIVE NOTES FIELD from all custom fields
    const notesArray = [];
    
    // Add all custom fields to notes
    Object.keys(customFields).forEach(key => {
      if (customFields[key]) {
        notesArray.push(`${key}: ${customFields[key]}`);
      }
    });
    
    // Add form metadata
    notesArray.push(`Form submitted: ${new Date().toISOString()}`);
    notesArray.push(`Form fields: ${Object.keys(formData).join(', ')}`);
    
    // Combine all notes
    if (notesArray.length > 0) {
      properties.notes = notesArray.join(' | ');
    }
    
    // Set defaults if missing
    if (!properties.company) {
      properties.company = 'PTD FITNESS';
    }
    
    // Handle missing names
    if (!properties.firstname && !properties.lastname) {
      // Try to extract from email
      if (properties.email) {
        const emailName = properties.email.split('@')[0];
        const nameParts = emailName.replace(/[0-9]/g, '').split(/[._-]/);
        if (nameParts.length > 0) {
          properties.firstname = nameParts[0];
          if (nameParts.length > 1) {
            properties.lastname = nameParts[1];
          }
        }
      }
    }
    
    // Log what we're sending
    console.log('MAPPED TO HUBSPOT:');
    console.log('Standard Properties:', properties);
    console.log('Custom Fields (in notes):', customFields);
    
    // Require email as minimum
    if (!properties.email) {
      console.error('ERROR: No email found in submission');
      console.log('Available fields were:', Object.keys(formData));
      return res.status(200).json({ error: 'No email provided' });
    }
    
    // SMART DUPLICATE HANDLING
    let contactId = null;
    let existingNotes = '';
    
    // Search by email first
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
          }],
          properties: ['email', 'notes']
        }
      });
      
      if (searchResponse.data.results && searchResponse.data.results.length > 0) {
        contactId = searchResponse.data.results[0].id;
        existingNotes = searchResponse.data.results[0].properties.notes || '';
        console.log('Found existing contact by email:', contactId);
      }
    } catch (err) {
      console.log('No existing contact found by email');
    }
    
    // If no email match, try phone
    if (!contactId && properties.phone) {
      try {
        const phoneSearch = await axios({
          method: 'POST',
          url: 'https://api.hubapi.com/crm/v3/objects/contacts/search',
          headers: {
            'Authorization': `Bearer ${process.env.HUBSPOT_API_KEY}`,
            'Content-Type': 'application/json'
          },
          data: {
            filterGroups: [{
              filters: [{
                propertyName: 'phone',
                operator: 'EQ',
                value: properties.phone
              }]
            }],
            properties: ['email', 'notes']
          }
        });
        
        if (phoneSearch.data.results && phoneSearch.data.results.length > 0) {
          contactId = phoneSearch.data.results[0].id;
          existingNotes = phoneSearch.data.results[0].properties.notes || '';
          console.log('Found existing contact by phone:', contactId);
        }
      } catch (err) {
        console.log('No existing contact found by phone');
      }
    }
    
    // UPDATE OR CREATE
    if (contactId) {
      // Merge notes intelligently
      if (existingNotes && properties.notes) {
        // Check if this is a duplicate submission (same form data)
        const isDuplicate = existingNotes.includes(customFields['Goal']) && 
                          existingNotes.includes(customFields['Location']);
        
        if (!isDuplicate) {
          properties.notes = existingNotes + ' | [NEW FORM] ' + properties.notes;
        } else {
          console.log('Duplicate submission detected, keeping existing notes');
          delete properties.notes; // Don't update notes if duplicate
        }
      }
      
      // Update existing contact
      await axios({
        method: 'PATCH',
        url: `https://api.hubapi.com/crm/v3/objects/contacts/${contactId}`,
        headers: {
          'Authorization': `Bearer ${process.env.HUBSPOT_API_KEY}`,
          'Content-Type': 'application/json'
        },
        data: { properties }
      });
      
      console.log('✅ UPDATED contact:', contactId);
    } else {
      // Create new contact
      const createResponse = await axios({
        method: 'POST',
        url: 'https://api.hubapi.com/crm/v3/objects/contacts',
        headers: {
          'Authorization': `Bearer ${process.env.HUBSPOT_API_KEY}`,
          'Content-Type': 'application/json'
        },
        data: { properties }
      });
      
      console.log('✅ CREATED new contact:', createResponse.data.id);
    }
    
    // Return success for Webflow
    return res.status(200).json({});
    
  } catch (error) {
    console.error('=== ERROR ===');
    console.error('Error:', error.message);
    
    if (error.response) {
      console.error('HubSpot Error:', error.response.data);
    }
    
    // Still return 200 to prevent form error
    return res.status(200).json({});
  }
};
