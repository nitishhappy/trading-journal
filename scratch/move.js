
const fs = require("fs");
const file = "index.html";
let lines = fs.readFileSync(file, "utf8").split("\n");

// Find the start of LEVELS VIEW
const startIndex = lines.findIndex(l => l.includes("<!-- ===== LEVELS VIEW ===== -->"));
const endIndex = lines.findIndex(l => l.includes("<!-- ===================== IMAGE LIGHTBOX ===================== -->"));

if (startIndex === -1 || endIndex === -1) {
    console.error("Could not find blocks");
    process.exit(1);
}

// Extract the block
const blockToMove = lines.splice(startIndex, endIndex - startIndex);

// Find the insertion point: line 783 is index 782.
// Let us just search for:
//       <div class="settings-section settings-section-signout">
//         <button id="settings-logout-btn" class="btn-secondary">Sign out</button>
//       </div>
//     </div>
//   </div>
// 
//   <!-- ===================== OBSERVATION MODAL (Create/Edit) ===================== -->
const insertIndex = lines.findIndex(l => l.includes("<!-- ===================== OBSERVATION MODAL (Create/Edit) ===================== -->"));

if (insertIndex === -1) {
    console.error("Could not find insert point");
    process.exit(1);
}

// We want to insert the block BEFORE the OBSERVATION MODAL comment, but after the closing divs of app-screen.
// In the original file, line 783 is the closing div of app-screen. 
// Let us just insert it at insertIndex - 1.
lines.splice(insertIndex - 1, 0, ...blockToMove);

fs.writeFileSync(file, lines.join("\n"));
console.log("Moved successfully.");

