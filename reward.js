import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js";
import { auth, db } from "./auth.js";
import { fetchStallById, normalizeStallId, rememberStallId } from "./survey-data.js";

const backLink = document.getElementById("reward-back-link");
const rewardCode = document.getElementById("reward-code");
const rewardStallName = document.getElementById("reward-stall-name");
const rewardValidity = document.getElementById("reward-validity");
const rewardQuestionText = document.getElementById("reward-question-text");
const rewardQr = document.getElementById("reward-qr");
const rewardStatus = document.getElementById("reward-status");
const rewardProgressLink = document.getElementById("reward-progress-link");
const rewardNextLink = document.getElementById("reward-next-link");
const rewardNextLinkMobile = document.getElementById("reward-next-link-mobile");

function setStatus(message, isError = false) {
  if (!rewardStatus) {
    return;
  }

  rewardStatus.textContent = message || "";
  rewardStatus.className = isError
    ? "mt-6 text-center text-sm font-semibold text-red-700"
    : "mt-6 text-center text-sm font-semibold text-primary";
  rewardStatus.hidden = !message;
}

function buildDashboardUrl(stallId) {
  const url = new URL("user_dashboard.html", window.location.href);
  if (stallId) {
    url.searchParams.set("stall", stallId);
  }
  return `${url.pathname.split("/").pop()}${url.search}`;
}

function buildSurveyUrl(stallId) {
  const url = new URL("survey.html", window.location.href);
  if (stallId) {
    url.searchParams.set("stall", stallId);
  }
  return `${url.pathname.split("/").pop()}${url.search}`;
}

function createRewardToken(responseId, stallId) {
  const responsePart = responseId.slice(0, 4).toUpperCase();
  const stallPart = (stallId || "net").slice(0, 3).toUpperCase();
  return `CHAI-${responsePart}-${stallPart}`;
}

function renderQrCode(token, responseId) {
  if (!rewardQr) {
    return;
  }

  rewardQr.innerHTML = "";

  if (typeof window.QRCode !== "function") {
    rewardQr.innerHTML = `<div class="flex h-40 w-40 items-center justify-center rounded-lg bg-on-surface text-background text-sm font-bold">${token}</div>`;
    return;
  }

  new window.QRCode(rewardQr, {
    text: JSON.stringify({ token, responseId }),
    width: 160,
    height: 160,
    colorDark: "#1e1b17",
    colorLight: "#ffffff",
    correctLevel: window.QRCode.CorrectLevel.H,
  });
}

async function loadReward(user) {
  const params = new URLSearchParams(window.location.search);
  const responseId = params.get("response");
  const stallId = normalizeStallId(params.get("stall"));

  if (!responseId) {
    setStatus("No reward was requested.", true);
    return;
  }

  if (stallId) {
    rememberStallId(stallId);
  }

  const responseSnapshot = await getDoc(doc(db, "user_responses", responseId));
  if (!responseSnapshot.exists()) {
    setStatus("That reward could not be found.", true);
    return;
  }

  const response = responseSnapshot.data();
  if (response.userId !== user.uid) {
    setStatus("This reward does not belong to your account.", true);
    return;
  }

  const [stall, questionSnapshot] = await Promise.all([
    fetchStallById(stallId || response.stallId),
    response.questionId ? getDoc(doc(db, "questions", response.questionId)) : Promise.resolve(null),
  ]);
  const effectiveStallId = normalizeStallId(stall?.stallId || response.stallId);
  const token = createRewardToken(responseId, effectiveStallId);
  const questionText = questionSnapshot?.exists?.() ? questionSnapshot.data().text : null;

  if (rewardCode) {
    rewardCode.textContent = `ID: ${token}`;
  }
  if (rewardStallName) {
    rewardStallName.textContent = stall?.name || "your participating stall";
  }
  if (rewardValidity) {
    const submittedAt = response.submittedAt?.toDate?.();
    rewardValidity.textContent = submittedAt
      ? `Generated on ${submittedAt.toLocaleString()}`
      : "Valid for the latest completed prompt";
  }
  if (rewardQuestionText) {
    rewardQuestionText.textContent = questionText
      ? `${questionText} • ${response.answer}`
      : `Saved response: ${response.answer}`;
  }

  renderQrCode(token, responseId);

  const dashboardUrl = buildDashboardUrl(effectiveStallId);
  const surveyUrl = buildSurveyUrl(effectiveStallId);

  if (backLink) {
    backLink.href = dashboardUrl;
  }
  if (rewardProgressLink) {
    rewardProgressLink.href = dashboardUrl;
  }
  if (rewardNextLink) {
    rewardNextLink.href = surveyUrl;
  }
  if (rewardNextLinkMobile) {
    rewardNextLinkMobile.href = surveyUrl;
  }
}

onAuthStateChanged(auth, (user) => {
  if (!user) {
    return;
  }

  loadReward(user).catch((error) => {
    console.error("Failed to load reward:", error);
    setStatus("We could not load your reward right now. Please refresh.", true);
  });
});
