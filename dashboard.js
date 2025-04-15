// Import necessary Firebase functions (include 'query' and 'where' if not already there)
import {
    getFirestore, collection, getDocs, addDoc, serverTimestamp, query, where, Timestamp
} from "https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js";
import { auth, db } from './auth.js'; // Use relative path

// Get references to DOM elements (remains the same)
const questionsContainer = document.getElementById('questions-container');
const loadingIndicator = document.getElementById('loading-questions');
const noQuestionsMessage = document.getElementById('no-questions');

// --- Helper Function to Get URL Parameters --- (remains the same)
function getQueryParam(param) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(param);
}

// --- Store the captured Stall ID --- (remains the same)
let currentStallId = null;

// --- *** NEW: Helper to get IDs of answered questions *** ---
async function getAnsweredQuestionIds(userId) {
    const answeredIds = new Set();
    if (!userId) return answeredIds; // Return empty set if no user ID

    try {
        const responsesRef = collection(db, "user_responses");
        const q = query(responsesRef, where("userId", "==", userId));
        const responseSnapshot = await getDocs(q);
        responseSnapshot.forEach(doc => {
            // Ensure questionId exists before adding
            if (doc.data().questionId) {
                answeredIds.add(doc.data().questionId);
            }
        });
        console.log("User has answered questions:", Array.from(answeredIds));
    } catch (error) {
        console.error("Error fetching answered questions:", error);
        // Proceed with empty set if error occurs
    }
    return answeredIds;
}

// --- *** NEW: Helper function to render a single question's HTML *** ---
function renderQuestion(questionId, questionData) {
    if (!questionId || !questionData) return; // Basic check

    const questionDiv = document.createElement('div');
    questionDiv.classList.add('question-item');
    questionDiv.setAttribute('id', `question-${questionId}`);

    const questionText = document.createElement('h3');
    questionText.textContent = questionData.text || "[No Question Text]"; // Use placeholder if missing
    questionDiv.appendChild(questionText);

    // Only proceed if options exist and are an array
    if (questionData.options && Array.isArray(questionData.options)) {
        const optionsList = document.createElement('ul');
        optionsList.classList.add('options-list');

        questionData.options.forEach((option, index) => {
            const optionItem = document.createElement('li');
            const input = document.createElement('input');
            input.type = 'radio';
            input.name = `question_${questionId}`;
            input.value = option;
            input.id = `q_${questionId}_opt_${index}`;
            const label = document.createElement('label');
            label.textContent = option;
            label.htmlFor = `q_${questionId}_opt_${index}`;
            optionItem.appendChild(input);
            optionItem.appendChild(label);
            optionsList.appendChild(optionItem);
        });
        questionDiv.appendChild(optionsList);

        const submitButton = document.createElement('button');
        submitButton.textContent = 'Submit Answer';
        submitButton.classList.add('submit-answer-button');
        submitButton.dataset.questionId = questionId; // Store question ID on button
        questionDiv.appendChild(submitButton);
    } else {
        // Handle questions without proper options (or other types later)
        const noOptionsText = document.createElement('p');
        noOptionsText.textContent = "[Question has no valid options]";
        noOptionsText.style.fontStyle = 'italic';
        noOptionsText.style.color = '#888';
        questionDiv.appendChild(noOptionsText);
    }

    // Append the fully constructed div to the container
    questionsContainer.appendChild(questionDiv);
}


// --- *** REVISED: Function to display questions based on scope and stall context *** ---
async function displayQuestions() {
    if (!auth.currentUser) {
        console.log("No user logged in. Cannot display questions.");
        loadingIndicator.style.display = 'none'; // Hide loading indicator
        return;
    }
    const userId = auth.currentUser.uid;

    console.log(`Displaying questions for User: ${userId}, Stall Context ID: ${currentStallId || 'None'}`);

    loadingIndicator.style.display = 'block';
    questionsContainer.innerHTML = ''; // Clear previous questions
    noQuestionsMessage.style.display = 'none';

    try {
        // 1. Get IDs of questions already answered by this user
        const answeredQuestionIds = await getAnsweredQuestionIds(userId);

        // 2. Build Firestore query promises based on stall context
        const questionsRef = collection(db, "questions");
        const queryPromises = [];

        // Always add query for 'global' scope questions
        const globalQuery = query(questionsRef, where("scope", "==", "global"));
        queryPromises.push(getDocs(globalQuery));
        console.log("Fetching global questions...");

        // If we have a stall ID, also add query for 'specific' scope matching the stall
        if (currentStallId) {
            const specificQuery = query(questionsRef,
                where("scope", "==", "specific"),
                where("targetStalls", "array-contains", currentStallId) // Check if stallId is in the array
            );
            queryPromises.push(getDocs(specificQuery));
            console.log(`Fetching specific questions for stall: ${currentStallId}...`);
        } else {
             console.log("No stallId provided, fetching only global questions.");
        }

        // 3. Execute all queries concurrently
        const querySnapshots = await Promise.all(queryPromises);

        // 4. Process results and filter out answered questions
        const questionsToDisplay = new Map(); // Use a Map to avoid duplicates if a question somehow matched both queries

        querySnapshots.forEach(snapshot => {
            snapshot.forEach(doc => {
                const questionId = doc.id;
                // Add to map ONLY if it hasn't been answered yet
                if (!answeredQuestionIds.has(questionId)) {
                    questionsToDisplay.set(questionId, doc.data());
                } else {
                    console.log(`Skipping answered question: ${questionId}`);
                }
            });
        });

        console.log(`Found ${questionsToDisplay.size} questions to display.`);

        // 5. Render the final list of questions
        loadingIndicator.style.display = 'none';

        if (questionsToDisplay.size === 0) {
            noQuestionsMessage.style.display = 'block';
            // Provide a more context-aware message
            if (currentStallId) {
                 noQuestionsMessage.textContent = "No new surveys available for this stall right now. Check back later!";
            } else {
                 noQuestionsMessage.textContent = "No new global surveys available right now. Scan a stall QR code for more!";
            }
            // Consider also checking if any questions existed at all vs all being answered
        } else {
            noQuestionsMessage.style.display = 'none';
            questionsToDisplay.forEach((questionData, questionId) => {
                renderQuestion(questionId, questionData); // Use the helper to render
            });
        }

    } catch (error) {
        console.error("Error fetching or displaying questions: ", error);
        loadingIndicator.style.display = 'none';
        questionsContainer.innerHTML = '<p style="color: red;">Could not load questions. Please try refreshing the page or check console for errors.</p>';
        // Also display error in the noQuestionsMessage area for visibility
        noQuestionsMessage.textContent = "Error loading questions.";
        noQuestionsMessage.style.color = "red";
        noQuestionsMessage.style.display = "block";
    }
}


// --- Function to handle answer submission (Will be modified next to add stallId) ---
async function handleAnswerSubmit(event) {
    // Check if the clicked element is a submit button
    if (!event.target.classList.contains('submit-answer-button')) {
        return; // Ignore clicks that aren't on our submit buttons
    }

    event.preventDefault(); // Prevent any default button action
    const button = event.target;
    const questionId = button.dataset.questionId;

    // Ensure user is logged in
    if (!auth.currentUser) {
        alert("Error: You seem to be logged out. Please log in again.");
        return;
    }
    const userId = auth.currentUser.uid;

    // Find the selected radio button for this specific question
    const selectedOption = document.querySelector(`input[name="question_${questionId}"]:checked`);

    if (!selectedOption) {
        alert("Please select an answer before submitting.");
        return;
    }

    const answerValue = selectedOption.value;

    // Log the context, including the stall ID
    console.log(`Submitting answer for Q:${questionId}, User:${userId}, Answer: ${answerValue}, Stall ID Context: ${currentStallId || 'None'}`);

    // Disable button to prevent multiple submissions
    button.disabled = true;
    button.textContent = 'Submitting...';

    try {
        // Prepare the data object to save
        const responseData = {
            userId: userId,
            questionId: questionId,
            answer: answerValue,
            submittedAt: serverTimestamp(),
            // --- *** ADD THE STALL ID HERE *** ---
            stallId: currentStallId // Add the captured stallId (will be null if no param in URL)
        };

        // Save response to 'user_responses' collection
        const responsesRef = collection(db, "user_responses");
        await addDoc(responsesRef, responseData); // Save the object with the stallId

        console.log("Answer saved successfully with stallId:", currentStallId);

        // Provide feedback to the user - hide the answered question or show a success message
        const questionDiv = document.getElementById(`question-${questionId}`);
        if (questionDiv) {
            questionDiv.innerHTML = `<h3>${questionDiv.querySelector('h3').textContent}</h3><p style="color: green; font-weight: bold;">Thank you for your feedback!</p>`;
        }

        // Check if all questions are now answered
         if (questionsContainer.querySelectorAll('.question-item .submit-answer-button').length === 0) {
            noQuestionsMessage.textContent = "You've answered all available surveys for this context. Great job!";
            noQuestionsMessage.style.display = 'block';
         }

    } catch (error) {
        console.error("Error saving answer: ", error);
        alert("There was an error submitting your answer. Please try again.");
        // Re-enable the button if saving failed
        button.disabled = false;
        button.textContent = 'Submit Answer';
    }
}



// --- Event Listeners & Initialization ---
let initialAuthCheckComplete = false;
auth.onAuthStateChanged(user => {
    if (!initialAuthCheckComplete) {
        initialAuthCheckComplete = true;

        // Capture stallId on page load
        currentStallId = getQueryParam('stall');
        console.log(`Page loaded. Captured stallId from URL: ${currentStallId || 'None'}`);

        if (user) {
            // User is logged in, now display questions *based on context*
            displayQuestions(); // This function now handles filtering

            // Add event listener for answer submissions
            if (questionsContainer) {
                questionsContainer.addEventListener('click', handleAnswerSubmit);
            }
        } else {
             console.log("Dashboard: User not logged in on initial check.");
             // auth.js handles redirection
        }
    } else if(user) {
         // Handle potential edge case: Auth state changes AFTER initial load (rare for simple login)
         // Might need to re-capture stallId or re-display questions if context changes significantly
         // For now, we assume stallId remains constant for the page session
         console.log("Auth state changed after initial load. User logged in.");
         // Consider if displayQuestions() needs to be called again if relevant state changes
    } else {
         // Handle user logging out after the page has loaded
         console.log("Auth state changed after initial load. User logged out.");
         // Clear the questions display? auth.js should redirect anyway.
         questionsContainer.innerHTML = '';
         loadingIndicator.style.display = 'none';
         noQuestionsMessage.style.display = 'none';
    }
});