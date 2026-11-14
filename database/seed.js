
const db = require("./db");
const fs = require("fs");
const path = require("path");

// Read existing internship records
const filePath = path.join(__dirname, "..", "internships.json");
const fileData = JSON.parse(fs.readFileSync(filePath, "utf8"));

const internships = fileData.internships;

// Insert internship records
const insert = db.prepare(`
    INSERT OR IGNORE INTO internships
    (id, title, domain, mode, location, skills, openings)
    VALUES (?, ?, ?, ?, ?, ?, ?)
`);

const insertMany = db.transaction((records) => {
    for (const item of records) {
        insert.run(
            item.id,
            item.title,
            item.domain,
            item.mode,
            item.location,
            JSON.stringify(item.skills),
            item.openings
        );
    }
});

insertMany(internships);

console.log("Internship records inserted successfully!");

// Display database records
const rows = db.prepare("SELECT * FROM internships").all();

console.log("Total internships:", rows.length);

db.close();
