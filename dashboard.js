import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js";
import { auth } from "./auth.js";
import {
  fetchPendingQuestions,
  fetchStallById,
  fetchUserResponseCount,
  normalizeStallId,
  readRememberedStallId,
  rememberStallId,
} from "./survey-data.js";

const currentStallName = document.getElementById("current-stall-name");
const currentStallStatus = document.getElementById("current-stall-status");
const currentStallDetails = document.getElementById("current-stall-details");
const rewardProgressBar = document.getElementById("reward-progress-bar");
const rewardProgressText = document.getElementById("reward-progress-text");
const pendingQuestionCount = document.getElementById("pending-question-count");
const featuredQuestionTitle = document.getElementById("featured-question-title");
const featuredQuestionDescription = document.getElementById("featured-question-description");
const featuredQuestionMeta = document.getElementById("featured-question-meta");
const featuredQuestionPreview = document.getElementById("featured-question-preview");
const featuredStartLink = document.getElementById("featured-start-link");
const availableQuestionsList = document.getElementById("available-questions-list");
const emptyState = document.getElementById("dashboard-empty-state");
const totalResponsesValue = document.getElementById("user-total-responses");
const totalRewardsValue = document.getElementById("user-reward-count");

function getRequestedStallId() {
  const params = new URLSearchParams(window.location.search);
  const fromQuery = normalizeStallId(params.get("stall"));

  if (fromQuery) {
    rememberStallId(fromQuery);
    return fromQuery;
  }

  return readRememberedStallId();
}

function buildSurveyUrl(questionId, stallId) {
  const url = new URL("survey.html", window.location.href);

  if (stallId) {
    url.searchParams.set("stall", stallId);
  }
  if (questionId) {
    url.searchParams.set("question", questionId);
  }

  return `${url.pathname.split("/").pop()}${url.search}`;
}

function renderStallContext(stall) {
  if (!stall) {
    if (currentStallStatus) {
      currentStallStatus.textContent = "Network Mode";
    }
    if (currentStallName) {
      currentStallName.textContent = "Community Prompts";
    }
    if (currentStallDetails) {
      currentStallDetails.textContent = "Browse live public questions from the Chai network.";
    }
    return;
  }

  if (currentStallStatus) {
    currentStallStatus.textContent = "Checked In";
  }
  if (currentStallName) {
    currentStallName.textContent = stall.name || "Partner Stall";
  }
  if (currentStallDetails) {
    const location = stall.location ? ` • ${stall.location}` : "";
    currentStallDetails.textContent = `ID: ${stall.stallId || "N/A"}${location}`;
  }
}

function updateProgress(pendingCount, responseCount) {
  const width = pendingCount > 0 ? Math.min(100, 30 + pendingCount * 20) : responseCount > 0 ? 100 : 10;

  if (rewardProgressBar) {
    rewardProgressBar.style.width = `${Math.min(width, 100)}%`;
  }

  if (rewardProgressText) {
    if (pendingCount > 0) {
      rewardProgressText.textContent = `${pendingCount} live prompt${pendingCount === 1 ? "" : "s"} ready right now.`;
    } else if (responseCount > 0) {
      rewardProgressText.textContent = "You are caught up for now. Check back after the next chai break.";
    } else {
      rewardProgressText.textContent = "Start with your first prompt and begin earning your chai rewards.";
    }
  }

  if (pendingQuestionCount) {
    pendingQuestionCount.textContent = String(pendingCount);
  }
}

function renderFeaturedQuestion(question, stallId) {
  if (!question) {
    if (featuredQuestionTitle) {
      featuredQuestionTitle.textContent = "No new prompts right now";
    }
    if (featuredQuestionDescription) {
      featuredQuestionDescription.textContent =
        "You have answered everything currently available in this context.";
    }
    if (featuredQuestionMeta) {
      featuredQuestionMeta.textContent = "Check back later for the next civic prompt.";
    }
    if (featuredQuestionPreview) {
      featuredQuestionPreview.innerHTML = "<p class=\"text-sm text-on-surface-variant\">You are fully up to date.</p>";
    }
    if (featuredStartLink) {
      featuredStartLink.classList.add("pointer-events-none", "opacity-50");
      featuredStartLink.removeAttribute("href");
    }
    return;
  }

  if (featuredQuestionTitle) {
    featuredQuestionTitle.textContent = question.text || "Live civic prompt";
  }
  if (featuredQuestionDescription) {
    featuredQuestionDescription.textContent =
      question.scope === "specific"
        ? "This prompt is tailored to the stall you are currently visiting."
        : "This prompt is open to everyone across the Chai network.";
  }
  if (featuredQuestionMeta) {
    const optionCount = Array.isArray(question.options) ? question.options.length : 0;
    featuredQuestionMeta.textContent = `${optionCount} options • ${question.scope === "specific" ? "Stall specific" : "Global"}`;
  }
  if (featuredQuestionPreview) {
    const previewOptions = (question.options || [])
      .slice(0, 3)
      .map(
        (option) =>
          `<span class="rounded-full bg-surface-container-highest px-3 py-2 text-xs font-bold text-on-surface">${option}</span>`,
      )
      .join("");
    featuredQuestionPreview.innerHTML = previewOptions || "<span class=\"text-sm text-on-surface-variant\">No options provided.</span>";
  }
  if (featuredStartLink) {
    featuredStartLink.href = buildSurveyUrl(question.id, stallId);
    featuredStartLink.classList.remove("pointer-events-none", "opacity-50");
  }
}

function renderQuestionList(questions, stallId) {
  if (!availableQuestionsList) {
    return;
  }

  availableQuestionsList.innerHTML = "";

  if (questions.length <= 1) {
    availableQuestionsList.innerHTML =
      "<div class=\"rounded-xl bg-surface-container-high p-4 text-sm text-on-surface-variant\">No additional prompts are waiting after the featured one.</div>";
    return;
  }

  questions.slice(1, 6).forEach((question) => {
    const link = document.createElement("a");
    link.href = buildSurveyUrl(question.id, stallId);
    link.className =
      "flex items-center justify-between rounded-lg bg-surface-container-high p-4 transition-colors hover:bg-surface-container";
    link.innerHTML = `
      <div class="flex items-center gap-4">
        <div class="rounded-lg bg-primary/10 p-2 text-primary">
          <span class="material-symbols-outlined" style="font-variation-settings: 'FILL' 1;">quiz</span>
        </div>
        <div>
          <h5 class="text-sm font-bold text-on-surface">${question.text || "Live prompt"}</h5>
          <span class="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
            ${question.scope === "specific" ? "Stall specific" : "Global"}
          </span>
        </div>
      </div>
      <span class="material-symbols-outlined text-on-surface-variant">chevron_right</span>
    `;
    availableQuestionsList.appendChild(link);
  });
}

async function loadDashboard(user) {
  const stallId = getRequestedStallId();
  const [stall, pendingQuestions, responseCount] = await Promise.all([
    fetchStallById(stallId),
    fetchPendingQuestions(user.uid, stallId),
    fetchUserResponseCount(user.uid),
  ]);

  renderStallContext(stall);
  updateProgress(pendingQuestions.length, responseCount);
  renderFeaturedQuestion(pendingQuestions[0], stallId);
  renderQuestionList(pendingQuestions, stallId);

  if (totalResponsesValue) {
    totalResponsesValue.textContent = String(responseCount);
  }
  if (totalRewardsValue) {
    totalRewardsValue.textContent = String(responseCount);
  }
  if (emptyState) {
    emptyState.hidden = pendingQuestions.length > 0;
  }
}

onAuthStateChanged(auth, (user) => {
  if (!user) {
    return;
  }

  loadDashboard(user).catch((error) => {
    console.error("Failed to load user dashboard:", error);
    if (emptyState) {
      emptyState.hidden = false;
      emptyState.textContent = "We could not load your dashboard right now. Please refresh.";
    }
  });
});
