const fs = require('fs');
const path = require('path');
const moment = require("moment");
const tz = require("moment-timezone");
const { saveMediaFile } = require('./saveMediaFile');
const mime = require('mime-types');

async function handle_message(message, client, mediaFolderPath) {
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
                let filePath = '';
                if (media.filename) {
                    filePath = path.join(mediaFolderPath, `${media.filename.slice(0, 200)}_${timestampFormatted}.${file_extension}`);
                } else {
                    filePath = path.join(mediaFolderPath, `${message.body.slice(0, 200)}_${timestampFormatted}.${file_extension}`);
                }
                const fileSizeInBytes = await media.filesize;
                fileSize = (fileSizeInBytes / (1024 * 1024)).toFixed(2);

                // Ensure media folder exists
                if (!fs.existsSync(mediaFolderPath)) {
                    fs.mkdirSync(mediaFolderPath, { recursive: true });
                }

                await saveMediaFile(filePath, mediaBuffer);
                console.log(`Media saved: ${filePath}`);
                // link = await authorizeAndUpload(filePath, 'WhatsApp Media'); // Ensure the correct folder ID or name
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

        return { timedate, from, to, messagebody, type, link, fileSize, message_code };
    } catch (er) {
        console.error('Error processing message:', er);
    }
}

module.exports = { handle_message };
