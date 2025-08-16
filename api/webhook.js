// Simple field mapping that matches EXACTLY what HubSpot expects
const hubspotData = {
  properties: {
    // Standard HubSpot fields with exact property names
    email: formData.email || formData.Email || formData.EMAIL || '',
    
    // For name fields, match HubSpot's exact property names
    // If HubSpot uses "first_name" instead of "firstname", use that
    firstname: formData.firstname || formData.firstName || formData.first_name || '',
    lastname: formData.lastname || formData.lastName || formData.last_name || '',
    
    // For phone, use a simple format without special characters
    // If HubSpot uses a different property name, adjust accordingly
    phone: (formData.phone || formData.Phone || formData.phone_number || '').replace(/\D/g, ''),
    
    // Only include fields that actually exist in YOUR HubSpot account
    // If any of these don't exist in your HubSpot, remove them
    company: formData.company || formData.Company || '',
    address: formData.address || formData.Address || '',
    city: formData.city || formData.City || '',
    state: formData.state || formData.State || '',
    zip: formData.zip || formData.Zip || '',
    country: formData.country || formData.Country || '',
  }
};
