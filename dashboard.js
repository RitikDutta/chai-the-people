import {
    getFirestore, collection, getDocs, addDoc, serverTimestamp, query, where, Timestamp,
    or // Ensure 'or' is imported
} from "https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js";
import { auth, db } from './auth.js';

// DOM Elements
const questionsContainer = document.getElementById('questions-container');
const loadingIndicator = document.getElementById('loading-questions');
const noQuestionsMessage = document.getElementById('no-questions');

// Helper Function to Get URL Parameters
function getQueryParam(param) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(param);
}

// Store the captured Stall ID
let currentStallId = null;

// --- REVISED: Helper to get IDs of answered questions with more logging ---
async function getAnsweredQuestionIds(userId) {
    const answeredIds = new Set();
    console.log(`[getAnsweredQuestionIds] Fetching for userId: ${userId}`);
    if (!userId) {
        console.warn("[getAnsweredQuestionIds] No userId provided.");
        return answeredIds; // Return empty set immediately
    }

    try {
        const responsesRef = collection(db, "user_responses");
        // Ensure the query is specific to the logged-in user
        const q = query(responsesRef, where("userId", "==", userId));
        console.log("[getAnsweredQuestionIds] Executing query for user responses...");
        // Use { source: 'server' } to try and bypass potential cache issues - might slightly increase reads/latency
        // const responseSnapshot = await getDocs(q, { source: 'server' }); // Option 1: Force server read
        const responseSnapshot = await getDocs(q); // Option 2: Standard read (more common)
        console.log(`[getAnsweredQuestionIds] Query returned ${responseSnapshot.size} response documents.`);

        responseSnapshot.forEach(doc => {
            const responseData = doc.data();
            const questionId = responseData.questionId; // This is the ID of the QUESTION answered
            if (questionId) {
                console.log(`[getAnsweredQuestionIds] Adding questionId to answered set: ${questionId} (from response doc ${doc.id})`);
                answeredIds.add(questionId);
            } else {
                console.warn(`[getAnsweredQuestionIds] Response document ${doc.id} is missing questionId field.`);
            }
        });
        console.log(`[getAnsweredQuestionIds] Final answered set for user ${userId}:`, Array.from(answeredIds));
    } catch (error) {
        console.error("[getAnsweredQuestionIds] Error fetching answered questions:", error);
    }
    return answeredIds; // Return the Set (potentially empty if error or no answers)
}

// Helper function to render a single question's HTML (Keep as is)
function renderQuestion(questionId, questionData) {
    if (!questionId || !questionData || !questionsContainer) return;

    const questionDiv = document.createElement('div');
    questionDiv.classList.add('question-item');
    questionDiv.setAttribute('id', `question-${questionId}`); // Use Question ID for the div ID

    const questionText = document.createElement('h3');
    questionText.textContent = questionData.text || "[No Question Text]";
    questionDiv.appendChild(questionText);

    if (questionData.options && Array.isArray(questionData.options)) {
        const optionsList = document.createElement('ul');
        optionsList.classList.add('options-list');
        questionData.options.forEach((option, index) => {
            const optionItem = document.createElement('li');
            const input = document.createElement('input');
            input.type = 'radio';
            input.name = `question_${questionId}`; // Group radios by Question ID
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
        submitButton.classList.add('button'); // Use general button class from style.css
        submitButton.dataset.questionId = questionId; // Set dataset attribute correctly
        questionDiv.appendChild(submitButton);
    } else {
        const noOptionsText = document.createElement('p');
        noOptionsText.textContent = "[Question has no valid options]";
        noOptionsText.style.fontStyle = 'italic';
        noOptionsText.style.color = '#888';
        questionDiv.appendChild(noOptionsText);
    }
    questionsContainer.appendChild(questionDiv);
}


// --- REVISED: Function to display questions (Focus on reliable filtering) ---
async function displayQuestions() {
    if (!auth.currentUser || !questionsContainer || !loadingIndicator || !noQuestionsMessage) {
        console.error("User not logged in or essential dashboard elements missing.");
        if(loadingIndicator) loadingIndicator.style.display = 'none';
        return;
    }
    const userId = auth.currentUser.uid;
    console.log(`[displayQuestions] Starting for User: ${userId}, Stall Context ID: ${currentStallId || 'None'}`);

    loadingIndicator.style.display = 'block';
    questionsContainer.innerHTML = ''; // Clear previous questions FIRST
    noQuestionsMessage.style.display = 'none';

    try {
        // --- STEP 1: Await the answered IDs ---
        console.log("[displayQuestions] Awaiting answered question IDs...");
        const answeredQuestionIds = await getAnsweredQuestionIds(userId);
        // Log the Set received right after await
        console.log("[displayQuestions] Received answered IDs set (type: Set):", answeredQuestionIds);

        // --- STEP 2: Build the query for potential questions ---
        const questionsRef = collection(db, "questions");
        let finalQuery;
        if (currentStallId) {
            console.log(`[displayQuestions] Building query for scope=global OR targetStalls contains ${currentStallId}`);
            // --- This OR query might require a specific composite index in Firestore ---
            // --- Click the link in the console error if it appears! ---
            finalQuery = query(questionsRef, or( where("scope", "==", "global"), where("targetStalls", "array-contains", currentStallId) ));
        } else {
            console.log("[displayQuestions] Building query for scope=global only");
            finalQuery = query(questionsRef, where("scope", "==", "global"));
        }

        // --- STEP 3: Execute the query ---
        console.log("[displayQuestions] Executing main question query...");
        const querySnapshot = await getDocs(finalQuery);
        console.log(`[displayQuestions] Query returned ${querySnapshot.size} potential questions.`);

        // --- STEP 4: Filter and Render ---
        let questionsDisplayed = 0;
        console.log("[displayQuestions] Filtering potential questions against received answered set...");
        querySnapshot.forEach(doc => {
            const questionId = doc.id; // This IS the document ID from the 'questions' collection
            const questionData = doc.data();

            // --- THE CRITICAL CHECK ---
            // Check if the Set *actually* contains the ID
            const hasAnswered = answeredQuestionIds.has(questionId);
            console.log(`[displayQuestions] Checking questionId: ${questionId}. Is it in the answered set? ${hasAnswered}`);

            if (!hasAnswered) {
                console.log(`[displayQuestions] Rendering question: ${questionId}`);
                renderQuestion(questionId, questionData);
                questionsDisplayed++;
            } else {
                 console.log(`[displayQuestions] Skipping already answered question: ${questionId}`);
            }
        });

        console.log(`[displayQuestions] Finished. Displayed ${questionsDisplayed} questions.`);

        // STEP 5: Handle display of "no questions" message
        loadingIndicator.style.display = 'none';
        if (questionsDisplayed === 0) {
            noQuestionsMessage.style.display = 'block';
             if (querySnapshot.size > 0 && answeredQuestionIds.size > 0) { // Check if questions existed but were answered
                 noQuestionsMessage.textContent = "You've answered all available surveys for this context. Great job!";
            } else {
                if (currentStallId) { noQuestionsMessage.textContent = "No new surveys available for this stall right now."; }
                else { noQuestionsMessage.textContent = "No new global surveys available right now."; }
            }
        } else {
            noQuestionsMessage.style.display = 'none';
        }

    } catch (error) {
        console.error("[displayQuestions] Error fetching or displaying questions: ", error);
        if(loadingIndicator) loadingIndicator.style.display = 'none';
        if(questionsContainer) questionsContainer.innerHTML = '<p class="error-message">Could not load questions. Please try refreshing.</p>';
         if(noQuestionsMessage) {
             noQuestionsMessage.textContent = "Error loading questions.";
             noQuestionsMessage.style.color = "red";
             noQuestionsMessage.style.display = "block";
         }
    }
}


// --- Function to handle answer submission ---
async function handleAnswerSubmit(event) {
    // Check if the clicked element is a submit button and not disabled
    if (!event.target.classList.contains('submit-answer-button') || event.target.disabled) {
        return;
    }
    event.preventDefault();
    const button = event.target;
    const questionId = button.dataset.questionId; // Get question ID from button dataset

    // Double-check questionId presence
    if (!questionId) {
        console.error("[handleAnswerSubmit] Could not find questionId on the button!", button);
        alert("An error occurred (cannot identify question). Please refresh.");
        return;
    }

    if (!auth.currentUser) { alert("Error: You seem to be logged out."); return; }
    const userId = auth.currentUser.uid;

    // Find the selected radio button WITHIN the parent question item
    const questionItemDiv = button.closest('.question-item'); // Find parent div
    if (!questionItemDiv) {
         console.error("[handleAnswerSubmit] Could not find parent question item div for button!", button);
         alert("An error occurred (UI structure issue). Please refresh.");
         return;
    }
    const selectedOption = questionItemDiv.querySelector(`input[name="question_${questionId}"]:checked`);

    if (!selectedOption) { alert("Please select an answer."); return; }
    const answerValue = selectedOption.value;

    console.log(`[handleAnswerSubmit] Submitting answer for Q:${questionId}, User:${userId}, Stall ID: ${currentStallId || 'None'}`);
    button.disabled = true; // Disable button immediately
    button.textContent = 'Submitting...';

    try {
        const responseData = {
            userId: userId,
            questionId: questionId, // Save the correct question ID
            answer: answerValue,
            submittedAt: serverTimestamp(),
            stallId: currentStallId
        };
        const responsesRef = collection(db, "user_responses");
        const docRef = await addDoc(responsesRef, responseData);
        console.log(`[handleAnswerSubmit] Answer saved successfully! Doc ID: ${docRef.id}, QID: ${questionId}`);

        // UI update: Replace question content with thank you message
        const questionDiv = document.getElementById(`question-${questionId}`); // Find the specific question div by its ID
        if (questionDiv) {
             // Simple update: just remove the button and options, keep the title
             const optionsList = questionDiv.querySelector('.options-list');
             const submitBtn = questionDiv.querySelector('.submit-answer-button');
             if (optionsList) optionsList.remove();
             if (submitBtn) submitBtn.remove();

             const feedbackPara = document.createElement('p');
             feedbackPara.innerHTML = `<strong style="color: var(--color-success);">Thank you for your feedback!</strong>`;
             questionDiv.appendChild(feedbackPara);

        } else {
            console.warn(`[handleAnswerSubmit] Could not find question div with ID question-${questionId} to update UI.`);
        }

        // Re-check if any questions left (check remaining buttons)
         if (questionsContainer && questionsContainer.querySelectorAll('.question-item .submit-answer-button').length === 0) {
            if(noQuestionsMessage){
                noQuestionsMessage.textContent = "You've answered all available surveys for this context. Great job!";
                noQuestionsMessage.style.display = 'block';
            }
         }

    } catch (error) {
        console.error("[handleAnswerSubmit] Error saving answer: ", error);
        alert("There was an error submitting your answer. Please try again.");
        // Re-enable button ONLY if saving failed
        button.disabled = false;
        button.textContent = 'Submit Answer';
    }
}

// --- Event Listeners & Initialization ---
let pageInitialized = false; // Use a more specific flag name

auth.onAuthStateChanged(user => {
    // This listener might fire multiple times (initial check, token refresh).
    // We only want to run the *full page setup* once per effective login session.

    if (user) {
        // User is logged in or state confirmed
        if (!pageInitialized) { // Only initialize fully the first time user is confirmed
            pageInitialized = true;
            console.log("[AuthState] Page Initializing: User confirmed.");
            const rawStallId = getQueryParam('stall');
            currentStallId = rawStallId ? rawStallId.toLowerCase() : null;
            console.log(`[AuthState] Captured stallId: ${currentStallId || 'None'}`);
            displayQuestions(); // Trigger initial display

            // Add event listener
            if (questionsContainer && !questionsContainer.hasAttribute('data-listener-added')) {
                questionsContainer.addEventListener('click', handleAnswerSubmit);
                questionsContainer.setAttribute('data-listener-added', 'true');
                console.log("[AuthState] Submit listener added.");
            }
        } else {
             console.log("[AuthState] Auth state confirmed again, page already initialized.");
             // Optionally, could re-run displayQuestions() here if needed based on specific app logic
             // but generally not needed unless context (like stallId) might change dynamically without page reload
        }
    } else {
        // User logged out or initial state is logged out
        if (pageInitialized) { // Only log/clear if page was previously initialized
             console.log("[AuthState] User logged out after initialization.");
             // Clear content
             if (questionsContainer) questionsContainer.innerHTML = '';
             if (loadingIndicator) loadingIndicator.style.display = 'none';
             if (noQuestionsMessage) noQuestionsMessage.style.display = 'none';
             // Reset flag
             pageInitialized = false;
             // Note: auth.js should handle redirection
        } else {
            console.log("[AuthState] Initial check: User not logged in.");
        }
    }
});