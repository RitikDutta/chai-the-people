import {
    getFirestore, collection, addDoc, getDocs, deleteDoc, doc, updateDoc, // Added updateDoc
    serverTimestamp, query, orderBy, where // Added where for results query maybe
} from "https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js";
import { auth, db } from './auth.js';

// --- DOM Elements ---
const addQuestionForm = document.getElementById('add-question-form');
const newQuestionText = document.getElementById('new-question-text');
const newQuestionOptions = document.getElementById('new-question-options');
const addQuestionStatus = document.getElementById('add-question-status');
const existingQuestionsList = document.getElementById('existing-questions-list');
const loadingExistingQuestions = document.getElementById('loading-existing-questions');
const noExistingQuestions = document.getElementById('no-existing-questions');

// Scope elements
const scopeRadios = addQuestionForm.querySelectorAll('input[name="scope"]');
const targetStallsGroup = document.getElementById('target-stalls-group');
// const newQuestionTargets = document.getElementById('new-question-targets');
const targetStallsSelect = document.getElementById('new-question-target-select'); // dropdown
const noStallsMessage = document.getElementById('no-stalls-message'); // Get the <small> element for the message


// User Management Elements
const userListContainer = document.getElementById('user-list-container');
const loadingUsers = document.getElementById('loading-users');
const userTable = document.getElementById('user-table');
const userTableBody = document.getElementById('user-table-body');
const noUsersFound = document.getElementById('no-users-found');
const userActionStatus = document.getElementById('user-action-status');

// Results Elements
const resultsContainer = document.getElementById('results-container');
const loadingResults = document.getElementById('loading-results');
const noResultsFound = document.getElementById('no-results-found');

// --- Helper: Show Status Message ---
function showStatus(element, message, isError = false, duration = 5000) {
    element.textContent = message;
    element.className = `status-message ${isError ? 'error-message' : 'success-message'}`;
    element.style.display = 'block';
    if (duration > 0) {
        setTimeout(() => { element.textContent = ''; element.style.display = 'none'; }, duration);
    }
}

async function fetchAndPopulateStalls() {
    if (!targetStallsSelect) return; // Skip if element doesn't exist

    targetStallsSelect.innerHTML = '<option value="" disabled>Loading stalls...</option>'; // Show loading state
    noStallsMessage.style.display = 'none';

    try {
        const stallsRef = collection(db, "stalls");
        // Maybe order stalls by name for easier selection?
        const q = query(stallsRef, orderBy("name"));
        const stallsSnapshot = await getDocs(q);

        // Clear loading message
        targetStallsSelect.innerHTML = '';

        if (stallsSnapshot.empty) {
            targetStallsSelect.innerHTML = '<option value="" disabled>No stalls available</option>';
            noStallsMessage.style.display = 'block'; // Show warning
            console.warn("No documents found in the 'stalls' collection.");
            return;
        }

        stallsSnapshot.forEach(doc => {
            const stallData = doc.data();
            // *** IMPORTANT: Ensure your stall documents have 'stallId' and 'name' fields ***
            const stallId = stallData.stallId; // The unique ID you want to store
            const stallName = stallData.name; // The display name

            if (stallId && stallName) {
                const option = document.createElement('option');
                option.value = stallId;
                option.textContent = `${stallName} (ID: ${stallId})`; // Show name and ID
                targetStallsSelect.appendChild(option);
            } else {
                console.warn(`Stall document ${doc.id} is missing 'stallId' or 'name'.`);
            }
        });

    } catch (error) {
        console.error("Error fetching stalls:", error);
        targetStallsSelect.innerHTML = '<option value="" disabled>Error loading stalls</option>';
         showStatus(noStallsMessage, 'Error loading stalls. Check console.', true, 0);
         noStallsMessage.style.display = 'block';
    }
}


// --- Display Existing Questions (Updated for Scope) ---
async function displayExistingQuestions() {
    loadingExistingQuestions.style.display = 'block';
    existingQuestionsList.innerHTML = '';
    noExistingQuestions.style.display = 'none';

    try {
        const questionsRef = collection(db, "questions");
        const q = query(questionsRef, orderBy("createdAt", "desc"));
        const querySnapshot = await getDocs(q);
        loadingExistingQuestions.style.display = 'none';

        if (querySnapshot.empty) {
            noExistingQuestions.style.display = 'block';
            return;
        }

        querySnapshot.forEach((doc) => {
            const questionData = doc.data();
            const questionId = doc.id;

            // Display scope info
            let scopeInfo = `<strong class="scope">Scope:</strong> ${questionData.scope || 'global'}`;
            if (questionData.scope === 'specific' && questionData.targetStalls) {
                scopeInfo += ` <span class="target-stalls">(Targets: ${questionData.targetStalls.join(', ')})</span>`;
            }

            const questionDiv = document.createElement('div');
            questionDiv.classList.add('question-manage-item');
            questionDiv.innerHTML = `
                <div class="question-details">
                    <p><strong>Text:</strong> ${questionData.text}</p>
                    <p><strong>Options:</strong> ${questionData.options ? questionData.options.join(', ') : 'N/A'}</p>
                    <p>${scopeInfo}</p>
                    <small>ID: ${questionId} | Created: ${questionData.createdAt?.toDate().toLocaleString() ?? 'N/A'}</small>
                </div>
                <button class="delete-button delete-question-button" data-id="${questionId}">Delete</button>
            `;
            existingQuestionsList.appendChild(questionDiv);
        });

    } catch (error) {
        console.error("Error fetching questions: ", error);
        loadingExistingQuestions.style.display = 'none';
        showStatus(loadingExistingQuestions, "Error loading questions.", true, 0);
    }
}

// --- Handle Add Question Form Submission (Updated for Scope) ---
async function handleAddQuestionSubmit(event) {
    event.preventDefault();
    addQuestionStatus.textContent = '';

    const text = newQuestionText.value.trim();
    const optionsArray = newQuestionOptions.value.split('\n').map(opt => opt.trim()).filter(opt => opt !== '');
    const scope = addQuestionForm.querySelector('input[name="scope"]:checked').value;
    let selectedStallIds = []; // Store selected stall IDs here

    if (!text || optionsArray.length === 0) {
         showStatus(addQuestionStatus, 'Error: Question text and options required.', true);
        return;
    }

    if (scope === 'specific') {
        // --- Get selected values from the dropdown ---
        const selectedOptions = targetStallsSelect.selectedOptions; // HTMLCollection
         if (selectedOptions.length === 0) {
             showStatus(addQuestionStatus, 'Error: Please select at least one Target Stall for specific scope.', true);
             return;
         }
         // Convert HTMLCollection to an array of values (stallIds)
         selectedStallIds = Array.from(selectedOptions).map(option => option.value);
         console.log("Selected Stall IDs:", selectedStallIds); // For debugging
    }

    const submitButton = addQuestionForm.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    showStatus(addQuestionStatus, 'Adding question...', false, 0);

    try {
        const questionData = {
            text: text,
            options: optionsArray,
            scope: scope,
            createdAt: serverTimestamp(),
            active: true
        };
        // --- Store the array of selected IDs ---
        if (scope === 'specific') {
            questionData.targetStalls = selectedStallIds; // Store the array directly
        }

        await addDoc(collection(db, "questions"), questionData);

        showStatus(addQuestionStatus, 'Question added successfully!', false);
        addQuestionForm.reset();
        targetStallsGroup.style.display = 'none'; // Hide dropdown again
        targetStallsSelect.selectedIndex = -1; // Deselect all options in dropdown
        displayExistingQuestions();

    } catch (error) {
        console.error("Error adding question: ", error);
        showStatus(addQuestionStatus, `Error adding question: ${error.message}`, true);
    } finally {
         submitButton.disabled = false;
    }
}

// --- Handle Delete Question Button Click --- (Remains the same)
async function handleDeleteQuestion(event) { /* ... same as before ... */
    if (!event.target.classList.contains('delete-question-button')) return;
    const button = event.target;
    const questionId = button.dataset.id;
    if (!questionId) return;
    if (!confirm(`Delete question ID: ${questionId}?`)) return;

    button.disabled = true;
    button.textContent = 'Deleting...';
    try {
        await deleteDoc(doc(db, "questions", questionId));
        console.log("Question deleted:", questionId);
        displayExistingQuestions();
    } catch (error) {
        console.error("Error deleting question: ", error);
        alert(`Failed to delete question: ${error.message}`);
        button.disabled = false;
        button.textContent = 'Delete';
    }
 }

// --- Handle Scope Radio Button Change ---
function handleScopeChange() {
    const selectedScope = addQuestionForm.querySelector('input[name="scope"]:checked').value;
    targetStallsGroup.style.display = (selectedScope === 'specific') ? 'block' : 'none';
}

// --- *** NEW: User Management Functions *** ---

// Display Users
async function displayUsers() {
    loadingUsers.style.display = 'block';
    userTableBody.innerHTML = '';
    userTable.style.display = 'none';
    noUsersFound.style.display = 'none';

    try {
        const usersSnapshot = await getDocs(collection(db, "users"));
        loadingUsers.style.display = 'none';

        if (usersSnapshot.empty) {
            noUsersFound.style.display = 'block';
            return;
        }

        let userCount = 0;
        usersSnapshot.forEach(userDoc => {
            userCount++;
            const userData = userDoc.data();
            const userId = userDoc.id;
            const currentRole = userData.role || 'user'; // Default if missing

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${userData.name || 'N/A'}</td>
                <td>${userData.email}</td>
                <td>${currentRole}</td>
                <td class="user-actions" data-id="${userId}" data-email="${userData.email}" data-role="${currentRole}">
                    <button class="action-button promote-button" ${currentRole === 'admin' ? 'disabled' : ''}>Promote</button>
                    <button class="action-button demote-button" ${currentRole === 'user' ? 'disabled' : ''}>Demote</button>
                    <button class="action-button delete-user-button">Remove</button>
                </td>
            `;
            userTableBody.appendChild(tr);
        });

        if (userCount > 0) {
            userTable.style.display = 'table'; // Show table if there are users
        } else {
             noUsersFound.style.display = 'block';
        }

    } catch (error) {
        console.error("Error fetching users:", error);
        loadingUsers.style.display = 'none';
        showStatus(userActionStatus, "Error loading users.", true, 0);
    }
}

// Handle Role Change (Promote/Demote)
async function handleChangeRole(userId, currentRole, action) {
    let newRole = currentRole;
    if (action === 'promote') {
        if (currentRole === 'user') newRole = 'shop';
        else if (currentRole === 'shop') newRole = 'admin';
        else return; // Cannot promote admin
    } else if (action === 'demote') {
        if (currentRole === 'admin') newRole = 'shop';
        else if (currentRole === 'shop') newRole = 'user';
        else return; // Cannot demote user
    } else {
        return; // Invalid action
    }

    if (!confirm(`Change role for user ${userId} from '${currentRole}' to '${newRole}'?`)) {
        return;
    }

    showStatus(userActionStatus, 'Updating role...', false, 0);
    try {
        const userDocRef = doc(db, "users", userId);
        await updateDoc(userDocRef, { role: newRole });
        showStatus(userActionStatus, `User role updated to ${newRole}.`, false);
        displayUsers(); // Refresh the list
    } catch (error) {
        console.error("Error updating role:", error);
        showStatus(userActionStatus, `Failed to update role: ${error.message}`, true);
    }
}

// Handle User Deletion (Firestore Document Only)
async function handleDeleteUser(userId, userEmail) {
    if (!confirm(`WARNING: This removes user data (${userEmail}) from the app database but MIGHT NOT delete their login.\n\nAre you sure you want to remove this user's data (ID: ${userId})?`)) {
        return;
    }

    showStatus(userActionStatus, 'Removing user data...', false, 0);
    try {
        const userDocRef = doc(db, "users", userId);
        await deleteDoc(userDocRef);
        showStatus(userActionStatus, `User data for ${userEmail} removed.`, false);
        displayUsers(); // Refresh the list
        // ** Reminder: Firebase Auth record still exists! **
    } catch (error) {
        console.error("Error deleting user document:", error);
        showStatus(userActionStatus, `Failed to remove user data: ${error.message}`, true);
    }
}

// Handle User Action Button Clicks (Event Delegation)
function handleUserActions(event) {
    const button = event.target.closest('.action-button');
    if (!button) return; // Didn't click a button

    const actionsCell = button.closest('.user-actions');
    const userId = actionsCell.dataset.id;
    const userEmail = actionsCell.dataset.email; // Get email for confirmation
    const currentRole = actionsCell.dataset.role;

    if (button.classList.contains('promote-button')) {
        handleChangeRole(userId, currentRole, 'promote');
    } else if (button.classList.contains('demote-button')) {
        handleChangeRole(userId, currentRole, 'demote');
    } else if (button.classList.contains('delete-user-button')) {
        handleDeleteUser(userId, userEmail);
    }
}

// --- *** NEW: Display Survey Results *** ---
async function displaySurveyResults() {
    loadingResults.style.display = 'block';
    resultsContainer.innerHTML = '';
    noResultsFound.style.display = 'none';

    try {
        // 1. Fetch all questions to map ID to text/options
        const questionsMap = {};
        const questionsSnapshot = await getDocs(collection(db, "questions"));
        questionsSnapshot.forEach(doc => {
            questionsMap[doc.id] = doc.data();
        });

        // 2. Fetch all responses
        const responsesSnapshot = await getDocs(collection(db, "user_responses"));
        loadingResults.style.display = 'none';

        if (responsesSnapshot.empty) {
            noResultsFound.style.display = 'block';
            return;
        }

        // 3. Aggregate results
        const results = {}; // Structure: { questionId: { option1: count, option2: count }, ... }
        responsesSnapshot.forEach(doc => {
            const response = doc.data();
            const qId = response.questionId;
            const answer = response.answer;

            if (!qId || !answer) return; // Skip invalid responses

            // Initialize question in results if not present
            if (!results[qId]) {
                results[qId] = {};
                // Initialize counts for all known options for this question
                if (questionsMap[qId] && questionsMap[qId].options) {
                    questionsMap[qId].options.forEach(opt => {
                        results[qId][opt] = 0;
                    });
                }
            }

            // Increment count for the given answer
            if (results[qId][answer] !== undefined) {
                 results[qId][answer]++;
            } else {
                // Handle case where answer doesn't match predefined options (maybe free text later?)
                // Or if question definition was deleted after response was made
                results[qId][answer] = (results[qId][answer] || 0) + 1; // Initialize if unknown
            }
        });

        // 4. Display aggregated results
        for (const questionId in results) {
            if (questionsMap[questionId]) {
                const questionData = questionsMap[questionId];
                const questionBlock = document.createElement('div');
                questionBlock.classList.add('result-question-block');

                const questionTitle = document.createElement('h4');
                questionTitle.textContent = questionData.text || `Question ID: ${questionId}`;
                questionBlock.appendChild(questionTitle);

                const answerList = document.createElement('ul');
                // Use predefined options order if available
                const optionsToDisplay = questionData.options || Object.keys(results[questionId]);

                optionsToDisplay.forEach(option => {
                    const count = results[questionId][option] || 0;
                    const listItem = document.createElement('li');
                    listItem.innerHTML = `
                        <span class="option-text">${option}</span>
                        <span class="option-count">${count}</span>
                    `;
                    answerList.appendChild(listItem);
                });

                // Add any answers that weren't in predefined options (if any)
                for (const answeredOption in results[questionId]) {
                    if (!optionsToDisplay.includes(answeredOption)) {
                         const count = results[questionId][answeredOption] || 0;
                         const listItem = document.createElement('li');
                         listItem.innerHTML = `
                            <span class="option-text">${answeredOption} <i>(Not in options?)</i></span>
                            <span class="option-count">${count}</span>
                        `;
                        answerList.appendChild(listItem);
                    }
                }


                questionBlock.appendChild(answerList);
                resultsContainer.appendChild(questionBlock);
            } else {
                 console.warn(`Question data not found for ID: ${questionId} (results exist)`);
                 // Optionally display raw results for this ID
            }
        }


    } catch (error) {
        console.error("Error fetching or processing results:", error);
        loadingResults.style.display = 'none';
        showStatus(loadingResults, "Error loading results.", true, 0);
    }
}


// --- Initial Setup & Event Listeners ---
function initializeAdminDashboard() {
     console.log("Initializing Admin Dashboard...");
     fetchAndPopulateStalls();
     displayExistingQuestions();
     displayUsers(); // Load users
     displaySurveyResults(); // Load results

     // Event listeners
     if (addQuestionForm) {
        addQuestionForm.addEventListener('submit', handleAddQuestionSubmit);
        // Listener for scope change
        scopeRadios.forEach(radio => radio.addEventListener('change', handleScopeChange));
     }
     if (existingQuestionsList) {
         existingQuestionsList.addEventListener('click', handleDeleteQuestion);
     }
     // Listener for user actions (using delegation)
     if (userListContainer) {
          userListContainer.addEventListener('click', handleUserActions);
     }
}

let isAdminInitialized = false;
auth.onAuthStateChanged(async (user) => {
    if (user && !isAdminInitialized) {
         // Assuming auth.js handles redirection for non-admins
         console.log("Admin page: Auth state confirmed, initializing...")
         initializeAdminDashboard();
         isAdminInitialized = true;
    } else if (!user) {
        isAdminInitialized = false;
        console.log("Admin page: User logged out.");
    }
});