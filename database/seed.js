
const db = require("./db");
const fs = require("fs");
const path = require("path");

async function seedDatabase() {
    try {
        // Create database tables
        await db.execute(`
            CREATE TABLE IF NOT EXISTS internships (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                domain TEXT NOT NULL,
                mode TEXT NOT NULL,
                location TEXT NOT NULL,
                skills TEXT NOT NULL,
                openings INTEGER NOT NULL DEFAULT 1
            )
        `);

        await db.execute(`
            CREATE TABLE IF NOT EXISTS applications (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                internship_id TEXT NOT NULL,
                applicant_name TEXT NOT NULL,
                applicant_email TEXT NOT NULL,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                UNIQUE (internship_id, applicant_email),
                FOREIGN KEY (internship_id) REFERENCES internships(id)
            )
        `);

        // Read internship records
        const filePath = path.join(__dirname, "..", "internships.json");
        const fileData = JSON.parse(fs.readFileSync(filePath, "utf8"));

        const internships = fileData.internships;

        // Insert internship records
        for (const item of internships) {
            await db.execute({
                sql: `
                    INSERT OR IGNORE INTO internships
                    (id, title, domain, mode, location, skills, openings)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                `,
                args: [
                    item.id,
                    item.title,
                    item.domain,
                    item.mode,
                    item.location,
                    JSON.stringify(item.skills),
                    item.openings
                ]
            });
        }

        console.log("Internship records inserted successfully!");

        // Display total records
        const result = await db.execute(
            "SELECT COUNT(*) AS total FROM internships"
        );

        console.log("Total internships:", result.rows[0].total);

    } catch (error) {
        console.error("Database seeding failed:", error);
        process.exitCode = 1;
    } finally {
        await db.close();
    }
}

seedDatabase();
