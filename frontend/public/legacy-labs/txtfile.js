const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());
app.use(express.static('public')); // serve static files from 'public' folder

app.post('/saveSummary', (req, res) => {
    const { sid, responseTimes, totalCircles, timeTaken } = req.body;

    const fileName = `${sid}_lab1.txt`;
    const filePath = path.join(__dirname, 'summaries', fileName);

    const dataToSave = `
    SID: ${sid}
    Circles Clicked: ${totalCircles}
    Time Taken: ${timeTaken} seconds
    Response Times: ${JSON.stringify(responseTimes, null, 2)}
    `;

    fs.writeFile(filePath, dataToSave, (err) => {
        if (err) {
            console.error('Error writing file:', err);
            return res.status(500).send('Error saving summary.');
        }
        res.send('Summary saved successfully.');
    });
});

// Ensure the summaries directory exists
fs.mkdir(path.join(__dirname, 'summaries'), { recursive: true }, (err) => {
    if (err) {
        console.error('Error creating summaries directory:', err);
    }
});

app.listen(PORT, () => {
    //console.log(`Server is running on http://localhost:${PORT}`);
    console.log(`Server is running on /downloads`);
});