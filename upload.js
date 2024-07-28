const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

const CLIENT_ID = '537105498690-rvukqq5ieqde3i664jath4l7su58fvhc.apps.googleusercontent.com';
const CLIENT_SECRET = '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';
const REDIRECT_URL = 'http://localhost:3000/oauth2callback';

// Create a new instance of the OAuth2Client with the stored token
function createDriveInstance(email, userTokens) {
  const oauth2Client = new google.auth.OAuth2(
    CLIENT_ID,
    CLIENT_SECRET,
    REDIRECT_URL
  );

  // Debugging: Log the user tokens
  console.log('User Tokens:', userTokens);

  if (userTokens) {
    oauth2Client.setCredentials(userTokens);
  } else {
    throw new Error('User tokens are undefined or invalid.');
  }

  return google.drive({ version: 'v3', auth: oauth2Client });
}

// Upload function
async function uploadFile(email, filePath, mimeType, userTokens) {
  console.log(userTokens);
  const drive = createDriveInstance(email, userTokens);

  const fileMetadata = {
    name: path.basename(filePath),
  };
  const media = {
    mimeType: mimeType,
    body: fs.createReadStream(filePath),
  };

  try {
    const res = await drive.files.create({
      requestBody: fileMetadata,
      media: media,
      fields: 'id, name',
    });
    console.log(`File uploaded: ${res.data.name} (ID: ${res.data.id})`);
    return res.data.id;
  } catch (error) {
    console.error('Error uploading file:', error);
    throw error;
  }
}

module.exports = {
  uploadFile,
  createDriveInstance
};
