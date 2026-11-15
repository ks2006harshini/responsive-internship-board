
require("dotenv").config();

const express = require("express");
const path = require("path");
const db = require("./database/db");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: "10kb" }));

// Convert database row into frontend format
function formatInternship(row) {
    return {
        ...row,
        skills: JSON.parse(row.skills)
    };
}

// Standard API response
function sendResponse(res, status, message, data = null, pagination = null) {
    return res.status(status).json({
        status: status >= 400 ? "error" : "success",
        message,
        data,
        pagination
    });
}

// Validate internship details
function validateInternship(body = {}) {
    const { id, title, domain, mode, location, skills, openings } = body;

    if (
        typeof id !== "string" ||
        !id.trim() ||
        typeof title !== "string" ||
        !title.trim() ||
        typeof domain !== "string" ||
        !domain.trim() ||
        typeof mode !== "string" ||
        !mode.trim() ||
        typeof location !== "string" ||
        !location.trim() ||
        !Array.isArray(skills) ||
        !skills.every(skill => typeof skill === "string") ||
        !Number.isInteger(openings) ||
        openings < 0
    ) {
        return "Please provide valid internship details.";
    }

    return null;
}

// Validate portfolio URL
function validPortfolioURL(value) {
    if (!value) return true;

    try {
        const url = new URL(value);

        return (
            ["http:", "https:"].includes(url.protocol) &&
            !url.username &&
            !url.password
        );
    } catch {
        return false;
    }
}

// GET: Display all internships with pagination
app.get("/api/internships", async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page, 10) || 1);
        const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10));

        const countResult = await db.execute(
            "SELECT COUNT(*) AS count FROM internships"
        );

        const total = Number(countResult.rows[0].count);

        const result = await db.execute({
            sql: `
                SELECT * FROM internships
                ORDER BY id
                LIMIT ? OFFSET ?
            `,
            args: [limit, (page - 1) * limit]
        });

        const data = result.rows.map(formatInternship);

        return res.json({
            status: "success",
            data,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error("GET internships error:", error.message);
        return sendResponse(res, 500, "Unable to load internships.");
    }
});

// GET: Display one internship
app.get("/api/internships/:id", async (req, res) => {
    try {
        const result = await db.execute({
            sql: "SELECT * FROM internships WHERE id = ?",
            args: [req.params.id]
        });

        const row = result.rows[0];

        if (!row) {
            return sendResponse(res, 404, "Internship not found.");
        }

        return sendResponse(
            res,
            200,
            "Internship found.",
            formatInternship(row)
        );
    } catch (error) {
        console.error("GET internship error:", error.message);
        return sendResponse(res, 500, "Unable to load internship.");
    }
});

// POST: Create a new internship
app.post("/api/internships", async (req, res) => {
    const error = validateInternship(req.body);

    if (error) {
        return sendResponse(res, 400, error);
    }

    const { id, title, domain, mode, location, skills, openings } = req.body;

    try {
        await db.execute({
            sql: `
                INSERT INTO internships
                (id, title, domain, mode, location, skills, openings)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `,
            args: [
                id.trim(),
                title.trim(),
                domain.trim(),
                mode.trim(),
                location.trim(),
                JSON.stringify(skills),
                openings
            ]
        });

        const result = await db.execute({
            sql: "SELECT * FROM internships WHERE id = ?",
            args: [id.trim()]
        });

        return sendResponse(
            res,
            201,
            "Internship created successfully.",
            formatInternship(result.rows[0])
        );
    } catch (error) {
        if (error.message.includes("UNIQUE") ||
            error.message.includes("PRIMARY KEY")) {
            return sendResponse(res, 409, "Internship ID already exists.");
        }

        console.error("POST internship error:", error.message);
        return sendResponse(res, 500, "Unable to create internship.");
    }
});

// PUT: Update an internship
app.put("/api/internships/:id", async (req, res) => {
    const error = validateInternship({
        ...req.body,
        id: req.params.id
    });

    if (error) {
        return sendResponse(res, 400, error);
    }

    const { title, domain, mode, location, skills, openings } = req.body;

    try {
        const result = await db.execute({
            sql: `
                UPDATE internships
                SET title = ?, domain = ?, mode = ?,
                    location = ?, skills = ?, openings = ?
                WHERE id = ?
            `,
            args: [
                title.trim(),
                domain.trim(),
                mode.trim(),
                location.trim(),
                JSON.stringify(skills),
                openings,
                req.params.id
            ]
        });

        if (result.rowsAffected === 0) {
            return sendResponse(res, 404, "Internship not found.");
        }

        const updated = await db.execute({
            sql: "SELECT * FROM internships WHERE id = ?",
            args: [req.params.id]
        });

        return sendResponse(
            res,
            200,
            "Internship updated successfully.",
            formatInternship(updated.rows[0])
        );
    } catch (error) {
        console.error("PUT internship error:", error.message);
        return sendResponse(res, 500, "Unable to update internship.");
    }
});

// DELETE: Delete an internship
app.delete("/api/internships/:id", async (req, res) => {
    try {
        // Check whether applications exist
        const applications = await db.execute({
            sql: "SELECT id FROM applications WHERE internship_id = ? LIMIT 1",
            args: [req.params.id]
        });

        if (applications.rows.length > 0) {
            return sendResponse(
                res,
                409,
                "Cannot delete this internship because applications exist."
            );
        }

        const result = await db.execute({
            sql: "DELETE FROM internships WHERE id = ?",
            args: [req.params.id]
        });

        if (result.rowsAffected === 0) {
            return sendResponse(res, 404, "Internship not found.");
        }

        return sendResponse(
            res,
            200,
            "Internship deleted successfully."
        );
    } catch (error) {
        console.error("DELETE internship error:", error.message);
        return sendResponse(res, 500, "Unable to delete internship.");
    }
});

// POST: Submit an application
app.post("/api/applications", async (req, res) => {
    const { internshipId, name, email, portfolioUrl } = req.body || {};

    if (
        typeof internshipId !== "string" ||
        !internshipId.trim() ||
        typeof name !== "string" ||
        name.trim().length < 2 ||
        name.trim().length > 80
    ) {
        return sendResponse(res, 400, "Please enter valid application details.");
    }

    if (
        typeof email !== "string" ||
        email.length > 254 ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
    ) {
        return sendResponse(res, 400, "Please enter a valid email address.");
    }

    if (
        portfolioUrl !== undefined &&
        (typeof portfolioUrl !== "string" || !validPortfolioURL(portfolioUrl))
    ) {
        return sendResponse(res, 400, "Please enter a safe HTTP or HTTPS portfolio URL.");
    }

    try {
        const internshipResult = await db.execute({
            sql: "SELECT * FROM internships WHERE id = ?",
            args: [internshipId.trim()]
        });

        const internship = internshipResult.rows[0];

        if (!internship) {
            return sendResponse(res, 404, "Internship not found.");
        }

        if (internship.openings <= 0) {
            return sendResponse(res, 409, "No openings are available.");
        }

        const result = await db.execute({
            sql: `
                INSERT INTO applications
                (internship_id, applicant_name, applicant_email)
                VALUES (?, ?, ?)
            `,
            args: [
                internshipId.trim(),
                name.trim(),
                email.trim().toLowerCase()
            ]
        });

        return sendResponse(
            res,
            201,
            "Application submitted successfully.",
            {
                applicationId: Number(result.lastInsertRowid),
                internshipId,
                applicationStatus: "Submitted"
            }
        );
    } catch (error) {
        if (error.message.includes("UNIQUE")) {
            return sendResponse(
                res,
                409,
                "You have already applied for this internship."
            );
        }

        console.error("POST application error:", error.message);
        return sendResponse(res, 500, "Unable to submit application.");
    }
});

// Prevent access to database folder
app.use("/database", (req, res) => {
    res.status(403).json({
        status: "error",
        message: "Access denied."
    });
});

// Serve frontend files
app.use(express.static(__dirname));

// Handle unknown API routes
app.use("/api", (req, res) => {
    return sendResponse(res, 404, "API endpoint not found.");
});

// Handle invalid JSON and other errors
app.use((err, req, res, next) => {
    if (err instanceof SyntaxError && err.status === 400 && "body" in err) {
        return sendResponse(res, 400, "Invalid JSON request.");
    }

    console.error("Server error:", err.message);
    return sendResponse(res, 500, "Internal server error.");
});

// Start server
app.listen(PORT, "0.0.0.0", () => {
    console.log(`Internship Board running on port ${PORT}`);
});
