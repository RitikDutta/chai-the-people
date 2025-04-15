// Import necessary Firebase functions
import {
    getFirestore, collection, getDocs, addDoc, serverTimestamp, query, where, Timestamp
} from "https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js";
import { auth, db } from './auth.js'; // Use relative path

// Get references to DOM elements
const questionsContainer = document.getElementById('questions-container');
const loadingIndicator = document.getElementById('loading-questions');
const noQuestionsMessage = document.getElementById('no-questions');

// --- *** NEW: Helper Function to Get URL Parameters *** ---
function getQueryParam(param) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(param);
}

// --- *** NEW: Store the captured Stall ID *** ---
let currentStallId = null; // Variable to hold the ID for this session

// --- Function to display questions (Will be modified later to USE stallId) ---
async function displayQuestions() {
    if (!auth.currentUser) {
        console.log("No user logged in. Cannot display questions.");
        return;
    }

    // *** Log the captured stall ID when displaying questions ***
    console.log(`Displaying questions. Current stall context ID: ${currentStallId || 'None'}`);

    const userId = auth.currentUser.uid;
    loadingIndicator.style.display = 'block';
    questionsContainer.innerHTML = '';
    noQuestionsMessage.style.display = 'none';

    // --- !!! TODO: Modify the query below later to use currentStallId !!! ---
    // Currently fetches all questions, ignoring scope/stall

    try {
        // 1. Get IDs of questions the user has already answered (existing logic)
        const answeredQuestionIds = new Set();
        const responsesRef = collection(db, "user_responses");
        const qResponses = query(responsesRef, where("userId", "==", userId));
        const responseSnapshot = await getDocs(qResponses);
        responseSnapshot.forEach(doc => {
            answeredQuestionIds.add(doc.data().questionId);
        });
        console.log("User has answered questions:", Array.from(answeredQuestionIds));

        // 2. Get questions (Needs filtering based on stallId and scope later)
        const questionsRef = collection(db, "questions");
        const questionsSnapshot = await getDocs(questionsRef);

        let questionsDisplayed = 0;
        questionsSnapshot.forEach(doc => {
            const questionId = doc.id;
            const questionData = doc.data();

            // --- !!! Placeholder: Later filter based on questionData.scope and currentStallId !!! ---
            let shouldDisplay = true; // Assume display for now

            // Filter out already answered questions
            if (answeredQuestionIds.has(questionId)) {
                 shouldDisplay = false;
            }

            // Add scope filtering logic here in Step 3

            if (shouldDisplay) {
                questionsDisplayed++;
                // Create HTML for the question (existing logic)
                const questionDiv = document.createElement('div');
                questionDiv.classList.add('question-item');
                questionDiv.setAttribute('id', `question-${questionId}`);

                const questionText = document.createElement('h3');
                questionText.textContent = questionData.text;
                questionDiv.appendChild(questionText);

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
                    submitButton.dataset.questionId = questionId;
                    questionDiv.appendChild(submitButton);

                } else {
                    const unsupportedText = document.createElement('p');
                    unsupportedText.textContent = "[Question type not supported yet]";
                    questionDiv.appendChild(unsupportedText);
                }
                questionsContainer.appendChild(questionDiv);
            }
        });

        loadingIndicator.style.display = 'none';

        if (questionsDisplayed === 0) {
            noQuestionsMessage.style.display = 'block';
            if (questionsSnapshot.size > 0 && answeredQuestionIds.size === questionsSnapshot.size) {
                 noQuestionsMessage.textContent = "You've answered all available surveys. Great job!";
             } else {
                 noQuestionsMessage.textContent = "No new surveys available right now. Check back later!";
             }
        }

    } catch (error) {
        console.error("Error fetching or displaying questions: ", error);
        loadingIndicator.style.display = 'none';
        questionsContainer.innerHTML = '<p style="color: red;">Could not load questions. Please try refreshing the page.</p>';
    }
}

// --- Function to handle answer submission (Will be modified later to add stallId) ---
async function handleAnswerSubmit(event) {
    if (!event.target.classList.contains('submit-answer-button')) {
        return;
    }
    event.preventDefault();
    const button = event.target;
    const questionId = button.dataset.questionId;

    if (!auth.currentUser) {
        alert("Error: You seem to be logged out. Please log in again.");
        return;
    }
    const userId = auth.currentUser.uid;
    const selectedOption = document.querySelector(`input[name="question_${questionId}"]:checked`);

    if (!selectedOption) {
        alert("Please select an answer before submitting.");
        return;
    }
    const answerValue = selectedOption.value;

    // *** Log stallId during submission attempt ***
    console.log(`Submitting answer for Q:${questionId}, User:${userId}, Answer: ${answerValue}, Stall ID Context: ${currentStallId || 'None'}`);

    button.disabled = true;
    button.textContent = 'Submitting...';

    // --- !!! TODO: Add currentStallId to the document saved below in Step 2 !!! ---
    try {
        const responsesRef = collection(db, "user_responses");
        await addDoc(responsesRef, {
            userId: userId,
            questionId: questionId,
            answer: answerValue,
            submittedAt: serverTimestamp()
            // stallId: currentStallId // <-- Add this field in the next step
        });

        console.log("Answer saved successfully!");
        const questionDiv = document.getElementById(`question-${questionId}`);
        if (questionDiv) {
            questionDiv.innerHTML = `<h3>${questionDiv.querySelector('h3').textContent}</h3><p style="color: green; font-weight: bold;">Thank you for your feedback!</p>`;
        }
         if (questionsContainer.querySelectorAll('.question-item .submit-answer-button').length === 0) {
            noQuestionsMessage.textContent = "You've answered all available surveys. Great job!";
            noQuestionsMessage.style.display = 'block';
         }

    } catch (error) {
        console.error("Error saving answer: ", error);
        alert("There was an error submitting your answer. Please try again.");
        button.disabled = false;
        button.textContent = 'Submit Answer';
    }
}


// --- Event Listeners & Initialization ---
let initialAuthCheckComplete = false;
auth.onAuthStateChanged(user => {
    if (!initialAuthCheckComplete) {
        initialAuthCheckComplete = true;

        // --- *** NEW: Capture stallId on page load *** ---
        currentStallId = getQueryParam('stall');
        console.log(`Page loaded. Captured stallId from URL: ${currentStallId}`);
        // You could potentially display the stall name here if needed
        // by fetching from the 'stalls' collection using currentStallId

        if (user) {
            // User is logged in, display questions
            displayQuestions();

            if (questionsContainer) {
                questionsContainer.addEventListener('click', handleAnswerSubmit);
            }
        } else {
             console.log("Dashboard: User not logged in on initial check.");
             // auth.js handles redirection
        }
    }
});