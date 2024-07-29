const fs = require('fs');
const path = require('path');
const moment = require("moment");
const tz = require("moment-timezone");
const { uploadFile } = require('./upload')

const mime = require('mime-types');

async function handle_message(message, client, mediaFolderPath, userToken, email) {
    try {
        const message_code = message.id.id;
        const timedate = moment(message.timestamp * 1000).tz("Asia/Kolkata").format("DD-MM-YYYY HH:mm:ss");
        let messagebody = message.body;
        messagebody = messagebody.replace(/[\u2019]/g, "'");
        let from = "";
        let to = "";
        let type = "";
        let link = '';
        let fileSize = '';

        console.log(`Processing message with ID: ${message_code}`);

        if (!message.fromMe) {
            if (message.from.includes("@g.us")) {
                const t1 = await message.author;
                from = t1.replace("@c.us", "");
                const groupMetadata = await client.getChatById(await message.from);
                to = await groupMetadata.name;
            } else if (message.from.includes("@c.us")) {
                const t1 = await message.from;
                from = t1.replace("@c.us", "");
                to = await message.to.replace("@c.us", "");
            }
        } else if (message.fromMe) {
            if (message.to.includes("@g.us")) {
                const groupMetadata = await client.getChatById(message.to);
                to = await groupMetadata.name;
                from = await client.info.wid._serialized.replace("@c.us", "");
            } else if (message.to.includes("@c.us")) {
                const t1 = await message.to;
                to = t1.replace("@c.us", "");
                from = await client.info.wid._serialized.replace("@c.us", "");
            }
        }

        if (message.location) {
            const { description, latitude, longitude } = message.location;
            messagebody = `Place:${description} Latitude:${latitude} Longitude:${longitude}`;
        }

        if (message.hasMedia && !message.isGif) {
            try {
              console.log(`Downloading media for message with ID: ${message_code}`);
              messagebody = "MEDIA FILE";
              const media = await message.downloadMedia();
              const mediaBuffer = Buffer.from(media.data, 'base64');
              const mediaType = await media.mimetype;
              const file_extension = mime.extension(mediaType);
              if (!file_extension) {
                console.error('Unable to determine file extension');
                return;
              }
              const timestampFormatted = `${timedate.replace(/:/g, '')}_${Math.random().toString(36).substring(2, 5)}`;
              const fileName = media.filename?`${media.filename.slice(0, 200)}_${timestampFormatted}.${file_extension}`:`${timestampFormatted}.${file_extension}`;
              const localFilePath = path.join(mediaFolderPath, fileName);
              const fileSizeInBytes = await media.filesize;
              fileSize = (fileSizeInBytes / (1024 * 1024)).toFixed(2);
          
              // Save the file locally
              await fs.promises.writeFile(localFilePath, mediaBuffer);
              console.log(`Media saved locally at: ${localFilePath}`);
          
              // Upload media to Google Drive
              const driveLink = await uploadFile(email, localFilePath, mediaType, userToken);
              link = `https://drive.google.com/file/d/${driveLink}`;
              console.log(`Media uploaded to Drive: ${link}`);
          
              // Delete the local file after uploading
              await fs.promises.unlink(localFilePath);
              console.log(`Local file deleted: ${localFilePath}`);
          
            } catch (er) {
              console.error('Error handling media:', er);
            }
          }

        if (message.type === "revoked") {
            messagebody = "MESSAGE DELETED";
        }

        if (message.hasQuotedMsg) {
            const quotedMessage = await message.getQuotedMessage();
            type = `Reply:${quotedMessage.id.id}`;
        }

        console.log(`Processed message with ID: ${message_code} | From: ${from} | To: ${to} | Body: ${messagebody}`);

        return { timedate, from, to, link, type, link, fileSize, message_code };
    } catch (er) {
        console.error('Error processing message:', er);
    }
}

module.exports = { handle_message };
