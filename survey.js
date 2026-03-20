import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js";
import { addDoc, collection, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js";
import { auth, db } from "./auth.js";
import {
  fetchPendingQuestions,
  fetchStallById,
  normalizeStallId,
  readRememberedStallId,
  rememberStallId,
} from "./survey-data.js";

const backLink = document.getElementById("survey-back-link");
const surveyTitle = document.getElementById("survey-title");
const surveyContextCopy = document.getElementById("survey-context-copy");
const surveyProgressBar = document.getElementById("survey-progress-bar");
const surveyProgressLabel = document.getElementById("survey-progress-label");
const surveyProgressCopy = document.getElementById("survey-progress-copy");
const surveyQuestionText = document.getElementById("survey-question-text");
const surveyOptions = document.getElementById("survey-options");
const surveyImpactNote = document.getElementById("survey-impact-note");
const surveySubmitButton = document.getElementById("survey-submit-button");
const surveyStatus = document.getElementById("survey-status");

let activeQuestion = null;
let activeQuestionIndex = 0;
let pendingQuestions = [];
let activeStallId = null;
let selectedOption = null;

function setStatus(message, isError = false) {
  if (!surveyStatus) {
    return;
  }

  surveyStatus.textContent = message || "";
  surveyStatus.className = isError
    ? "mt-4 text-sm font-semibold text-red-700"
    : "mt-4 text-sm font-semibold text-primary";
  surveyStatus.hidden = !message;
}

function getRequestedStallId() {
  const params = new URLSearchParams(window.location.search);
  const fromQuery = normalizeStallId(params.get("stall"));

  if (fromQuery) {
    rememberStallId(fromQuery);
    return fromQuery;
  }

  return readRememberedStallId();
}

function getRequestedQuestionId() {
  return new URLSearchParams(window.location.search).get("question");
}

function buildDashboardUrl(stallId) {
  const url = new URL("user_dashboard.html", window.location.href);
  if (stallId) {
    url.searchParams.set("stall", stallId);
  }
  return `${url.pathname.split("/").pop()}${url.search}`;
}

function updateBackLink() {
  if (backLink) {
    backLink.href = buildDashboardUrl(activeStallId);
  }
}

function renderOptions(question) {
  if (!surveyOptions) {
    return;
  }

  surveyOptions.innerHTML = "";

  (question.options || []).forEach((option) => {
    const isSelected = selectedOption === option;
    const button = document.createElement("button");
    button.type = "button";
    button.className = isSelected
      ? "flex w-full items-center justify-between rounded-[1.5rem] bg-surface-container-highest p-6 text-left shadow-sm ring-2 ring-primary transition-all duration-200"
      : "flex w-full items-center justify-between rounded-[1.5rem] bg-surface-container-low p-6 text-left transition-all duration-200 hover:bg-surface-container-high";
    button.innerHTML = `
      <div class="flex items-center gap-4">
        <div class="${isSelected ? "border-primary" : "border-outline-variant"} flex h-6 w-6 items-center justify-center rounded-full border-2">
          <div class="${isSelected ? "bg-primary" : "bg-primary opacity-0"} h-2.5 w-2.5 rounded-full"></div>
        </div>
        <span class="text-lg font-bold text-on-surface">${option}</span>
      </div>
      ${
        isSelected
          ? "<span class=\"material-symbols-outlined text-tertiary\" style=\"font-variation-settings: 'FILL' 1;\">check_circle</span>"
          : ""
      }
    `;
    button.addEventListener("click", () => {
      selectedOption = option;
      renderOptions(question);
      if (surveySubmitButton) {
        surveySubmitButton.disabled = false;
      }
      setStatus("");
    });
    surveyOptions.appendChild(button);
  });
}

function renderSurvey(stall) {
  if (!activeQuestion) {
    if (surveyTitle) {
      surveyTitle.textContent = "All prompts completed";
    }
    if (surveyContextCopy) {
      surveyContextCopy.textContent = "You have already answered everything available here.";
    }
    if (surveyQuestionText) {
      surveyQuestionText.textContent = "There are no more live prompts in this context right now.";
    }
    if (surveyOptions) {
      surveyOptions.innerHTML = "";
    }
    if (surveyImpactNote) {
      surveyImpactNote.textContent = "Return later for new prompts or explore another partner stall.";
    }
    if (surveySubmitButton) {
      surveySubmitButton.disabled = true;
      surveySubmitButton.textContent = "No More Prompts";
    }
    return;
  }

  const total = pendingQuestions.length || 1;
  const percent = Math.round(((activeQuestionIndex + 1) / total) * 100);

  if (surveyTitle) {
    surveyTitle.textContent = stall?.name || "Community Prompt";
  }
  if (surveyContextCopy) {
    surveyContextCopy.textContent = stall
      ? `${stall.location || "Partner location"} • Stall ID ${stall.stallId}`
      : activeQuestion.scope === "specific"
        ? "A stall-specific prompt is ready for you."
        : "This prompt is open across the network.";
  }
  if (surveyProgressBar) {
    surveyProgressBar.style.width = `${percent}%`;
  }
  if (surveyProgressLabel) {
    surveyProgressLabel.textContent = `Question ${activeQuestionIndex + 1} of ${total}`;
  }
  if (surveyProgressCopy) {
    surveyProgressCopy.textContent = `${percent}% ready`;
  }
  if (surveyQuestionText) {
    surveyQuestionText.textContent = activeQuestion.text || "Share your answer";
  }
  if (surveyImpactNote) {
    surveyImpactNote.textContent = stall
      ? `Your response will be tied to ${stall.name} and help improve decisions around this location.`
      : "Your response feeds into the broader Chai network and helps surface civic priorities.";
  }
  if (surveySubmitButton) {
    surveySubmitButton.disabled = true;
    surveySubmitButton.textContent = "Submit Answer";
  }

  selectedOption = null;
  renderOptions(activeQuestion);
}

async function handleSubmit(user) {
  if (!activeQuestion) {
    return;
  }

  if (!selectedOption) {
    setStatus("Choose one option before continuing.", true);
    return;
  }

  if (surveySubmitButton) {
    surveySubmitButton.disabled = true;
    surveySubmitButton.textContent = "Saving...";
  }

  try {
    const responseRef = await addDoc(collection(db, "user_responses"), {
      userId: user.uid,
      questionId: activeQuestion.id,
      answer: selectedOption,
      stallId: activeStallId || null,
      submittedAt: serverTimestamp(),
    });

    const rewardUrl = new URL("reward.html", window.location.href);
    rewardUrl.searchParams.set("response", responseRef.id);
    if (activeStallId) {
      rewardUrl.searchParams.set("stall", activeStallId);
    }

    window.location.href = `${rewardUrl.pathname.split("/").pop()}${rewardUrl.search}`;
  } catch (error) {
    console.error("Failed to submit answer:", error);
    setStatus("We could not save your answer. Please try again.", true);
    if (surveySubmitButton) {
      surveySubmitButton.disabled = false;
      surveySubmitButton.textContent = "Submit Answer";
    }
  }
}

async function loadSurvey(user) {
  activeStallId = getRequestedStallId();
  const [stall, prompts] = await Promise.all([
    fetchStallById(activeStallId),
    fetchPendingQuestions(user.uid, activeStallId),
  ]);

  pendingQuestions = prompts;

  const requestedQuestionId = getRequestedQuestionId();
  const requestedIndex = requestedQuestionId
    ? pendingQuestions.findIndex((question) => question.id === requestedQuestionId)
    : -1;

  activeQuestionIndex = requestedIndex >= 0 ? requestedIndex : 0;
  activeQuestion = pendingQuestions[activeQuestionIndex] || null;

  updateBackLink();
  renderSurvey(stall);

  if (surveySubmitButton && !surveySubmitButton.dataset.bound) {
    surveySubmitButton.addEventListener("click", () => {
      handleSubmit(user);
    });
    surveySubmitButton.dataset.bound = "true";
  }
}

onAuthStateChanged(auth, (user) => {
  if (!user) {
    return;
  }

  loadSurvey(user).catch((error) => {
    console.error("Failed to load survey page:", error);
    setStatus("We could not load this prompt right now. Please refresh.", true);
  });
});
