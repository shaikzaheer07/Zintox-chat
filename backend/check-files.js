// backend/check-files.js
const fs = require('fs');

console.log('Files in routes folder:');
fs.readdirSync('./routes').forEach(file => {
    console.log(`- ${file}`);
});

console.log('\nFiles in models folder:');
fs.readdirSync('./models').forEach(file => {
    console.log(`- ${file}`);
});