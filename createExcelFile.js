const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

async function createExcelFile(filePath, dataArray) {
    try {
        // Ensure the directory exists
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        // Remove the 'messageTimestampUnix' column from the dataArray and map the keys to desired headers
        const filteredDataArray = dataArray.map(({ messageTimestampUnix, ...rest }) => ({
            TimeDate: rest.timedate,
            From: rest.from,
            To: rest.to,
            Message: rest.messagebody,
            Type: rest.type,
            'Message Code': rest.message_code
        }));

        const worksheet = XLSX.utils.json_to_sheet(filteredDataArray);

        // Set the column widths
        worksheet['!cols'] = [
            { wch: 19 },  // TimeDate
            { wch: 18 },  // From
            { wch: 18 },  // To
            { wch: 50 },  // Message (medium width)
            { wch: 15 },  // Type
            { wch: 5 },  // Message Code (smaller width)
        ];

        // Define the header style
        const headerStyle = { font: { bold: true } };

        // Apply the header style to the first row
        const headers = ['A1', 'B1', 'C1', 'D1', 'E1', 'F1'];
        headers.forEach(header => {
            if (worksheet[header]) {
                worksheet[header].s = headerStyle;
            }
        });

        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Messages');

        const filename = path.resolve(filePath); // Get absolute path
        XLSX.writeFile(workbook, filename);

        console.log(`Excel file created at ${filename}`);
        return filename;
    } catch (error) {
        console.error('Error creating Excel file:', error.message);
    }
}

module.exports = { createExcelFile };
