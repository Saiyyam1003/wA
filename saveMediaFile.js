const fs = require('fs');
function saveMediaFile(filePath, mediaBuffer) {
    return new Promise((resolve, reject) => {
        const fileStream = fs.createWriteStream(filePath);
        fileStream.on('finish', () => resolve(filePath));
        fileStream.on('error', (error) => reject(error));
        fileStream.write(mediaBuffer);
        fileStream.end();
    });
}
module.exports = { saveMediaFile };
