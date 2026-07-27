
const fs = require("fs");
const file = "index.html";
let lines = fs.readFileSync(file, "utf8").split("\n");

// Find the start of LEVELS VIEW
const startIndex = lines.findIndex(l => l.includes("<!-- ===== LEVELS VIEW ===== -->"));
// The end is the closing div of view-levels
let depth = 0;
let endIndex = -1;
for (let i = startIndex + 1; i < lines.length; i++) {
    const open = (lines[i].match(/<div/g) || []).length;
    const close = (lines[i].match(/<\/div>/g) || []).length;
    depth += open - close;
    if (depth < 0) {
        endIndex = i;
        break;
    }
}

if (startIndex === -1 || endIndex === -1) {
    console.error("Could not find blocks");
    process.exit(1);
}

// Extract the block
const blockToMove = lines.splice(startIndex, endIndex - startIndex + 1);

// Now we need to find where to insert it. We want it BEFORE the closing </div> of app-screen.
// But we moved it so the line numbers changed.
// Let us search for settings-section-signout again.
const signoutIndex = lines.findIndex(l => l.includes("settings-section-signout"));
// From signoutIndex, the next </div> closes the section.
// The </div> after that closes view-settings.
// We should insert right after the </div> that closes view-settings.
let divCloseCount = 0;
let insertIndex = -1;
for (let i = signoutIndex; i < lines.length; i++) {
    if (lines[i].includes("</div>")) {
        divCloseCount++;
        if (divCloseCount === 2) {
            insertIndex = i + 1;
            break;
        }
    }
}

lines.splice(insertIndex, 0, ...blockToMove);
fs.writeFileSync(file, lines.join("\n"));
console.log("Fixed DOM structure.");

