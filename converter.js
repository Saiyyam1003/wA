const express = require('express');
const cors = require('cors');
const fs = require('fs');
const qrcode = require('qrcode');
const { Client } = require('whatsapp-web.js');
const path = require('path');
const session = require('express-session'); // Add this line

const { getAuthUrl, setCredentials } = require('./auth.js');
const { uploadFile } = require('./upload.js');
const jwt = require('jsonwebtoken');
const { createZipFile } = require('./createZipFile.js'); // Add this line
const moment = require("moment");
const tz = require("moment-timezone");
const { handle_message } = require('./handle_message');
const { createExcelFile } = require('./createExcelFile');


const app = express();

app.use(express.json());
app.use(cors({
    origin: 'http://localhost:1234', // Your frontend URL
    credentials: true // Allow cookies and credentials
}));
// Adjust origin to your frontend URL


// Initialize express-session
app.use(session({
  secret: 'your-session-secret', // Replace with a strong secret
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false } // Set to true if using HTTPS
}));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

const clients = {};
const isReady = {};
const isAvailable = {};
const phoneNumbers = {};
const userTokens = {};
// Handle timestamps for message processing
let start = Math.floor(Date.now() / 1000) - 24 * 60 * 60;
let end = Math.floor(Date.now() / 1000);

app.get('/auth', (req, res) => {
  const url = getAuthUrl();
  res.redirect(url);
});

app.get('/oauth2callback', async (req, res) => {
  const code = req.query.code;
  try {
    const tokens = await setCredentials(code);

     // Decode the id_token to get user info
     const decodedToken = jwt.decode(tokens.id_token);

     if (decodedToken && decodedToken.email) {
       const userEmail = decodedToken.email;
       console.log(`User Email: ${userEmail}`);
       userTokens[userEmail] = tokens;
       console.log(userTokens[userEmail]);
 
       // Here, you might want to store userEmail in a session or database
       // For example, if using sessions:
       req.session.userEmail = userEmail;
      } else {
        res.status(400).send('Invalid ID token');
      }

    res.redirect('http://localhost:1234'); // Redirect to a page where you can display user info
  } catch (error) {
    res.status(500).send('Authentication failed.');
  }
});


app.get('/user-info', (req, res) => {
  if (req.session.userEmail) {
    res.json({ email: req.session.userEmail });
  } else {
    res.status(401).send('Unauthorized');
  }
});


// Initialize WhatsApp client
const initializeClient = (email, token) => {
  clients[email] = new Client({
    puppeteer: {
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    },
    bypassCSP: true,
    restartOnAuthFail: true,
    webVersionCache: {
      type: 'none',
    }
  });

  clients[email].initialize();

  clients[email].on('ready', async () => {
    console.log(`Client ${email} is ready`);
    isReady[email] = true;
    phoneNumbers[email] = (await clients[email].info.wid)._serialized.replace('@c.us', '');
    console.log(`Phone for ${email}: ${phoneNumbers[email]}`);
    await makeFile(email, clients[email], start, end);
  });

  
  clients[email].on('qr', async (qr) => {
    const qrCodeImage = await qrcode.toDataURL(qr);
    const base64Data = qrCodeImage.replace(/^data:image\/png;base64,/, '');
    const imagePath = path.join(__dirname, `${email}.png`);
    fs.writeFileSync(imagePath, base64Data, 'base64');
    console.log(`QR Code for ${email} updated and saved as ${imagePath}`);
  });
};

// Handle client disconnection
app.post('/disconnect/:email', (req, res) => {
  const email = req.params.email;
  handleClientDisconnection(email); // Assuming you have a function to handle disconnection
  res.send({ message: 'Client disconnected' });
});

// Update handleClientDisconnection function to delete the user's folder and other resources
const handleClientDisconnection = (email) => {
  console.log(`Client ${email} is disconnected`);

  const qrImagePath = path.join(__dirname, `${email}.png`);
  if (fs.existsSync(qrImagePath)) {
    fs.unlinkSync(qrImagePath);
    console.log(`Deleted QR code image for ${email}: ${qrImagePath}`);
  }

  const userFolderPath = path.join(__dirname, email);
  if (fs.existsSync(userFolderPath)) {
    fs.rmdirSync(userFolderPath, { recursive: true });
    console.log(`Deleted user folder for ${email}: ${userFolderPath}`);
  }

  isReady[email] = false;
  isAvailable[email] = false;
};

// Initialize WhatsApp client
app.post('/initialize', (req, res) => {
  const { email, token } = req.body;
  if (!clients[email]) {
    userTokens[email] = token; // Save the token for later use
    initializeClient(email, token);
    res.send({ message: 'Client initialized' });
  } else {
    res.send({ message: 'Client already initialized' });
  }
});

// Get client status
app.get('/status/:email', (req, res) => {
  const email = req.params.email;
  if (isReady[email]) {
    res.status(200).send('ready');
  } else {
    res.status(503).send('not ready');
  }
});

// Get QR code
app.get('/qr/:email', (req, res) => {
  const email = req.params.email;
  const imagePath = path.join(__dirname, `${email}.png`);
  if (fs.existsSync(imagePath)) {
    res.sendFile(imagePath);
  } else {
    res.status(404).send('QR code not found');
  }
});




app.post('/timestamps/:email', (req, res) => {
  const email = req.params.email;
  const { startTimestamp, endTimestamp } = req.body;
  if (startTimestamp && endTimestamp) {
    start = startTimestamp;
    end = endTimestamp;
    console.log(`Start Unix Timestamp for ${email}: ${start}`);
    console.log(`End Unix Timestamp for ${email}: ${end}`);
    res.send({ message: 'Timestamps updated successfully' });
  } else {
    res.status(400).send({ message: 'Invalid timestamps' });
  }
});


// Update /download route
app.get('/download/:email', (req, res) => {
  const email = req.params.email;
  const userFolderPath = path.join(__dirname, email);
  const filePath = path.join(userFolderPath, `${email}.xlsx`);
  
  if (fs.existsSync(filePath)) {
    res.download(filePath, (err) => {
      if (err) {
        console.error(`Error downloading file for ${email}:`, err);
        res.status(500).send('Error downloading file');
      } else {
        console.log('downloading...');
      }
    });
  } else {
    res.status(404).send('Excel file not found');
  }
});

// Optionally update /file-status route
app.get('/file-status/:email', (req, res) => {
  const email = req.params.email;
  if (isAvailable[email]) {
    res.status(200).send('available');
  } else {
    res.status(503).send('not available'); // or some other status code indicating not ready
  }
});


app.post('/upload/:email', async (req, res) => {
  const email = req.params.email;
  const userFolderPath = path.join(__dirname, email);
  const zipFilePath = path.join(__dirname, `${email}.zip`);

  try {
    // Create a zip file of the folder
    await createZipFile(userFolderPath, zipFilePath);

    // Upload the zip file
    const mimeType = 'application/zip';
    const fileId = await uploadFile(email, zipFilePath, mimeType, userTokens[email]);

    res.send({ message: 'Folder uploaded successfully', fileId });
  } catch (error) {
    console.error('Error uploading folder:', error);
    res.status(500).send('Error uploading folder');
  }
});









async function createUserFolder(email){
  const userFolderPath = path.join(__dirname, email);
  if (!fs.existsSync(userFolderPath)) {
    fs.mkdirSync(userFolderPath);
    console.log(`Created folder for ${email}: ${userFolderPath}`);
  }
  return userFolderPath;
};

async function makeFile(email, client, start, end){
  const messageQueue = [];
  mediaFolderPath = await createUserFolder(email);

  const processReaction = async (message) => {
    const reactions = await message.getReactions();
    for (const reaction of reactions) {
      for (const sender of reaction.senders) {
        const messageTimestampUnix = sender.timestamp;
        if (messageTimestampUnix > start && messageTimestampUnix < end) {
          let messagebody = `${sender.reaction}:${message.body}`;
          messagebody = messagebody.replace(/[\u2019]/g, "'");
          let to = "";
          let type = `Reaction`;
          let from = sender.senderId.replace("@c.us", "");
          let message_code = message.id.id;
          const timedate = moment(messageTimestampUnix * 1000).tz("Asia/Kolkata").format("DD-MM-YYYY HH:mm:ss");
          messageQueue.push({ messageTimestampUnix, timedate, from, to, messagebody, type, message_code });
        }
      }
    }
  };

  const processMessage = async (message) => {
    const messageTimestampUnix = message.timestamp;
    if (messageTimestampUnix > start && messageTimestampUnix < end && !message.isGif && !message.from.includes("status@broad") && message.from !== "0@c.us") {
      const messageResult = await handle_message(message, client, mediaFolderPath);
      if (messageResult) {
        const { timedate, from, to, messagebody, type, message_code } = messageResult;
        messageQueue.push({ messageTimestampUnix, timedate, from, to, messagebody, type, message_code });
      }
      else{
          console.log("no message");
      }
    }
  };

  const processChat = async (chat) => {
    const lastmessages = await chat.fetchMessages({ limit: 100000 });
    await Promise.all(lastmessages.map(processMessage));
    await Promise.all(lastmessages.filter((message) => message.hasReaction && message.from !== "@c.us").map(processReaction));
  };

  try {
    const chats = await client.getChats();
    await Promise.all(chats.map(processChat));
    messageQueue.sort((a, b) => a.messageTimestampUnix - b.messageTimestampUnix);
    const fileName = `${email}.xlsx`;
    const filePath = path.join(mediaFolderPath, fileName);
    await createExcelFile(filePath, messageQueue); // Create the Excel file
    console.log(`File created: ${filePath}`);
    // const fileLink = await uploadFileToDrive(email, filePath); // Upload the file to Google Drive
    // console.log(`File uploaded to Drive. Link: ${fileLink}`);
    isAvailable[email] = true;
  } catch (error) {
    console.error('Error creating file:', error);
  }
};









module.exports = app;
