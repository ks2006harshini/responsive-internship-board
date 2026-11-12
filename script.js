
const internshipList = document.getElementById("internshipList");

const searchInput = document.getElementById("searchInput");
const secondarySearch = document.getElementById("searchInputSecondary");
const searchButton = document.getElementById("searchButton");

const domainFilter = document.getElementById("domainFilter");
const modeFilter = document.getElementById("modeFilter");

const resultCount = document.getElementById("resultCount");
const loadingMessage = document.getElementById("loadingMessage");
const errorMessage = document.getElementById("errorMessage");
const emptyMessage = document.getElementById("emptyMessage");

const detailsDialog = document.getElementById("detailsDialog");
const applyDialog = document.getElementById("applyDialog");

let internships = [];

// LOAD INTERNSHIPS
async function loadInternships() {
    loadingMessage.hidden = false;
    errorMessage.hidden = true;
    emptyMessage.hidden = true;

    internshipList.innerHTML = "";

    try {
        const response = await fetch("/api/internships");

        if (!response.ok) {
            throw new Error("Failed to load internships");
        }

        const result = await response.json();

        if (result.status !== "success" ||
            !Array.isArray(result.data)) {
            throw new Error("Invalid internship data");
        }

        internships = result.data;

        // Load domains dynamically
        const domains = [...new Set(
            internships.map(item => item.domain)
        )].sort();

        domainFilter.innerHTML =
            '<option value="All">All Domains</option>';

        domains.forEach(domain => {
            const option = document.createElement("option");
            option.value = domain;
            option.textContent = domain;
            domainFilter.appendChild(option);
        });

        loadingMessage.hidden = true;

        filterInternships();

    } catch (error) {
        loadingMessage.hidden = true;
        errorMessage.hidden = false;
        resultCount.textContent = "0 Opportunities";
    }
}

// CREATE INTERNSHIP CARD
function createCard(item) {

    const card = document.createElement("article");
    card.className = "internship-card";

    const top = document.createElement("div");
    top.className = "card-top";

    const domain = document.createElement("span");
    domain.className = "domain-tag";
    domain.textContent = item.domain;

    const openings = document.createElement("span");
    openings.className = "openings-tag";
    openings.textContent = `${item.openings} Openings`;

    top.append(domain, openings);

    const title = document.createElement("h3");
    title.textContent = item.title;

    const id = document.createElement("p");
    id.className = "internship-id";
    id.textContent = item.id;

    const meta = document.createElement("div");
    meta.className = "card-meta";

    const mode = document.createElement("span");
    mode.className = "meta-item";
    mode.textContent = item.mode;

    const location = document.createElement("span");
    location.className = "meta-item";
    location.textContent = item.location;

    meta.append(mode, location);

    const skillsTitle = document.createElement("p");
    skillsTitle.className = "card-skills-title";
    skillsTitle.textContent = "Required Skills";

    const skills = document.createElement("div");
    skills.className = "card-skills";

    item.skills.forEach(skill => {
        const skillTag = document.createElement("span");
        skillTag.className = "skill-tag";
        skillTag.textContent = skill;
        skills.appendChild(skillTag);
    });

    const buttons = document.createElement("div");
    buttons.className = "card-buttons";

    const viewButton = document.createElement("button");
    viewButton.className = "view-btn";
    viewButton.type = "button";
    viewButton.textContent = "View Details";

    viewButton.addEventListener("click", () => {
        showDetails(item.id);
    });

    const applyButton = document.createElement("button");
    applyButton.className = "apply-btn";
    applyButton.type = "button";
    applyButton.textContent = "Apply Now";
    applyButton.disabled = item.openings <= 0;

    applyButton.addEventListener("click", () => {
        openApplication(item.id);
    });

    buttons.append(viewButton, applyButton);

    card.append(
        top,
        title,
        id,
        meta,
        skillsTitle,
        skills,
        buttons
    );

    return card;
}

// DISPLAY INTERNSHIPS
function displayInternships(data) {

    internshipList.innerHTML = "";

    resultCount.textContent =
        `${data.length} Opportunities Found`;

    emptyMessage.hidden = data.length !== 0;

    data.forEach(item => {
        internshipList.appendChild(createCard(item));
    });
}

// SEARCH AND FILTER
function filterInternships() {

    const keyword = searchInput.value.trim().toLowerCase();
    const selectedDomain = domainFilter.value;
    const selectedMode = modeFilter.value;

    const filteredData = internships.filter(item => {

        const searchable = [
            item.id,
            item.title,
            item.domain,
            item.mode,
            item.location,
            ...item.skills
        ].join(" ").toLowerCase();

        const matchesSearch = searchable.includes(keyword);

        const matchesDomain =
            selectedDomain === "All" ||
            item.domain === selectedDomain;

        const matchesMode =
            selectedMode === "All" ||
            item.mode === selectedMode;

        return matchesSearch && matchesDomain && matchesMode;
    });

    displayInternships(filteredData);
}

// SYNCHRONIZE BOTH SEARCH BOXES
function syncSearch(value, source) {

    if (source !== searchInput) {
        searchInput.value = value;
    }

    if (source !== secondarySearch) {
        secondarySearch.value = value;
    }

    filterInternships();
}

searchInput.addEventListener("input", () => {
    syncSearch(searchInput.value, searchInput);
});

secondarySearch.addEventListener("input", () => {
    syncSearch(secondarySearch.value, secondarySearch);
});

searchButton.addEventListener("click", () => {
    searchInput.value = searchInput.value.trim();
    secondarySearch.value = searchInput.value;
    filterInternships();

    document.getElementById("internships").scrollIntoView({
        behavior: "smooth"
    });
});

// DOMAIN FILTER
domainFilter.addEventListener("change", filterInternships);

// WORK MODE FILTER
modeFilter.addEventListener("change", filterInternships);

// VIEW DETAILS
function showDetails(id) {

    const item = internships.find(x => x.id === id);

    if (!item) return;

    const content = document.getElementById("detailsContent");
    content.replaceChildren();

    const tag = document.createElement("span");
    tag.className = "section-tag";
    tag.textContent = item.domain;

    const title = document.createElement("h2");
    title.textContent = item.title;

    content.append(tag, title);

    const details = [
        ["Internship ID", item.id],
        ["Domain", item.domain],
        ["Work Mode", item.mode],
        ["Location", item.location],
        ["Available Openings", item.openings],
        ["Required Skills", item.skills.join(", ")]
    ];

    details.forEach(([label, value]) => {
        const p = document.createElement("p");
        p.textContent = `${label}: ${value}`;
        content.appendChild(p);
    });

    const button = document.createElement("button");
    button.className = "submit-button";
    button.type = "button";
    button.textContent = "Apply Now";
    button.disabled = item.openings <= 0;

    button.addEventListener("click", () => {
        detailsDialog.close();
        openApplication(id);
    });

    content.appendChild(button);

    detailsDialog.showModal();
}

// APPLY FORM
function openApplication(id) {

    const item = internships.find(x => x.id === id);

    if (!item || item.openings <= 0) return;

    document.getElementById("applicationForm").reset();

    document.getElementById("internshipId").value = id;

    document.getElementById("applicationTitle").textContent =
        `Applying for: ${item.title}`;

    document.getElementById("formMessage").textContent = "";

    applyDialog.showModal();

    document.getElementById("applicantName").focus();
}

// SUBMIT APPLICATION
document.getElementById("applicationForm")
    .addEventListener("submit", async function(event) {

        event.preventDefault();

        if (!this.reportValidity()) return;

        const submitButton = this.querySelector(".submit-button");
        const message = document.getElementById("formMessage");

        const application = {
            internshipId: document.getElementById("internshipId").value,
            name: document.getElementById("applicantName").value.trim(),
            email: document.getElementById("applicantEmail").value.trim(),
            portfolioUrl: document.getElementById("portfolioUrl").value.trim()
        };

        submitButton.disabled = true;
        message.textContent = "Submitting application...";

        try {
            const response = await fetch("/api/applications", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(application)
            });

            const result = await response.json();

            if (!response.ok || result.status !== "success") {
                throw new Error(result.message || "Application failed.");
            }

            message.textContent = "✓ Application submitted successfully!";
            message.style.color = "#25834b";

            this.reset();

            document.getElementById("internshipId").value =
                application.internshipId;

        } catch (error) {

            message.textContent = error.message;
            message.style.color = "#bd3333";

        } finally {
            submitButton.disabled = false;
        }
    });

// RESET FILTERS
document.getElementById("resetButton")
    .addEventListener("click", () => {

        searchInput.value = "";
        secondarySearch.value = "";
        domainFilter.value = "All";
        modeFilter.value = "All";

        filterInternships();
    });

// RETRY BUTTON
document.getElementById("retryButton")
    .addEventListener("click", loadInternships);

// CLOSE DIALOGS
document.querySelectorAll("[data-close]").forEach(button => {

    button.addEventListener("click", () => {
        const dialog = document.getElementById(button.dataset.close);
        dialog.close();
    });

});

// INITIALIZE WEBSITE
loadInternships();
