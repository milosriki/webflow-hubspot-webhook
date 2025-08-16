const axios = require("axios");

module.exports = async (req, res) => {
  // Set CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // Handle OPTIONS request
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Method Not Allowed" });
  }

  try {
    console.log("=== WEBHOOK RECEIVED ===");
    console.log("Time:", new Date().toISOString());

    // Get form data from Webflow
    const formData = req.body.data || req.body || {};

    // Log EVERYTHING for debugging
    console.log("RAW FORM DATA:");
    console.log(JSON.stringify(formData, null, 2));
    console.log("FIELD NAMES:", Object.keys(formData));

    // Initialize properties for HubSpot
    const properties = {};
    const unmappedNotes = []; // For fields that don't have a direct HubSpot property

    // Define HubSpot property mappings (use exact internal names)
    const hubspotPropertyMap = {
      email: "email",
      phone: "phone",
      mobile: "phone", // Alias for phone
      firstname: "firstname",
      "first name": "firstname",
      lastname: "lastname",
      "last name": "lastname",
      company: "company",
      city: "city",
      location: "location", // General location field
      gender: "gender", // Assuming 'gender' is the internal name
      goal: "primary_fitness_goal", // Assuming 'primary_fitness_goal' is the internal name
      message: "message",
      comment: "message", // Alias for message
      page: "page",
      service: "service",
      "preferred time": "preferred_time",
      schedule: "preferred_time", // Alias for preferred time
      source: "source",
      referral: "source", // Alias for source
      fbp: "fbp",
      fbc: "fbc",
      canonical_phone: "canonical_phone",
      lead_quality_score: "lead_quality_score",
      location_quality_main: "location_quality_main",
      lead_priority_score: "lead_priority_score",
      location_score: "location_score",
      // Add other custom fields as needed based on your HubSpot properties
      // Example: 'your_custom_field_name_from_webflow': 'your_hubspot_internal_property_name'
    };

    // Process each field from the form
    Object.keys(formData).forEach((fieldName) => {
      const value = formData[fieldName];
      if (value === undefined || value === null || value === "") return; // Skip empty values

      const fieldLower = fieldName.toLowerCase();

      // Map to HubSpot properties
      let mapped = false;
      for (const mapKey in hubspotPropertyMap) {
        if (fieldLower.includes(mapKey)) {
          const hubspotPropName = hubspotPropertyMap[mapKey];
          // Special handling for phone normalization
          if (hubspotPropName === "phone") {
            let phone = String(value).replace(/[^\d+]/g, ""); // Remove non-digits except +
            if (!phone.startsWith("+")) {
              if (phone.startsWith("00971")) phone = "+" + phone.substring(2);
              else if (phone.startsWith("971")) phone = "+" + phone;
              else if (phone.startsWith("0")) phone = "+971" + phone.substring(1);
              else if (phone.length === 9) phone = "+971" + phone; // Assuming 9-digit local numbers are UAE
            }
            properties[hubspotPropName] = phone;
          } else {
            properties[hubspotPropName] = String(value).trim();
          }
          mapped = true;
          break;
        }
      }

      // If not mapped to a specific property, add to unmapped notes
      if (!mapped) {
        unmappedNotes.push(`${fieldName}: ${String(value).trim()}`);
      }
    });

    // Set defaults
    if (!properties.company) {
      properties.company = "PTD FITNESS";
    }

    // Add unmapped fields to hs_content_membership_notes
    if (unmappedNotes.length > 0) {
      properties.hs_content_membership_notes = unmappedNotes.join(" | ");
      console.log("UNMAPPED NOTES CONTENT:", properties.hs_content_membership_notes);
    }

    // Log final properties being sent to HubSpot
    console.log("FINAL HUBSPOT PROPERTIES:");
    console.log(JSON.stringify(properties, null, 2));

    // Validate email (essential for HubSpot contact creation/update)
    if (!properties.email) {
      console.error("NO EMAIL FOUND IN FORM DATA");
      return res.status(400).json({ success: false, error: "Email is required." });
    }

    // HUBSPOT API CALL - Search, Update, or Create
    let contactId = null;
    let existingNotes = "";

    // 1. Try to find existing contact by email
    try {
      const searchResponse = await axios({
        method: "POST",
        url: "https://api.hubapi.com/crm/v3/objects/contacts/search",
        headers: {
          Authorization: `Bearer ${process.env.HUBSPOT_API_KEY}`,
          "Content-Type": "application/json",
        },
        data: {
          filterGroups: [
            {
              filters: [
                {
                  propertyName: "email",
                  operator: "EQ",
                  value: properties.email,
                },
              ],
            },
          ],
          properties: ["hs_content_membership_notes"], // Fetch existing notes
        },
      });

      if (searchResponse.data.results && searchResponse.data.results.length > 0) {
        contactId = searchResponse.data.results[0].id;
        existingNotes = searchResponse.data.results[0].properties.hs_content_membership_notes || "";
        console.log("FOUND EXISTING CONTACT:", contactId);
      }
    } catch (searchErr) {
      console.log("No existing contact found or search error:", searchErr.message);
      // Continue to create if not found
    }

    // Append new unmapped notes to existing ones if contact found and new notes exist
    if (contactId && properties.hs_content_membership_notes) {
      if (existingNotes) {
        properties.hs_content_membership_notes = `${existingNotes} | ${new Date().toISOString()}: ${properties.hs_content_membership_notes}`;
      } else {
        properties.hs_content_membership_notes = `${new Date().toISOString()}: ${properties.hs_content_membership_notes}`;
      }
    }

    // 2. UPDATE or CREATE contact
    if (contactId) {
      // UPDATE existing contact
      const updateResponse = await axios({
        method: "PATCH",
        url: `https://api.hubapi.com/crm/v3/objects/contacts/${contactId}`,
        headers: {
          Authorization: `Bearer ${process.env.HUBSPOT_API_KEY}`,
          "Content-Type": "application/json",
        },
        data: { properties },
      });

      console.log("✅ UPDATED CONTACT:", contactId);
      console.log("Update response status:", updateResponse.status);
    } else {
      // CREATE new contact
      const createResponse = await axios({
        method: "POST",
        url: "https://api.hubapi.com/crm/v3/objects/contacts",
        headers: {
          Authorization: `Bearer ${process.env.HUBSPOT_API_KEY}`,
          "Content-Type": "application/json",
        },
        data: { properties },
      });

      contactId = createResponse.data.id;
      console.log("✅ CREATED CONTACT:", contactId);
      console.log("Create response status:", createResponse.status);
    }

    // Return success response to Webflow
    return res.status(200).json({ success: true, message: "Form submitted successfully!" });
  } catch (error) {
    console.error("ERROR PROCESSING WEBHOOK:", error.message);
    if (error.response) {
      console.error("HubSpot API Error Details:", error.response.data);
      console.error("HubSpot API Error Status:", error.response.status);
    }
    // Return a proper error response to Webflow
    return res.status(500).json({ success: false, error: "Submission failed. Please try again." });
  }
};

