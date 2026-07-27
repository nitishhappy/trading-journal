
const fs = require("fs");
const file = "index.html";
let lines = fs.readFileSync(file, "utf8").split("\n");

// Check if line 782 (index 781) is "  </div>"
if (lines[781].trim() === "</div>" && lines[782].includes("LEVELS VIEW")) {
    const closingDiv = lines.splice(781, 1)[0]; // Remove line 782
    
    // Now view-levels ends around index 875 (line 876)
    // Lets find the line before OBSERVATION MODAL
    const obsIndex = lines.findIndex(l => l.includes("OBSERVATION MODAL"));
    
    // Insert the closing div right before OBSERVATION MODAL
    lines.splice(obsIndex - 1, 0, closingDiv);
    
    fs.writeFileSync(file, lines.join("\n"));
    console.log("Moved closing div successfully.");
} else {
    console.log("Unexpected line content:", lines[781], lines[782]);
}

