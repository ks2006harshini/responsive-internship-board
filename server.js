
const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = 3000;
const ROOT = __dirname;

const seedPath = path.join(ROOT, "internships.json");

const applications = new Set();

const mimeTypes = {
    ".html": "text/html",
    ".css": "text/css",
    ".js": "text/javascript",
    ".json": "application/json"
};

function sendJSON(res, statusCode, body) {
    res.writeHead(statusCode, {
        "Content-Type": "application/json",
        "Cache-Control": "no-store"
    });

    res.end(JSON.stringify(body));
}

function readInternships() {
    const file = fs.readFileSync(seedPath, "utf8");
    const parsed = JSON.parse(file);

    if (!Array.isArray(parsed.internships)) {
        throw new Error("Invalid internship seed.");
    }

    return parsed.internships;
}

function readBody(req) {
    return new Promise((resolve, reject) => {
        let body = "";

        req.on("data", chunk => {
            body += chunk;

            if (body.length > 10000) {
                reject(new Error("Request too large."));
                req.destroy();
            }
        });

        req.on("end", () => {
            try {
                resolve(JSON.parse(body));
            } catch {
                reject(new Error("Invalid JSON."));
            }
        });

        req.on("error", reject);
    });
}

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

const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);

    // API: Get internships
    if (req.method === "GET" &&
        url.pathname === "/api/internships") {

        try {
            const internships = readInternships();

            const page = Math.max(
                1, Number.parseInt(url.searchParams.get("page"), 10) || 1
            );

            const limit = Math.min(
                50,
                Math.max(1,
                    Number.parseInt(url.searchParams.get("limit"), 10) || 10
                )
            );

            const total = internships.length;
            const start = (page - 1) * limit;

            const data = internships.slice(start, start + limit);

            return sendJSON(res, 200, {
                status: "success",
                data,
                pagination: {
                    page,
                    limit,
                    total,
                    totalPages: Math.ceil(total / limit)
                }
            });

        } catch {
            return sendJSON(res, 500, {
                status: "error",
                message: "Unable to load internships.",
                data: [],
                pagination: {
                    page: 1,
                    limit: 10,
                    total: 0,
                    totalPages: 0
                }
            });
        }
    }

    // API: Submit application
    if (req.method === "POST" &&
        url.pathname === "/api/applications") {

        try {
            const body = await readBody(req);

            const { internshipId, name, email, portfolioUrl } = body;

            // Validate name
            if (
                typeof name !== "string" ||
                name.trim().length < 2 ||
                name.trim().length > 80
            ) {
                return sendJSON(res, 400, {
                    status: "error",
                    message: "Please enter a valid name.",
                    data: null,
                    pagination: null
                });
            }

            // Validate email
            if (
                typeof email !== "string" ||
                email.length > 254 ||
                !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
            ) {
                return sendJSON(res, 400, {
                    status: "error",
                    message: "Please enter a valid email address.",
                    data: null,
                    pagination: null
                });
            }

            // Validate internship
            const internships = readInternships();

            const internship = internships.find(
                item => item.id === internshipId
            );

            if (!internship) {
                return sendJSON(res, 404, {
                    status: "error",
                    message: "Internship not found.",
                    data: null,
                    pagination: null
                });
            }

            if (internship.openings <= 0) {
                return sendJSON(res, 409, {
                    status: "error",
                    message: "No openings are available.",
                    data: null,
                    pagination: null
                });
            }

            // Validate optional portfolio URL
            if (
                typeof portfolioUrl !== "undefined" &&
                typeof portfolioUrl !== "string"
            ) {
                return sendJSON(res, 400, {
                    status: "error",
                    message: "Invalid portfolio URL.",
                    data: null,
                    pagination: null
                });
            }

            if (
                portfolioUrl &&
                !validPortfolioURL(portfolioUrl)
            ) {
                return sendJSON(res, 400, {
                    status: "error",
                    message: "Only safe HTTP or HTTPS URLs are allowed.",
                    data: null,
                    pagination: null
                });
            }

            // Prevent duplicate applications
            const duplicateKey =
                `${internshipId}:${email.trim().toLowerCase()}`;

            if (applications.has(duplicateKey)) {
                return sendJSON(res, 409, {
                    status: "error",
                    message: "You have already applied for this internship.",
                    data: null,
                    pagination: null
                });
            }

            applications.add(duplicateKey);

            // Do not log personal applicant information
            return sendJSON(res, 201, {
                status: "success",
                message: "Application submitted successfully.",
                data: {
                    internshipId,
                    applicationStatus: "Submitted"
                },
                pagination: null
            });

        } catch {
            return sendJSON(res, 400, {
                status: "error",
                message: "Invalid application request.",
                data: null,
                pagination: null
            });
        }
    }

    // Serve frontend files
    if (req.method === "GET") {
        const requestedPath =
            url.pathname === "/" ? "/index.html" : url.pathname;

        const filePath = path.resolve(
            ROOT,
            "." + decodeURIComponent(requestedPath)
        );

        if (!filePath.startsWith(ROOT + path.sep)) {
            return sendJSON(res, 403, {
                status: "error",
                message: "Access denied."
            });
        }

        fs.readFile(filePath, (error, content) => {
            if (error) {
                res.writeHead(404);
                return res.end("File not found.");
            }

            const type = mimeTypes[path.extname(filePath)] ||
                "application/octet-stream";

            res.writeHead(200, {
                "Content-Type": `${type}; charset=utf-8`
            });

            res.end(content);
        });

        return;
    }

    sendJSON(res, 405, {
        status: "error",
        message: "Method not allowed."
    });
});

server.listen(PORT, () => {
    console.log(`Internship Board running at http://localhost:${PORT}`);
});
