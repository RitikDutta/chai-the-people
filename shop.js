import {
    getFirestore, collection, addDoc, getDocs, query, where, serverTimestamp, doc, // Added doc for potential future use
} from "https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js";
import { auth, db } from './auth.js';

// --- DOM Elements ---
const loadingShopInfo = document.getElementById('loading-shop-info'); // Maybe remove if not used
const shopWelcomeMessage = document.getElementById('shop-welcome-message');
const shopDetailsContainer = document.getElementById('shop-details'); // Maybe remove if not used

// Stall management elements
const ownedStallsList = document.getElementById('owned-stalls-list');
const loadingOwnedStalls = document.getElementById('loading-owned-stalls');
const noOwnedStalls = document.getElementById('no-owned-stalls');
const addStallForm = document.getElementById('add-stall-form');
const stallNameInput = document.getElementById('stall-name');
const stallIdInput = document.getElementById('stall-id');
const stallLocationInput = document.getElementById('stall-location');
const addStallStatus = document.getElementById('add-stall-status');


// --- Helper: Show Status Message --- (Same as in admin.js)
function showStatus(element, message, isError = false, duration = 5000) {
    if (!element) return; // Check if element exists
    element.textContent = message;
    element.className = `status-message ${isError ? 'error-message' : 'success-message'}`;
    element.style.display = 'block';
    if (duration > 0) {
        setTimeout(() => { element.textContent = ''; element.style.display = 'none'; }, duration);
    }
}

// --- *** NEW: Display Stalls Owned by Current User *** ---
async function displayOwnedStalls() {
    if (!auth.currentUser) {
        console.log("No user logged in, cannot display stalls.");
        return;
    }
    const userId = auth.currentUser.uid;

    loadingOwnedStalls.style.display = 'block';
    ownedStallsList.innerHTML = ''; // Clear previous list
    noOwnedStalls.style.display = 'none';

    try {
        const stallsRef = collection(db, "stalls");
        // Query for stalls where ownerId matches the current user's ID
        const q = query(stallsRef, where("ownerId", "==", userId));
        const querySnapshot = await getDocs(q);

        loadingOwnedStalls.style.display = 'none';

        if (querySnapshot.empty) {
            noOwnedStalls.style.display = 'block';
            return;
        }

        let stallCount = 0;
        querySnapshot.forEach((doc) => {
            stallCount++;
            const stallData = doc.data();
            const stallDiv = document.createElement('div');
            stallDiv.classList.add('stall-item'); // Add class for potential styling
            stallDiv.style.border = '1px solid #eee'; // basic styling
            stallDiv.style.padding = '10px';
            stallDiv.style.marginBottom = '10px';
            stallDiv.innerHTML = `
                <strong>Name:</strong> ${stallData.name || 'N/A'} <br>
                <strong>Stall ID:</strong> ${stallData.stallId || 'N/A'} <br>
                <strong>Location:</strong> ${stallData.location || 'Not specified'}
                <!-- Add Edit/Delete buttons later if needed -->
            `;
            ownedStallsList.appendChild(stallDiv);
        });
         if(stallCount === 0) { // Double check if loop ran
             noOwnedStalls.style.display = 'block';
         }

    } catch (error) {
        console.error("Error fetching owned stalls:", error);
        loadingOwnedStalls.style.display = 'none';
        showStatus(loadingOwnedStalls, 'Error loading your stalls.', true, 0); // show error near loading text
    }
}

// --- *** NEW: Handle Add Stall Form Submission *** ---
async function handleAddStallSubmit(event) {
    event.preventDefault();
    if (!auth.currentUser) {
        showStatus(addStallStatus, 'Error: You must be logged in.', true);
        return;
    }
    const userId = auth.currentUser.uid;

    const stallName = stallNameInput.value.trim();
    const stallId = stallIdInput.value.trim();
    const stallLocation = stallLocationInput.value.trim(); // Optional

    // Basic Validation
    if (!stallName || !stallId) {
        showStatus(addStallStatus, 'Error: Stall Name and Stall ID are required.', true);
        return;
    }
    // Validate Stall ID format (matches pattern in HTML)
    const idPattern = /^[a-zA-Z0-9_]+$/;
    if (!idPattern.test(stallId)) {
        showStatus(addStallStatus, 'Error: Stall ID can only contain letters, numbers, and underscores.', true);
        return;
    }

    // ** TODO: Add check for Stall ID uniqueness before adding **
    // This would involve querying the 'stalls' collection for the given stallId
    // For now, we proceed assuming it's unique, but this is important later.

    const submitButton = addStallForm.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    showStatus(addStallStatus, 'Adding stall...', false, 0);

    try {
        const stallsRef = collection(db, "stalls");
        await addDoc(stallsRef, {
            name: stallName,
            stallId: stallId,
            location: stallLocation || "", // Store empty string if not provided
            ownerId: userId, // Link stall to the logged-in user
            createdAt: serverTimestamp()
        });

        showStatus(addStallStatus, 'Stall added successfully!', false);
        addStallForm.reset(); // Clear the form
        displayOwnedStalls(); // Refresh the list of stalls

    } catch (error) {
        console.error("Error adding stall:", error);
        // Check if it's a permission error (though rules should prevent mismatch)
        if (error.code === 'permission-denied') {
             showStatus(addStallStatus, 'Error: Permission denied. Ensure you are logged in correctly.', true);
        } else {
             showStatus(addStallStatus, `Error adding stall: ${error.message}`, true);
        }
    } finally {
        submitButton.disabled = false; // Re-enable button
    }
}


// --- Initial Setup ---
function initializeShopDashboard() {
    console.log("Initializing Shop Dashboard...");
    if (shopWelcomeMessage) {
         // Get user name from auth if possible
         const userName = auth.currentUser?.displayName || auth.currentUser?.email || 'Shop Owner';
        shopWelcomeMessage.textContent = `Welcome, ${userName}! Manage your stalls below.`;
        shopWelcomeMessage.style.display = 'block';
    }

    // Fetch and display stalls owned by this user
    displayOwnedStalls();

    // Add event listener for the form
    if (addStallForm) {
        addStallForm.addEventListener('submit', handleAddStallSubmit);
    }
}

// --- Wait for Auth ---
let isShopInitialized = false;
auth.onAuthStateChanged(async (user) => {
    if (user && !isShopInitialized) {
         // Assume auth.js redirects non-shop users away.
         console.log("Shop page: Auth state confirmed, initializing...")
         initializeShopDashboard(); // Run setup function
         isShopInitialized = true;
    } else if (!user) {
        isShopInitialized = false;
        console.log("Shop page: User logged out.");
        // Clear dynamic content if needed
        if (ownedStallsList) ownedStallsList.innerHTML = '';
        if (loadingOwnedStalls) loadingOwnedStalls.style.display = 'block';
        if (noOwnedStalls) noOwnedStalls.style.display = 'none';
        if (shopWelcomeMessage) shopWelcomeMessage.style.display = 'none';
    }
});