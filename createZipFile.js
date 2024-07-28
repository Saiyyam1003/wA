const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

async function createZipFile(directoryPath, outputFilePath) {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(outputFilePath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', () => {
      console.log(`${archive.pointer()} total bytes`);
      console.log('Archiver has been finalized and the output file descriptor has closed.');
      resolve(outputFilePath); // Resolve with the path of the created zip file
    });

    archive.on('error', (err) => {
      reject(err); // Reject with error if archiving fails
    });

    archive.pipe(output);
    archive.directory(directoryPath, false);
    archive.finalize();
  });
}

module.exports = { createZipFile };
