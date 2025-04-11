function doGet(e) {
  try {
    // First check if e exists
    if (!e) {
      Logger.log('No event object received');
      return ContentService
        .createTextOutput(JSON.stringify({
          status: 'error',
          message: 'No parameters received'
        }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    // Check if this is a request to fetch comments
    if (e.parameter && e.parameter.action === "getComments") {
      Logger.log('Received request for comments with callback: ' + e.parameter.callback);
      return getCommentsFromSheet(e.parameter.callback);
    }
    
    // Otherwise, process as a form submission
    // Get parameters from the URL with safety checks
    var params = e.parameter || {};
    Logger.log('Parameters received: ' + JSON.stringify(params));
    
    const name = params.name || '';
    const email = params.email || '';
    const phone = params.phone || '';
    const comment = params.comment || '';
    
    // Log the data
    Logger.log('Processing data:');
    Logger.log('Name: ' + name);
    Logger.log('Email: ' + email);
    Logger.log('Phone: ' + phone);
    Logger.log('Comment: ' + comment);
    
    // Open the Google Sheet by ID
    const ss = SpreadsheetApp.openById('1aR-Qqt7vzd4PffYCPZlZJ0hCK6q_xlGBiBQ_nDMQu5Y');
    const sheet = ss.getSheets()[0]; // Use the first sheet
    
    // Add data to the sheet
    sheet.appendRow([
      name,
      email,
      phone,
      comment,
      new Date().toISOString()
    ]);
    
    // Create response - no need for CORS headers with JSONP
    return ContentService
      .createTextOutput(JSON.stringify({
        status: 'success',
        message: 'Data successfully recorded'
      }))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    // Log the error
    Logger.log('Error: ' + error.toString());
    
    // Create error response
    return ContentService
      .createTextOutput(JSON.stringify({
        status: 'error',
        message: error.toString()
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doPost(e) {
  return doGet(e); // Handle POST requests the same way
}

// Function to get comments from the spreadsheet
function getCommentsFromSheet(callback) {
  // Sanitize callback parameter to prevent injection
  if (callback) {
    Logger.log('Sanitizing callback: ' + callback);
    // Only allow alphanumeric characters, underscores and dots in callback name
    callback = callback.replace(/[^\w\d_.]/g, '');
    if (!callback) {
      callback = null; // If sanitization removes everything, don't use callback
      Logger.log('Callback was invalid and has been nullified');
    } else {
      Logger.log('Sanitized callback: ' + callback);
    }
  }
  
  try {
    Logger.log('Fetching comments from spreadsheet');
    
    // Open the Google Sheet by ID
    const ss = SpreadsheetApp.openById('1aR-Qqt7vzd4PffYCPZlZJ0hCK6q_xlGBiBQ_nDMQu5Y');
    const sheet = ss.getSheets()[0]; // Use the first sheet
    
    // Get all data from the sheet
    const lastRow = sheet.getLastRow();
    Logger.log('Sheet has ' + lastRow + ' rows');
    
    // If sheet is empty (only has header row or is completely empty)
    if (lastRow <= 1) {
      Logger.log('No data in sheet (only header or empty)');
      return createResponse({
        status: 'success',
        comments: []
      }, callback);
    }
    
    // Get all data excluding headers
    const data = sheet.getRange(2, 1, lastRow - 1, 5).getValues(); // Get 5 columns (name, email, phone, comment, timestamp)
    Logger.log('Retrieved ' + data.length + ' rows from sheet');
    
    // Process data to extract only entries with comments
    const comments = [];
    
    data.forEach(function(row) {
      const name = row[0];     // Name is in first column
      const comment = row[3];  // Comment is in fourth column
      const timestamp = row[4]; // Timestamp is in fifth column
      
      // Only include entries that have comments
      if (comment && comment.trim() !== '') {
        comments.push({
          name: name,
          date: formatDate(timestamp),
          text: comment
        });
      }
    });
    
    Logger.log('Processed ' + comments.length + ' comments');
    
    // Sort comments by date (newest first)
    comments.sort(function(a, b) {
      return new Date(b.date) - new Date(a.date);
    });
    
    // Limit to most recent 10 comments to keep response size manageable
    const recentComments = comments.slice(0, 10);
    
    Logger.log('Returning ' + recentComments.length + ' recent comments');
    // Return the comments as JSON
    return createResponse({
      status: 'success',
      comments: recentComments
    }, callback);
      
  } catch (error) {
    Logger.log('Error fetching comments: ' + error.toString());
    Logger.log('Stack trace: ' + error.stack);
    
    return createResponse({
      status: 'error',
      message: error.toString(),
      comments: []
    }, callback);
  }
}

// Helper function to format date in a readable format
function formatDate(dateString) {
  try {
    const date = new Date(dateString);
    
    // Check if date is valid
    if (isNaN(date.getTime())) {
      return "Unknown date";
    }
    
    const monthNames = ["January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"];
    
    return monthNames[date.getMonth()] + " " + date.getDate() + ", " + date.getFullYear();
  } catch (e) {
    return "Unknown date";
  }
}

// Helper function to create appropriate response (JSON or JSONP)
function createResponse(responseObject, callback) {
  if (callback) {
    // Return JSONP response with callback
    Logger.log('Creating JSONP response with callback: ' + callback);
    return ContentService
      .createTextOutput(callback + '(' + JSON.stringify(responseObject) + ')')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  } else {
    // Return regular JSON response
    Logger.log('Creating JSON response (no callback)');
    return ContentService
      .createTextOutput(JSON.stringify(responseObject))
      .setMimeType(ContentService.MimeType.JSON);
  }
}