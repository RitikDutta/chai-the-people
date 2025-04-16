import {
    getFirestore, collection, addDoc, getDocs, query, where, serverTimestamp, doc, Timestamp, orderBy, limit
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
// Statistics Elements
const loadingStats = document.getElementById('loading-stats');
const statsDisplay = document.getElementById('stats-display');
const noStatsFound = document.getElementById('no-stats-found');
const totalResponsesCount = document.getElementById('total-responses-count');
const todayResponsesCount = document.getElementById('today-responses-count');

// --- Helper: Show Status Message ---
function showStatus(element, message, isError = false, duration = 5000) {
    if (!element) return;
    element.textContent = message;
    element.className = `status-message ${isError ? 'error-message' : 'success-message'}`;
    element.style.display = 'block';
    if (duration > 0) {
        setTimeout(() => {
             if (element) {
                 element.textContent = '';
                 element.style.display = 'none';
             }
        }, duration);
    }
}

// --- Display Stalls Owned by Current User ---
async function displayOwnedStalls() {
    const ownedStallIds = [];
    // Safety check elements
    if (!loadingOwnedStalls || !ownedStallsList || !noOwnedStalls) {
        console.error("Missing stall display elements!");
        return ownedStallIds;
    }
    if (!auth.currentUser) {
        console.log("No user logged in, cannot display stalls.");
        loadingOwnedStalls.style.display = 'none';
        noOwnedStalls.style.display = 'block';
        return ownedStallIds;
    }
    const userId = auth.currentUser.uid;

    loadingOwnedStalls.style.display = 'block';
    ownedStallsList.innerHTML = ''; // Clear previous list
    noOwnedStalls.style.display = 'none';

    try {
        const stallsRef = collection(db, "stalls");
        const q = query(stallsRef, where("ownerId", "==", userId), orderBy("name")); // Add ordering
        const querySnapshot = await getDocs(q);

        loadingOwnedStalls.style.display = 'none';

        if (querySnapshot.empty) {
            noOwnedStalls.style.display = 'block';
        } else {
            querySnapshot.forEach((doc) => {
                const stallData = doc.data();
                if (stallData.stallId) {
                   ownedStallIds.push(stallData.stallId);
                }
                const stallDiv = document.createElement('div');
                stallDiv.classList.add('stall-item'); // Use class from style.css
                // Add more details maybe?
                stallDiv.innerHTML = `
                    <h4>${stallData.name || 'N/A'}</h4>
                    <p><strong>ID:</strong> ${stallData.stallId || 'N/A'}</p>
                    <p><strong>Location:</strong> ${stallData.location || 'Not specified'}</p>
                    <small>Registered: ${stallData.createdAt?.toDate().toLocaleDateString() ?? 'N/A'}</small>
                    <!-- Add QR Code display or buttons later -->
                `;
                ownedStallsList.appendChild(stallDiv);
            });
             if(ownedStallIds.length === 0) {
                 noOwnedStalls.style.display = 'block';
             }
        }

    } catch (error) {
        console.error("Error fetching owned stalls:", error);
        if(loadingOwnedStalls) loadingOwnedStalls.style.display = 'none';
        if(noOwnedStalls) {
            noOwnedStalls.textContent = "Error loading your stalls.";
            noOwnedStalls.style.display = 'block';
            noOwnedStalls.style.color = 'red';
        }
    }
    console.log("Owned Stall IDs:", ownedStallIds);
    return ownedStallIds;
}

// --- Handle Add Stall Form Submission (MODIFIED) ---
async function handleAddStallSubmit(event) {
    event.preventDefault();
    // Check required elements exist
    if (!addStallForm || !stallNameInput || !stallIdInput || !stallLocationInput || !addStallStatus) {
        console.error("Add stall form elements missing!");
        return;
    }
    if (!auth.currentUser) {
        showStatus(addStallStatus, 'Error: You must be logged in.', true);
        return;
    }
    const userId = auth.currentUser.uid;

    const stallName = stallNameInput.value.trim();
    const stallId = stallIdInput.value.trim().toLowerCase();
    const stallLocation = stallLocationInput.value.trim();

    if (!stallName || !stallId) {
        showStatus(addStallStatus, 'Error: Stall Name and Stall ID are required.', true);
        return;
    }return;
    }
    const idPattern = /^[a-z0-9_]+$/;
    if (!idPattern.test(stallId)) {
        showStatus(addStallStatus, 'Error: Stall ID can only contain lowercase letters, numbers, and underscores.', true);
        return;
    }

    // --- IMPORTANT: Add Stall ID Uniqueness Check (Example - requires careful implementation) ---
    try {
        const checkQuery = query(collection(db, "stalls"), where("stallId", "==", stallId), limit(1));
        const checkSnapshot = await getDocs(checkQuery);
        if (!checkSnapshot.empty) {
             showStatus(addStallStatus, `Error: Stall ID '${stallId}' is already taken. Please choose a unique ID.`, true);
             return;
        }
    } catch (checkError) {
         console.error("Error checking stall ID uniqueness:", checkError);
         showStatus(addStallStatus, 'Error checking Stall ID. Please try again.', true);
         return; // Stop on error
    }
    // --- End Uniqueness Check ---


    const submitButton = addStallForm.querySelector('button[type="submit"]');
    if(submitButton) submitButton.disabled = true;
    showStatus(addStallStatus, 'Adding stall...', false, 0);

    try {
        const stallsRef = collection(db, "stalls");
        await addDoc(stallsRef, {
            name: stallName,
            stallId: stallId,
            location: stallLocation || "",
            ownerId: userId,
            createdAt: serverTimestamp()
        });

        showStatus(addStallStatus, 'Stall added successfully!', false);
        addStallForm.reset(); // Clear the form

        // --- *** RE-FETCH AND DISPLAY DATA *** ---
        console.log("Stall added. Refreshing stall list and statistics...");
        const updatedOwnedStallIds = await displayOwnedStalls(); // Re-fetch stalls
        displayShopStatistics(updatedOwnedStallIds); // Re-calculate stats with updated IDs

    } catch (error) {
        console.error("Error adding stall:", error);
        if (error.code === 'permission-denied') {
             showStatus(addStallStatus, 'Error: Permission denied.', true);
        } else {
             showStatus(addStallStatus, `Error adding stall: ${error.message}`, true);
        }
    } finally {
        if(submitButton) submitButton.disabled = false; // Re-enable button
    }
}

// --- Display Shop Statistics ---
async function displayShopStatistics(ownedStallIds) {
    // Safety checks
    if (!loadingStats || !statsDisplay || !noStatsFound || !totalResponsesCount || !todayResponsesCount) {
        console.error("Missing statistics display elements!");
        return;
    }

    loadingStats.style.display = 'block';
    statsDisplay.style.display = 'none';
    noStatsFound.style.display = 'none';
    totalResponsesCount.textContent = '0';
    todayResponsesCount.textContent = '0';

    if (!ownedStallIds || ownedStallIds.length === 0) {
        console.log("No owned stalls found, skipping statistics query.");
        loadingStats.style.display = 'none';
        noStatsFound.textContent = "Register a stall first to see statistics.";
        noStatsFound.style.display = 'block';
        return;
    }

    // Firestore 'in' query limitation (max 30)
    if (ownedStallIds.length > 30) {
         console.warn("Owner has > 30 stalls. Statistics might be incomplete due to Firestore 'in' query limits.");
         // Handle this limitation - maybe query in batches or show a message
         // For now, we'll query only the first 30
         // ownedStallIds = ownedStallIds.slice(0, 30);
         // Or display a warning message
         showStatus(loadingStats, "Warning: Displaying stats for first 30 stalls due to query limits.", true, 0); // Show near loading text
         // Proceeding with potentially >30 for now, but be aware Firestore might error later
    }


    try {
        const responsesRef = collection(db, "user_responses");
        const q = query(responsesRef, where("stallId", "in", ownedStallIds));
        const responseSnapshot = await getDocs(q);
        loadingStats.style.display = 'none';

        if (responseSnapshot.empty) {
            console.log("No responses found for these stalls:", ownedStallIds);
            noStatsFound.textContent = "No survey responses found for your stalls yet.";
            noStatsFound.style.display = 'block';
            return;
        }

        let totalCount = 0;
        let todayCount = 0;
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
        const startOfTodayTimestamp = Timestamp.fromDate(startOfToday);

        responseSnapshot.forEach(doc => {
            totalCount++;
            const responseData = doc.data();
            if (responseData.submittedAt && responseData.submittedAt instanceof Timestamp) {
                 if (responseData.submittedAt >= startOfTodayTimestamp) {
                     todayCount++;
                 }
            } else {
                // console.warn(`Response ${doc.id} missing or has invalid submittedAt timestamp.`);
            }
        });

        console.log(`Total Responses: ${totalCount}, Today: ${todayCount}`);

        totalResponsesCount.textContent = totalCount;
        todayResponsesCount.textContent = todayCount;
        statsDisplay.style.display = 'block';

    } catch (error) {
        console.error("Error fetching or processing statistics:", error);
        if (loadingStats) loadingStats.style.display = 'none';
        if (noStatsFound) {
            noStatsFound.textContent = "Error loading statistics.";
            noStatsFound.style.color = "red";
            noStatsFound.style.display = 'block';
        }
    }
}


// --- Initial Setup ---
async function initializeShopDashboard() {
    console.log("Initializing Shop Dashboard...");
    if (!auth.currentUser) { // Early exit if not logged in somehow
        console.error("Attempted to initialize shop dashboard while logged out.");
        return;
    }
    if (shopWelcomeMessage) {
         const userName = auth.currentUser?.displayName || auth.currentUser?.email || 'Shop Owner';
        shopWelcomeMessage.textContent = `Welcome, ${userName}! Manage your stalls and view activity.`;
        shopWelcomeMessage.style.display = 'block';
    } else {
        console.warn("shopWelcomeMessage element not found.");
    }

    // Fetch stalls first and get their IDs
    const ownedStallIds = await displayOwnedStalls();

    // Then fetch statistics using the obtained IDs
    displayShopStatistics(ownedStallIds);

    // Add event listener for the form
    if (addStallForm) {
        addStallForm.addEventListener('submit', handleAddStallSubmit);
    } else {
        console.warn("addStallForm element not found.");
    }
}

// --- Wait for Auth ---
let isShopInitialized = false;
auth.onAuthStateChanged(async (user) => {
    if (user && !isShopInitialized) {
         console.log("Shop page: Auth state confirmed, initializing...")
         try {
             await initializeShopDashboard(); // Await the async init function
             isShopInitialized = true;
         } catch(initError) {
              console.error("Error during shop dashboard initialization:", initError);
              // Display a general error message on the page?
              document.body.innerHTML = '<p style="color: red; padding: 2rem;">Shop dashboard failed to load. Please refresh or contact support.</p>';
         }

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