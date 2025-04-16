import {
    getFirestore, collection, addDoc, getDocs, deleteDoc, doc, updateDoc,
    serverTimestamp, query, orderBy, where, limit, Timestamp // Added Timestamp, limit
} from "https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js";
import { auth, db } from './auth.js';
// Assumes Chart.js is loaded globally via CDN in the HTML

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
const targetStallsSelect = document.getElementById('new-question-target-select'); // dropdown
const noStallsMessage = document.getElementById('no-stalls-message');

// User Management Elements
const userListContainer = document.getElementById('user-list-container');
const loadingUsers = document.getElementById('loading-users');
const userTable = document.getElementById('user-table');
const userTableBody = document.getElementById('user-table-body');
const noUsersFound = document.getElementById('no-users-found');
const userActionStatus = document.getElementById('user-action-status');

// --- NEW Insight Elements ---
const loadingInsights = document.getElementById('loading-insights');
const insightsGrid = document.querySelector('.insights-grid'); // Use querySelector for class
const insightsError = document.getElementById('insights-error');
// KPI elements
const insightTotalUsers = document.getElementById('insight-total-users');
const insightTotalStalls = document.getElementById('insight-total-stalls');
const insightTotalQuestions = document.getElementById('insight-total-questions');
const insightTotalResponses = document.getElementById('insight-total-responses');
// User Activity elements
const insightNewUsers = document.getElementById('insight-new-users');
const insightResponsesToday = document.getElementById('insight-responses-today');
const insightResponsesWeek = document.getElementById('insight-responses-week');
const responseTrendChartCanvas = document.getElementById('responseTrendChart');
// Stall Activity elements
const insightActiveStallsToday = document.getElementById('insight-active-stalls-today');
const insightTopStallsList = document.getElementById('insight-top-stalls');
// Survey Engagement elements
const insightAvgRespPerQ = document.getElementById('insight-avg-resp-per-q');
const insightTopQuestionsList = document.getElementById('insight-top-questions');
const insightBottomQuestionsList = document.getElementById('insight-bottom-questions');

// --- Helper: Show Status Message ---
function showStatus(element, message, isError = false, duration = 5000) {
    // check if element exists before modifying it
    if (!element) {
        console.warn("Attempted to show status on a non-existent element:", message);
        return;
    }
    element.textContent = message;
    element.className = `status-message ${isError ? 'error-message' : 'success-message'}`;
    element.style.display = 'block';
    if (duration > 0) {
        setTimeout(() => {
            if (element) { // Check again in case element removed before timeout
                 element.textContent = '';
                 element.style.display = 'none';
            }
        }, duration);
    }
}

// --- Helper: Format list item with count ---
function formatListItem(text, count) {
    const item = document.createElement('li');
    // Truncate long text nicely
    const truncatedText = text && text.length > 40 ? text.substring(0, 37) + '...' : (text || 'N/A');
    item.textContent = truncatedText;
    if (count !== undefined) {
        const countSpan = document.createElement('span');
        countSpan.className = 'count';
        countSpan.textContent = count;
        item.appendChild(countSpan);
    }
    return item;
}

// --- Fetch and Populate Stalls Dropdown ---
async function fetchAndPopulateStalls() {
    if (!targetStallsSelect) return;

    targetStallsSelect.innerHTML = '<option value="" disabled>Loading stalls...</option>';
    if (noStallsMessage) noStallsMessage.style.display = 'none';

    try {
        const stallsRef = collection(db, "stalls");
        const q = query(stallsRef, orderBy("name"));
        const stallsSnapshot = await getDocs(q);
        targetStallsSelect.innerHTML = ''; // Clear loading

        if (stallsSnapshot.empty) {
            targetStallsSelect.innerHTML = '<option value="" disabled>No stalls available</option>';
            if (noStallsMessage) noStallsMessage.style.display = 'block';
            console.warn("No documents found in the 'stalls' collection.");
            return;
        }

        stallsSnapshot.forEach(doc => {
            const stallData = doc.data();
            const stallId = stallData.stallId; // ID from DB (might be mixed case initially)
            const stallName = stallData.name;

            if (stallId && stallName) {
                const option = document.createElement('option');
                // --- Store the VALUE as lowercase ---
                option.value = stallId.toLowerCase();
                // --- Display original name and lowercase ID ---
                option.textContent = `${stallName} (ID: ${stallId.toLowerCase()})`;
                targetStallsSelect.appendChild(option);
            } else {
                console.warn(`Stall document ${doc.id} is missing 'stallId' or 'name'.`);
            }
        });

    } catch (error) {
        console.error("Error fetching stalls:", error);
        targetStallsSelect.innerHTML = '<option value="" disabled>Error loading stalls</option>';
        if (noStallsMessage) {
            showStatus(noStallsMessage, 'Error loading stalls. Check console.', true, 0);
            noStallsMessage.style.display = 'block';
        }
    }
}

// --- Display Existing Questions ---
async function displayExistingQuestions() {
    if (!loadingExistingQuestions || !existingQuestionsList || !noExistingQuestions) return; // Safety check

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

            let scopeInfo = `<strong class="scope">Scope:</strong> ${questionData.scope || 'global'}`;
            if (questionData.scope === 'specific' && questionData.targetStalls && questionData.targetStalls.length > 0) {
                scopeInfo += ` <span class="target-stalls">(Targets: ${questionData.targetStalls.join(', ')})</span>`;
            } else if (questionData.scope === 'specific') {
                 scopeInfo += ` <span class="target-stalls">(No targets selected?)</span>`; // Handle empty array case
            }


            const questionDiv = document.createElement('div');
            questionDiv.classList.add('question-manage-item');
            questionDiv.innerHTML = `
                <div class="question-details">
                    <p><strong>Text:</strong> ${questionData.text || '[No Text]'}</p>
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
        if (loadingExistingQuestions) loadingExistingQuestions.style.display = 'none';
        // Use showStatus on a relevant element if needed, e.g., a general status area
        existingQuestionsList.innerHTML = '<p class="error-message">Error loading questions.</p>'; // Simple error message
    }
}

// --- Handle Add Question Form Submission ---
async function handleAddQuestionSubmit(event) {
    event.preventDefault();
    if (!addQuestionStatus || !addQuestionForm || !targetStallsSelect) return;

    addQuestionStatus.textContent = ''; // Clear previous status

    const text = newQuestionText.value.trim();
    const optionsArray = newQuestionOptions.value.split('\n').map(opt => opt.trim()).filter(opt => opt !== '');
    const scope = addQuestionForm.querySelector('input[name="scope"]:checked')?.value; // Use optional chaining
    let selectedStallIds = [];

    if (!scope) {
         showStatus(addQuestionStatus, 'Error: Please select a scope (Global or Specific).', true);
        return;
    }
    if (!text || optionsArray.length === 0) {
         showStatus(addQuestionStatus, 'Error: Question text and options required.', true);
        return;
    }

    if (scope === 'specific') {
        const selectedOptions = targetStallsSelect.selectedOptions;
         if (selectedOptions.length === 0) {
             showStatus(addQuestionStatus, 'Error: Please select at least one Target Stall for specific scope.', true);
             return;
         }
         selectedStallIds = Array.from(selectedOptions).map(option => option.value);
         console.log("Selected Stall IDs:", selectedStallIds);
    }

    const submitButton = addQuestionForm.querySelector('button[type="submit"]');
    if(submitButton) submitButton.disabled = true;
    showStatus(addQuestionStatus, 'Adding question...', false, 0);

    try {
        const questionData = {
            text: text,
            options: optionsArray,
            scope: scope,
            createdAt: serverTimestamp(),
            active: true
        };
        if (scope === 'specific') {
            questionData.targetStalls = selectedStallIds;
        }

        await addDoc(collection(db, "questions"), questionData);

        showStatus(addQuestionStatus, 'Question added successfully!', false);
        addQuestionForm.reset(); // Reset form fields
        if (targetStallsGroup) targetStallsGroup.style.display = 'none'; // Hide dropdown group
        targetStallsSelect.selectedIndex = -1; // Deselect all options
        // Manually set radio button back to global default if desired
         const globalRadio = addQuestionForm.querySelector('input[name="scope"][value="global"]');
         if (globalRadio) globalRadio.checked = true;
        displayExistingQuestions(); // Refresh the list

    } catch (error) {
        console.error("Error adding question: ", error);
        showStatus(addQuestionStatus, `Error adding question: ${error.message}`, true);
    } finally {
         if(submitButton) submitButton.disabled = false;
    }
}

// --- Handle Delete Question Button Click ---
async function handleDeleteQuestion(event) {
    if (!event.target.classList.contains('delete-question-button')) return;

    const button = event.target;
    const questionId = button.dataset.id;

    if (!questionId) {
        console.error("Missing question ID on delete button.");
        return;
    }
    if (!confirm(`Are you sure you want to delete question ID: ${questionId}? This cannot be undone.`)) {
        return;
    }

    button.disabled = true;
    button.textContent = 'Deleting...';

    try {
        await deleteDoc(doc(db, "questions", questionId));
        console.log("Question deleted successfully:", questionId);
        displayExistingQuestions(); // Refresh list
    } catch (error) {
        console.error("Error deleting question: ", error);
        alert(`Failed to delete question. Error: ${error.message}`);
        button.disabled = false; // Re-enable on error
        button.textContent = 'Delete';
    }
 }

// --- Handle Scope Radio Button Change ---
function handleScopeChange() {
    if (!addQuestionForm || !targetStallsGroup) return;
    const selectedScope = addQuestionForm.querySelector('input[name="scope"]:checked')?.value;
    targetStallsGroup.style.display = (selectedScope === 'specific') ? 'block' : 'none';
}

// --- User Management Functions ---
async function displayUsers() {
    if (!loadingUsers || !userTableBody || !userTable || !noUsersFound || !userActionStatus) return;

    loadingUsers.style.display = 'block';
    userTableBody.innerHTML = '';
    userTable.style.display = 'none';
    noUsersFound.style.display = 'none';
    userActionStatus.style.display = 'none'; // Hide status initially

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
            const currentRole = userData.role || 'user';

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${userData.name || 'N/A'}</td>
                <td>${userData.email || 'N/A'}</td>
                <td>${currentRole}</td>
                <td class="user-actions" data-id="${userId}" data-email="${userData.email || 'N/A'}" data-role="${currentRole}">
                    <button class="action-button promote-button" ${currentRole === 'admin' ? 'disabled' : ''} title="Promote to ${currentRole === 'user' ? 'Shop' : 'Admin'}">Promote</button>
                    <button class="action-button demote-button" ${currentRole === 'user' ? 'disabled' : ''} title="Demote to ${currentRole === 'admin' ? 'Shop' : 'User'}">Demote</button>
                    <button class="action-button delete-user-button" title="Remove User Data">Remove</button>
                </td>
            `;
            userTableBody.appendChild(tr);
        });

        if (userCount > 0) {
            userTable.style.display = 'table';
        } else {
             noUsersFound.style.display = 'block';
        }

    } catch (error) {
        console.error("Error fetching users:", error);
        if(loadingUsers) loadingUsers.style.display = 'none';
        showStatus(userActionStatus, `Error loading users: ${error.message}`, true, 0);
    }
}

async function handleChangeRole(userId, currentRole, action) {
    let newRole = currentRole;
    let confirmationMessage = '';

    if (action === 'promote') {
        if (currentRole === 'user') { newRole = 'shop'; confirmationMessage = `Promote this user to 'shop' role?`; }
        else if (currentRole === 'shop') { newRole = 'admin'; confirmationMessage = `Promote this shop owner to 'admin' role?`; }
        else return;
    } else if (action === 'demote') {
        if (currentRole === 'admin') { newRole = 'shop'; confirmationMessage = `Demote this admin to 'shop' role?`; }
        else if (currentRole === 'shop') { newRole = 'user'; confirmationMessage = `Demote this shop owner to 'user' role?`; }
        else return;
    } else { return; }

    if (!confirm(confirmationMessage)) return;

    showStatus(userActionStatus, 'Updating role...', false, 0);
    try {
        const userDocRef = doc(db, "users", userId);
        await updateDoc(userDocRef, { role: newRole });
        showStatus(userActionStatus, `User role updated to ${newRole}.`, false);
        displayUsers(); // Refresh list
    } catch (error) {
        console.error("Error updating role:", error);
        showStatus(userActionStatus, `Failed to update role: ${error.message}`, true);
    }
}

async function handleDeleteUser(userId, userEmail) {
     if (!confirm(`WARNING: This removes user data (${userEmail}) from the app database but MIGHT NOT delete their login.\n\nAre you sure you want to remove this user's data (ID: ${userId})?`)) {
        return;
    }
    showStatus(userActionStatus, 'Removing user data...', false, 0);
    try {
        await deleteDoc(doc(db, "users", userId));
        showStatus(userActionStatus, `User data for ${userEmail} removed.`, false);
        displayUsers(); // Refresh list
    } catch (error) {
        console.error("Error deleting user document:", error);
        showStatus(userActionStatus, `Failed to remove user data: ${error.message}`, true);
    }
}

function handleUserActions(event) {
    const button = event.target.closest('.action-button');
    if (!button) return;

    const actionsCell = button.closest('.user-actions');
    if (!actionsCell) return;

    const userId = actionsCell.dataset.id;
    const userEmail = actionsCell.dataset.email;
    const currentRole = actionsCell.dataset.role;

    if (!userId || !userEmail || !currentRole) {
        console.error("Missing data attributes on user actions cell.");
        return;
    }

    if (button.classList.contains('promote-button')) {
        handleChangeRole(userId, currentRole, 'promote');
    } else if (button.classList.contains('demote-button')) {
        handleChangeRole(userId, currentRole, 'demote');
    } else if (button.classList.contains('delete-user-button')) {
        handleDeleteUser(userId, userEmail);
    }
}

// --- Dashboard Insights Functions ---
async function calculateAndDisplayInsights() {
    console.log("Calculating insights...");
    if (!loadingInsights || !insightsGrid || !insightsError) return; // Check elements exist

    loadingInsights.style.display = 'block';
    insightsGrid.style.display = 'none';
    insightsError.style.display = 'none';

    try {
        // Fetch ALL necessary data concurrently
        const usersPromise = getDocs(collection(db, "users"));
        const stallsPromise = getDocs(collection(db, "stalls"));
        const questionsPromise = getDocs(collection(db, "questions"));
        const responsesPromise = getDocs(collection(db, "user_responses"));

        const [
            usersSnapshot,
            stallsSnapshot,
            questionsSnapshot,
            responsesSnapshot
        ] = await Promise.all([usersPromise, stallsPromise, questionsPromise, responsesPromise]);

        console.log(`Fetched: ${usersSnapshot.size} users, ${stallsSnapshot.size} stalls, ${questionsSnapshot.size} questions, ${responsesSnapshot.size} responses`);

        // --- Process Data & Calculate Insights ---

        // ** KPI Metrics **
        const totalUsers = usersSnapshot.size;
        const totalStalls = stallsSnapshot.size;
        const totalQuestions = questionsSnapshot.size;
        const totalResponses = responsesSnapshot.size;

        if (insightTotalUsers) insightTotalUsers.textContent = totalUsers;
        if (insightTotalStalls) insightTotalStalls.textContent = totalStalls;
        if (insightTotalQuestions) insightTotalQuestions.textContent = totalQuestions;
        if (insightTotalResponses) insightTotalResponses.textContent = totalResponses;

        // ** User Activity **
        const sevenDaysAgo = Timestamp.fromDate(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000));
        const startOfToday = Timestamp.fromDate(new Date(new Date().setHours(0, 0, 0, 0)));

        let newUsersCount = 0;
        usersSnapshot.forEach(doc => {
            const userData = doc.data();
            if (userData.createdAt && userData.createdAt instanceof Timestamp && userData.createdAt >= sevenDaysAgo) {
                newUsersCount++;
            }
        });
        if (insightNewUsers) insightNewUsers.textContent = newUsersCount;

        let responsesTodayCount = 0;
        let responsesWeekCount = 0;
        const responsesPerDay = {}; // For chart: { 'YYYY-MM-DD': count }

        responsesSnapshot.forEach(doc => {
            const responseData = doc.data();
            if (responseData.submittedAt && responseData.submittedAt instanceof Timestamp) {
                if (responseData.submittedAt >= startOfToday) { responsesTodayCount++; }
                if (responseData.submittedAt >= sevenDaysAgo) {
                    responsesWeekCount++;
                    const dateStr = responseData.submittedAt.toDate().toISOString().split('T')[0];
                    responsesPerDay[dateStr] = (responsesPerDay[dateStr] || 0) + 1;
                }
            }
        });
        if (insightResponsesToday) insightResponsesToday.textContent = responsesTodayCount;
        if (insightResponsesWeek) insightResponsesWeek.textContent = responsesWeekCount;

        // ** Stall Activity **
        const stallResponseCounts = {};
        const stallsActiveToday = new Set();
        const stallIdToNameMap = {};
        stallsSnapshot.forEach(doc => {
             if (doc.data().stallId && doc.data().name) {
                 stallIdToNameMap[doc.data().stallId] = doc.data().name;
             }
        });

        responsesSnapshot.forEach(doc => {
            const responseData = doc.data();
            if (responseData.stallId) {
                stallResponseCounts[responseData.stallId] = (stallResponseCounts[responseData.stallId] || 0) + 1;
                if (responseData.submittedAt && responseData.submittedAt instanceof Timestamp && responseData.submittedAt >= startOfToday) {
                    stallsActiveToday.add(responseData.stallId);
                }
            }
        });

        if (insightActiveStallsToday) insightActiveStallsToday.textContent = stallsActiveToday.size;

        const sortedStalls = Object.entries(stallResponseCounts)
            .sort(([, countA], [, countB]) => countB - countA)
            .slice(0, 5);

        if (insightTopStallsList) {
            insightTopStallsList.innerHTML = ''; // Clear list
            if (sortedStalls.length > 0) {
                sortedStalls.forEach(([stallId, count]) => {
                    const stallName = stallIdToNameMap[stallId] || stallId;
                    insightTopStallsList.appendChild(formatListItem(`${stallName}`, count));
                });
            } else {
                 insightTopStallsList.innerHTML = '<li>No stall activity yet.</li>';
            }
        }

        // ** Survey Engagement **
        const questionResponseCounts = {};
        const questionIdToTextMap = {};
         questionsSnapshot.forEach(doc => {
             if(doc.data().text) { questionIdToTextMap[doc.id] = doc.data().text; }
             questionResponseCounts[doc.id] = 0; // Initialize all questions
         });

        responsesSnapshot.forEach(doc => {
            const responseData = doc.data();
            if (responseData.questionId && questionResponseCounts.hasOwnProperty(responseData.questionId)) {
                 questionResponseCounts[responseData.questionId]++;
            }
        });

        const avgResp = totalQuestions > 0 ? (totalResponses / totalQuestions).toFixed(1) : '0.0';
        if (insightAvgRespPerQ) insightAvgRespPerQ.textContent = avgResp;

        const sortedQuestions = Object.entries(questionResponseCounts)
            .filter(([qId]) => questionIdToTextMap[qId]) // Filter out questions we no longer have text for
            .sort(([, countA], [, countB]) => countB - countA);

        const topQuestions = sortedQuestions.slice(0, 5);
        const bottomQuestions = sortedQuestions.slice(-3).reverse();

        if (insightTopQuestionsList) {
            insightTopQuestionsList.innerHTML = '';
            if (topQuestions.length > 0) {
                 topQuestions.forEach(([qId, count]) => {
                     const qText = questionIdToTextMap[qId];
                     insightTopQuestionsList.appendChild(formatListItem(qText, count));
                });
            } else {
                 insightTopQuestionsList.innerHTML = '<li>No responses recorded yet.</li>';
            }
        }

        if (insightBottomQuestionsList) {
            insightBottomQuestionsList.innerHTML = '';
            if (bottomQuestions.length > 0 && bottomQuestions.length < totalQuestions) { // Don't show if same as top
                bottomQuestions.forEach(([qId, count]) => {
                     const qText = questionIdToTextMap[qId];
                     insightBottomQuestionsList.appendChild(formatListItem(qText, count));
                });
            } else if (topQuestions.length > 0) { // Only show N/A if there are *some* questions
                insightBottomQuestionsList.innerHTML = '<li>N/A (Few questions or uniform distribution)</li>';
            } else {
                 insightBottomQuestionsList.innerHTML = '<li>No responses recorded yet.</li>';
            }
        }

        // --- Generate Chart Data ---
        const chartLabels = [];
        const chartDataPoints = [];
        const today = new Date();
        for (let i = 6; i >= 0; i--) {
            const date = new Date(today);
            date.setDate(today.getDate() - i);
            const dateStr = date.toISOString().split('T')[0];
            chartLabels.push(dateStr.substring(5));
            chartDataPoints.push(responsesPerDay[dateStr] || 0);
        }

        // --- Render Chart ---
        renderResponseTrendChart(chartLabels, chartDataPoints);

        // --- Show insights grid ---
        loadingInsights.style.display = 'none';
        insightsGrid.style.display = 'grid'; // Use 'grid' display

    } catch (error) {
        console.error("Error calculating or displaying insights:", error);
        if (loadingInsights) loadingInsights.style.display = 'none';
        if (insightsError) {
            insightsError.textContent = `Failed to load insights: ${error.message}`;
            insightsError.style.display = 'block';
        }
    }
}

// --- Chart Rendering Function ---
let responseChartInstance = null; // Variable to hold the chart instance

function renderResponseTrendChart(labels, data) {
    if (!responseTrendChartCanvas) {
         console.warn("Chart canvas element not found.");
         return;
    }

    // Destroy previous chart instance if it exists
    if (responseChartInstance) {
        console.log("Destroying previous chart instance.");
        responseChartInstance.destroy();
        responseChartInstance = null;
    }

     responseTrendChartCanvas.style.display = 'block'; // Make canvas visible
     const chartPlaceholder = responseTrendChartCanvas.previousElementSibling; // Get placeholder div (assumes it's right before)
     if(chartPlaceholder && chartPlaceholder.classList.contains('chart-container')) {
        chartPlaceholder.style.display = 'none'; // Hide placeholder
     }


    const ctx = responseTrendChartCanvas.getContext('2d');
    try {
        responseChartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Responses per Day',
                    data: data,
                    borderColor: 'rgba(160, 82, 45, 0.8)', // var(--color-secondary) approx
                    backgroundColor: 'rgba(160, 82, 45, 0.1)',
                    borderWidth: 2,
                    tension: 0.1,
                    fill: true
                }]
            },
            options: {
                scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false }, tooltip: { mode: 'index', intersect: false } }
            }
        });
        console.log("Chart rendered successfully.");
    } catch (chartError) {
         console.error("Chart.js error:", chartError);
         // Optionally display an error message in the chart area
         responseTrendChartCanvas.style.display = 'none';
         if(chartPlaceholder) chartPlaceholder.style.display = 'block'; // Show placeholder again
         if(chartPlaceholder) chartPlaceholder.textContent = '(Chart failed to load)';
    }
}

// --- Initial Setup & Event Listeners ---
async function initializeAdminDashboard() { // Make async
     console.log("Initializing Admin Dashboard...");
     // Safety check crucial elements for core functionality
     if (!addQuestionForm || !existingQuestionsList || !userListContainer || !loadingInsights || !insightsGrid) {
         console.error("One or more essential admin dashboard elements are missing!");
         // Display a major error to the user?
         document.body.innerHTML = '<p style="color: red; font-weight: bold; padding: 2rem;">Error: Admin dashboard failed to load essential components. Please check the console.</p>';
         return;
     }

     // Fetch basic lists first
     fetchAndPopulateStalls(); // For the dropdown
     displayExistingQuestions();
     displayUsers();

     // Then calculate and display the complex insights
     await calculateAndDisplayInsights(); // Wait for insights to load

     // Add event listeners only if the elements exist
     if (addQuestionForm) {
        addQuestionForm.addEventListener('submit', handleAddQuestionSubmit);
        if(scopeRadios) scopeRadios.forEach(radio => radio.addEventListener('change', handleScopeChange));
     }
     if (existingQuestionsList) {
         existingQuestionsList.addEventListener('click', handleDeleteQuestion);
     }
     if (userListContainer) {
          userListContainer.addEventListener('click', handleUserActions);
     }
}

// --- Auth State Check --- (awaits async init)
let isAdminInitialized = false;
auth.onAuthStateChanged(async (user) => { // Make async
    if (user && !isAdminInitialized) {
         console.log("Admin page: Auth state confirmed, initializing...")
         try {
            await initializeAdminDashboard(); // Await the async init function
            isAdminInitialized = true;
         } catch(initError) {
             console.error("Error during admin dashboard initialization:", initError);
             // Display error to user?
              if(loadingInsights) loadingInsights.style.display = 'none';
              if(insightsError) {
                 insightsError.textContent = "Dashboard failed to initialize. Check console.";
                 insightsError.style.display = 'block';
              }
         }
    } else if (!user) {
        isAdminInitialized = false;
        console.log("Admin page: User logged out.");
         // Optionally clear insights grid on logout
         if(insightsGrid) insightsGrid.style.display = 'none';
         if(loadingInsights) loadingInsights.style.display = 'block';
         if(insightsError) insightsError.style.display = 'none'; // Hide previous errors
         // Destroy chart on logout
         if (responseChartInstance) {
             responseChartInstance.destroy();
             responseChartInstance = null;
         }
    }
});