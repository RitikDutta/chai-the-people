import {
    getFirestore, collection, addDoc, getDocs, deleteDoc, doc,
    serverTimestamp, query, orderBy
} from "https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js";
import { auth, db } from './auth.js'; // Import auth and db from auth.js

// DOM Elements
const addQuestionForm = document.getElementById('add-question-form');
const newQuestionText = document.getElementById('new-question-text');
const newQuestionOptions = document.getElementById('new-question-options');
const addQuestionStatus = document.getElementById('add-question-status');
const existingQuestionsList = document.getElementById('existing-questions-list');
const loadingExistingQuestions = document.getElementById('loading-existing-questions');
const noExistingQuestions = document.getElementById('no-existing-questions');

// --- Display Existing Questions ---
async function displayExistingQuestions() {
    loadingExistingQuestions.style.display = 'block';
    existingQuestionsList.innerHTML = ''; // Clear previous list
    noExistingQuestions.style.display = 'none';

    try {
        const questionsRef = collection(db, "questions");
        // Order by creation time, newest first maybe?
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

            const questionDiv = document.createElement('div');
            questionDiv.classList.add('question-manage-item'); // for styling
            questionDiv.innerHTML = `
                <div class="question-details">
                    <p><strong>Text:</strong> ${questionData.text}</p>
                    <p><strong>Options:</strong> ${questionData.options ? questionData.options.join(', ') : 'N/A'}</p>
                    <small>ID: ${questionId}</small>
                     <small> | Created: ${questionData.createdAt?.toDate().toLocaleString() ?? 'N/A'}</small>
                </div>
                <button class="delete-button delete-question-button" data-id="${questionId}">Delete</button>
            `;
            // added class delete-question-button specifically for the listener
            existingQuestionsList.appendChild(questionDiv);
        });

    } catch (error) {
        console.error("Error fetching questions: ", error);
        loadingExistingQuestions.style.display = 'none';
        existingQuestionsList.innerHTML = '<p class="error-message">Error loading questions. Please try again.</p>';
    }
}

// --- Handle Add Question Form Submission ---
async function handleAddQuestionSubmit(event) {
    event.preventDefault();
    addQuestionStatus.textContent = ''; // Clear previous status

    const text = newQuestionText.value.trim();
    // Split options by newline, trim whitespace, filter empty lines
    const optionsArray = newQuestionOptions.value.split('\n')
        .map(opt => opt.trim())
        .filter(opt => opt !== '');

    if (!text || optionsArray.length === 0) {
        addQuestionStatus.textContent = 'Error: Please provide question text and at least one option.';
        addQuestionStatus.className = 'status-message error-message'; // Add error class
        return;
    }

     // Disable button during submission
     const submitButton = addQuestionForm.querySelector('button[type="submit"]');
     submitButton.disabled = true;
     addQuestionStatus.textContent = 'Adding question...';
     addQuestionStatus.className = 'status-message'; // Reset class

    try {
        const questionsRef = collection(db, "questions");
        await addDoc(questionsRef, {
            text: text,
            options: optionsArray,
            createdAt: serverTimestamp(),
            active: true // Assuming new questions are active by default
        });

        addQuestionStatus.textContent = 'Question added successfully!';
        addQuestionStatus.className = 'status-message success-message'; // Add success class
        addQuestionForm.reset(); // Clear the form
        displayExistingQuestions(); // Refresh the list

    } catch (error) {
        console.error("Error adding question: ", error);
        addQuestionStatus.textContent = `Error adding question: ${error.message}`;
        addQuestionStatus.className = 'status-message error-message';
    } finally {
         // Re-enable button
         submitButton.disabled = false;
         // Optionally clear status message after few seconds
         setTimeout(() => { addQuestionStatus.textContent = ''; }, 5000);
    }
}

// --- Handle Delete Question Button Click ---
async function handleDeleteQuestion(event) {
    // Event delegation: check if a delete button was clicked
    if (!event.target.classList.contains('delete-question-button')) {
        return;
    }

    const button = event.target;
    const questionId = button.dataset.id;

    if (!questionId) {
        console.error("Missing question ID on delete button.");
        return;
    }

    // Confirmation dialog
    if (!confirm(`Are you sure you want to delete question ID: ${questionId}? This cannot be undone.`)) {
        return;
    }

    // Disable button while deleting
    button.disabled = true;
    button.textContent = 'Deleting...';

    try {
        const questionDocRef = doc(db, "questions", questionId);
        await deleteDoc(questionDocRef);

        console.log("Question deleted successfully:", questionId);
        // Optionally show a temporary message or just rely on list refresh
        displayExistingQuestions(); // Refresh the list to remove the deleted item

    } catch (error) {
        console.error("Error deleting question: ", error);
        alert(`Failed to delete question. Error: ${error.message}`);
        // Re-enable button if deletion failed
        button.disabled = false;
        button.textContent = 'Delete';
    }
}


// --- Initial Setup ---
// This function will run once the auth state is confirmed AND the user is an admin
function initializeAdminDashboard() {
     console.log("Initializing Admin Dashboard...");
     displayExistingQuestions();

     // Add event listeners
     if (addQuestionForm) {
        addQuestionForm.addEventListener('submit', handleAddQuestionSubmit);
     }
     if (existingQuestionsList) {
         // Use event delegation for delete buttons
         existingQuestionsList.addEventListener('click', handleDeleteQuestion);
     }
}

// We need to wait for auth state AND role check from auth.js
// A simple way is to wait for auth.js to finish its check and maybe set a global flag or custom event
// Or, just re-check auth state here, but ensure it only runs if user is admin (handled by auth.js redirect)
let isAdminInitialized = false;
auth.onAuthStateChanged(async (user) => {
    if (user && !isAdminInitialized) {
         // Need to verify role again here or rely on auth.js redirection logic
         // Let's assume auth.js correctly redirects non-admins away from this page.
         // If execution reaches here and user exists, we assume they are admin.
         // (A more robust check would involve fetching the role again here if needed)
         console.log("Admin page: Auth state confirmed, user exists. Initializing...")
         initializeAdminDashboard();
         isAdminInitialized = true; // prevent re-initialization on minor auth changes
    } else if (!user) {
        isAdminInitialized = false; // Reset if user logs out
        console.log("Admin page: User logged out.");
         // auth.js handles the redirect for logged-out users
    }
});