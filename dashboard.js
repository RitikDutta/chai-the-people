import { getFirestore, collection, getDocs, addDoc, serverTimestamp, query, where, Timestamp } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js";
import { auth, db } from './auth.js'; // Use relative path

// Get references to DOM elements
const questionsContainer = document.getElementById('questions-container');
const loadingIndicator = document.getElementById('loading-questions');
const noQuestionsMessage = document.getElementById('no-questions');

// --- Function to display questions ---
async function displayQuestions() {
    if (!auth.currentUser) {
        console.log("No user logged in. Cannot display questions.");
        // The auth state observer in auth.js should handle redirection anyway
        return;
    }

    const userId = auth.currentUser.uid;
    console.log("Fetching questions for user:", userId);
    loadingIndicator.style.display = 'block'; // Show loading
    questionsContainer.innerHTML = ''; // Clear previous questions (if any)
    noQuestionsMessage.style.display = 'none';

    try {
        // 1. Get IDs of questions the user has already answered
        const answeredQuestionIds = new Set();
        const responsesRef = collection(db, "user_responses");
        const q = query(responsesRef, where("userId", "==", userId));
        const responseSnapshot = await getDocs(q);
        responseSnapshot.forEach(doc => {
            answeredQuestionIds.add(doc.data().questionId);
        });
        console.log("User has answered questions:", Array.from(answeredQuestionIds));

        // 2. Get all active questions from the 'questions' collection
        // (assuming 'active' status or similar - for now, get all)
        const questionsRef = collection(db, "questions");
        // Add ordering if needed, e.g., orderBy('createdAt', 'desc')
        const questionsSnapshot = await getDocs(questionsRef);

        let questionsDisplayed = 0;
        questionsSnapshot.forEach(doc => {
            const questionId = doc.id;
            const questionData = doc.data();

            // 3. Only display questions NOT already answered
            if (!answeredQuestionIds.has(questionId)) {
                 questionsDisplayed++;
                // Create HTML for the question
                const questionDiv = document.createElement('div');
                questionDiv.classList.add('question-item'); // for styling
                questionDiv.setAttribute('id', `question-${questionId}`); // unique id for the div

                const questionText = document.createElement('h3');
                questionText.textContent = questionData.text; // Assuming 'text' field holds the question
                questionDiv.appendChild(questionText);

                // Assuming 'options' field is an array of strings for multiple choice
                if (questionData.options && Array.isArray(questionData.options)) {
                    const optionsList = document.createElement('ul');
                    optionsList.classList.add('options-list');

                    questionData.options.forEach((option, index) => {
                        const optionItem = document.createElement('li');

                        const input = document.createElement('input');
                        input.type = 'radio';
                        input.name = `question_${questionId}`; // Group radio buttons by question
                        input.value = option; // The actual answer value
                        input.id = `q_${questionId}_opt_${index}`; // Unique ID for the label

                        const label = document.createElement('label');
                        label.textContent = option;
                        label.htmlFor = `q_${questionId}_opt_${index}`;

                        optionItem.appendChild(input);
                        optionItem.appendChild(label);
                        optionsList.appendChild(optionItem);
                    });
                    questionDiv.appendChild(optionsList);

                    // Add a submit button for this question
                    const submitButton = document.createElement('button');
                    submitButton.textContent = 'Submit Answer';
                    submitButton.classList.add('submit-answer-button'); // class for event listener
                    submitButton.dataset.questionId = questionId; // Store question ID on the button
                    questionDiv.appendChild(submitButton);

                } else {
                    // Handle other question types later (e.g., text input)
                    const unsupportedText = document.createElement('p');
                    unsupportedText.textContent = "[Question type not supported yet]";
                    questionDiv.appendChild(unsupportedText);
                }

                questionsContainer.appendChild(questionDiv);
            }
        });

        loadingIndicator.style.display = 'none'; // Hide loading

        if (questionsDisplayed === 0) {
            noQuestionsMessage.style.display = 'block'; // Show 'no questions' message
             // If there were questions but all were answered, show a different msg?
             if (questionsSnapshot.size > 0 && answeredQuestionIds.size === questionsSnapshot.size) {
                 noQuestionsMessage.textContent = "You've answered all available surveys. Great job!";
             }
        }

    } catch (error) {
        console.error("Error fetching or displaying questions: ", error);
        loadingIndicator.style.display = 'none';
        questionsContainer.innerHTML = '<p style="color: red;">Could not load questions. Please try refreshing the page.</p>';
    }
}

// --- Function to handle answer submission ---
async function handleAnswerSubmit(event) {
    // Use event delegation: check if the clicked element is a submit button
    if (!event.target.classList.contains('submit-answer-button')) {
        return; // Ignore clicks that aren't on our submit buttons
    }

    event.preventDefault(); // Prevent any default button action
    const button = event.target;
    const questionId = button.dataset.questionId;

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
    console.log(`Submitting answer for Q:${questionId}, User:${userId}, Answer: ${answerValue}`);

    // Disable button to prevent multiple submissions
    button.disabled = true;
    button.textContent = 'Submitting...';

    try {
        // Save response to 'user_responses' collection
        const responsesRef = collection(db, "user_responses");
        await addDoc(responsesRef, {
            userId: userId,
            questionId: questionId,
            answer: answerValue,
            submittedAt: serverTimestamp() // Use server timestamp
        });

        console.log("Answer saved successfully!");
        // Provide feedback to the user - hide the answered question or show a success message
        const questionDiv = document.getElementById(`question-${questionId}`);
        if (questionDiv) {
            // Option 1: Remove the question
            // questionDiv.remove();

            // Option 2: Replace with a success message
            questionDiv.innerHTML = `<h3>${questionDiv.querySelector('h3').textContent}</h3><p style="color: green; font-weight: bold;">Thank you for your feedback!</p>`;
        }
         // Check if there are any more questions left to display
         if (questionsContainer.querySelectorAll('.question-item .submit-answer-button').length === 0) {
            noQuestionsMessage.textContent = "You've answered all available surveys. Great job!";
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


// --- Event Listeners ---

// Wait for auth state to be confirmed before loading questions
let initialAuthCheckComplete = false;
auth.onAuthStateChanged(user => {
    if (!initialAuthCheckComplete) {
        initialAuthCheckComplete = true;
        if (user) {
            // User is logged in, now we can display questions
            displayQuestions();

            // Add the single event listener to the container for answer submissions
            if (questionsContainer) {
                questionsContainer.addEventListener('click', handleAnswerSubmit);
            }
        } else {
             // User is logged out, handled by auth.js redirect
             console.log("Dashboard: User not logged in on initial check.");
        }
    }
});