import {
    getFirestore, collection, addDoc, getDocs, query, where, serverTimestamp, doc, Timestamp // Added Timestamp
} from "https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js";
import { auth, db } from './auth.js';

// --- DOM Elements ---
const shopWelcomeMessage = document.getElementById('shop-welcome-message');
// Stall management elements
const ownedStallsList = document.getElementById('owned-stalls-list');
const loadingOwnedStalls = document.getElementById('loading-owned-stalls');
const noOwnedStalls = document.getElementById('no-owned-stalls');
const addStallForm = document.getElementById('add-stall-form');
const stallNameInput = document.getElementById('stall-name');
const stallIdInput = document.getElementById('stall-id');
const stallLocationInput = document.getElementById('stall-location');
const addStallStatus = document.getElementById('add-stall-status');
// --- NEW: Statistics Elements ---
const loadingStats = document.getElementById('loading-stats');
const statsDisplay = document.getElementById('stats-display');
const noStatsFound = document.getElementById('no-stats-found');
const totalResponsesCount = document.getElementById('total-responses-count');
const todayResponsesCount = document.getElementById('today-responses-count');

// --- Helper: Show Status Message --- (remains the same)
function showStatus(element, message, isError = false, duration = 5000) { /* ... */ }

// --- Display Stalls Owned by Current User (MODIFIED to return IDs) ---
async function displayOwnedStalls() {
    const ownedStallIds = []; // Array to store the IDs
    if (!auth.currentUser) {
        console.log("No user logged in, cannot display stalls.");
        loadingOwnedStalls.style.display = 'none';
        noOwnedStalls.style.display = 'block';
        return ownedStallIds; // Return empty array
    }
    const userId = auth.currentUser.uid;

    loadingOwnedStalls.style.display = 'block';
    ownedStallsList.innerHTML = '';
    noOwnedStalls.style.display = 'none';

    try {
        const stallsRef = collection(db, "stalls");
        const q = query(stallsRef, where("ownerId", "==", userId));
        const querySnapshot = await getDocs(q);

        loadingOwnedStalls.style.display = 'none';

        if (querySnapshot.empty) {
            noOwnedStalls.style.display = 'block';
        } else {
            querySnapshot.forEach((doc) => {
                const stallData = doc.data();
                if (stallData.stallId) { // Only add if stallId exists
                   ownedStallIds.push(stallData.stallId); // Add the ID to our list
                }
                // Render stall details (existing logic)
                const stallDiv = document.createElement('div');
                stallDiv.classList.add('stall-item');
                stallDiv.style.border = '1px solid #eee';
                stallDiv.style.padding = '10px';
                stallDiv.style.marginBottom = '10px';
                stallDiv.innerHTML = `
                    <strong>Name:</strong> ${stallData.name || 'N/A'} <br>
                    <strong>Stall ID:</strong> ${stallData.stallId || 'N/A'} <br>
                    <strong>Location:</strong> ${stallData.location || 'Not specified'}
                `;
                ownedStallsList.appendChild(stallDiv);
            });
             if(ownedStallIds.length === 0) { // Double check if IDs were actually added
                 noOwnedStalls.style.display = 'block';
             }
        }

    } catch (error) {
        console.error("Error fetching owned stalls:", error);
        loadingOwnedStalls.style.display = 'none';
        showStatus(loadingOwnedStalls, 'Error loading your stalls.', true, 0);
        noOwnedStalls.style.display = 'block'; // Still show no stalls message on error
    }
    console.log("Owned Stall IDs:", ownedStallIds);
    return ownedStallIds; // Return the array of IDs
}

// --- Handle Add Stall Form Submission --- (remains the same)
async function handleAddStallSubmit(event) { /* ... same as before ... */ }


// --- *** NEW: Display Shop Statistics *** ---
async function displayShopStatistics(ownedStallIds) {
    loadingStats.style.display = 'block';
    statsDisplay.style.display = 'none';
    noStatsFound.style.display = 'none';
    // Reset counts
    if(totalResponsesCount) totalResponsesCount.textContent = '0';
    if(todayResponsesCount) todayResponsesCount.textContent = '0';

    // If owner has no stalls, don't query responses
    if (!ownedStallIds || ownedStallIds.length === 0) {
        console.log("No owned stalls found, skipping statistics query.");
        loadingStats.style.display = 'none';
        noStatsFound.textContent = "Register a stall first to see statistics.";
        noStatsFound.style.display = 'block';
        return;
    }

    try {
        // Query user_responses where stallId is one of the owner's stalls
        const responsesRef = collection(db, "user_responses");
        // Use 'in' operator for efficiency if there are multiple stalls
        // Note: 'in' queries are limited to 30 items in the array. If owners have more, need different approach.
        const q = query(responsesRef, where("stallId", "in", ownedStallIds));

        const responseSnapshot = await getDocs(q);
        loadingStats.style.display = 'none';

        if (responseSnapshot.empty) {
            console.log("No responses found for these stalls:", ownedStallIds);
            noStatsFound.textContent = "No survey responses found for your stalls yet.";
            noStatsFound.style.display = 'block';
            return;
        }

        // Aggregate counts
        let totalCount = 0;
        let todayCount = 0;

        // Calculate the timestamp for the start of today
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
        const startOfTodayTimestamp = Timestamp.fromDate(startOfToday); // Convert JS Date to Firestore Timestamp

        responseSnapshot.forEach(doc => {
            totalCount++;
            const responseData = doc.data();
            // Check if submittedAt exists and is a Timestamp
            if (responseData.submittedAt && responseData.submittedAt instanceof Timestamp) {
                 // Compare submittedAt with the start of today
                 if (responseData.submittedAt >= startOfTodayTimestamp) {
                     todayCount++;
                 }
            } else {
                console.warn(`Response ${doc.id} missing or has invalid submittedAt timestamp.`);
            }
        });

        console.log(`Total Responses: ${totalCount}, Today: ${todayCount}`);

        // Display the counts
        if(totalResponsesCount) totalResponsesCount.textContent = totalCount;
        if(todayResponsesCount) todayResponsesCount.textContent = todayCount;
        statsDisplay.style.display = 'block'; // Show the stats display div

    } catch (error) {
        console.error("Error fetching or processing statistics:", error);
        loadingStats.style.display = 'none';
        noStatsFound.textContent = "Error loading statistics.";
        noStatsFound.style.color = "red";
        noStatsFound.style.display = 'block';
    }
}


// --- Initial Setup ---
async function initializeShopDashboard() { // Make async to await stall fetching
    console.log("Initializing Shop Dashboard...");
    if (shopWelcomeMessage) {
         const userName = auth.currentUser?.displayName || auth.currentUser?.email || 'Shop Owner';
        shopWelcomeMessage.textContent = `Welcome, ${userName}! Manage your stalls and view activity.`;
        shopWelcomeMessage.style.display = 'block';
    }

    // --- Fetch stalls first and get their IDs ---
    const ownedStallIds = await displayOwnedStalls();

    // --- Then fetch statistics using the obtained IDs ---
    displayShopStatistics(ownedStallIds);

    // Add event listener for the form
    if (addStallForm) {
        addStallForm.addEventListener('submit', handleAddStallSubmit);
    }
}

// --- Wait for Auth ---
let isShopInitialized = false;
auth.onAuthStateChanged(async (user) => { // Make async to use await inside
    if (user && !isShopInitialized) {
         console.log("Shop page: Auth state confirmed, initializing...")
         await initializeShopDashboard(); // Await the async init function
         isShopInitialized = true;
    } else if (!user) {
        isShopInitialized = false;
        console.log("Shop page: User logged out.");
        // Clear dynamic content if needed
        if (ownedStallsList) ownedStallsList.innerHTML = '';
        if (loadingOwnedStalls) loadingOwnedStalls.style.display = 'block';
        if (noOwnedStalls) noOwnedStalls.style.display = 'none';
        if (shopWelcomeMessage) shopWelcomeMessage.style.display = 'none';
        // Clear stats too
        if (loadingStats) loadingStats.style.display = 'block';
        if (statsDisplay) statsDisplay.style.display = 'none';
        if (noStatsFound) noStatsFound.style.display = 'none';
    }
});