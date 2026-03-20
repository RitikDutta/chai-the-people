import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
} from "https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js";
import { auth, db } from "./auth.js";

const insightTotalResponses = document.getElementById("insight-total-responses");
const insightTotalQuestions = document.getElementById("insight-total-questions");
const insightTotalStalls = document.getElementById("insight-total-stalls");
const insightTotalUsers = document.getElementById("insight-total-users");
const trendingDiscourse = document.getElementById("trending-discourse");
const recentSignalsList = document.getElementById("recent-signals-list");

const addQuestionForm = document.getElementById("add-question-form");
const newQuestionText = document.getElementById("new-question-text");
const newQuestionOptions = document.getElementById("new-question-options");
const addQuestionStatus = document.getElementById("add-question-status");
const targetStallsGroup = document.getElementById("target-stalls-group");
const targetStallsSelect = document.getElementById("new-question-target-select");
const noStallsMessage = document.getElementById("no-stalls-message");
const existingQuestionsList = document.getElementById("existing-questions-list");
const noExistingQuestions = document.getElementById("no-existing-questions");

const userTableBody = document.getElementById("user-table-body");
const noUsersFound = document.getElementById("no-users-found");
const userActionStatus = document.getElementById("user-action-status");

function showStatus(element, message, isError = false) {
  if (!element) {
    return;
  }

  element.textContent = message || "";
  element.className = isError
    ? "mt-4 text-sm font-semibold text-red-700"
    : "mt-4 text-sm font-semibold text-primary";
  element.hidden = !message;
}

function truncateText(value, maxLength = 100) {
  return value.length > maxLength ? `${value.slice(0, maxLength - 3)}...` : value;
}

async function fetchCollections() {
  const [usersSnapshot, stallsSnapshot, questionsSnapshot, responsesSnapshot] = await Promise.all([
    getDocs(collection(db, "users")),
    getDocs(collection(db, "stalls")),
    getDocs(collection(db, "questions")),
    getDocs(collection(db, "user_responses")),
  ]);

  return { usersSnapshot, stallsSnapshot, questionsSnapshot, responsesSnapshot };
}

function renderInsights({ usersSnapshot, stallsSnapshot, questionsSnapshot, responsesSnapshot }) {
  if (insightTotalUsers) {
    insightTotalUsers.textContent = String(usersSnapshot.size);
  }
  if (insightTotalStalls) {
    insightTotalStalls.textContent = String(stallsSnapshot.size);
  }
  if (insightTotalQuestions) {
    insightTotalQuestions.textContent = String(questionsSnapshot.size);
  }
  if (insightTotalResponses) {
    insightTotalResponses.textContent = String(responsesSnapshot.size);
  }

  const questionMap = new Map();
  questionsSnapshot.forEach((questionDoc) => {
    questionMap.set(questionDoc.id, questionDoc.data().text || "Untitled prompt");
  });

  const responseCounts = new Map();
  const recentSignals = [];

  responsesSnapshot.forEach((responseDoc) => {
    const response = responseDoc.data();
    responseCounts.set(response.questionId, (responseCounts.get(response.questionId) || 0) + 1);
    recentSignals.push(response);
  });

  const topTopics = [...responseCounts.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 7)
    .map(([questionId]) => truncateText(questionMap.get(questionId) || "Civic prompt", 40));

  if (trendingDiscourse) {
    trendingDiscourse.innerHTML = "";
    topTopics.forEach((topic, index) => {
      const pill = document.createElement("span");
      pill.className = index % 2 === 0
        ? "rounded-full bg-white/10 px-4 py-2 text-lg font-headline italic"
        : "rounded-full bg-white/5 px-4 py-2 text-sm font-body";
      pill.textContent = topic;
      trendingDiscourse.appendChild(pill);
    });
  }

  if (recentSignalsList) {
    recentSignalsList.innerHTML = "";
    recentSignals
      .sort((left, right) => {
        const leftDate = left.submittedAt?.toDate?.() || new Date(0);
        const rightDate = right.submittedAt?.toDate?.() || new Date(0);
        return rightDate - leftDate;
      })
      .slice(0, 5)
      .forEach((response, index) => {
        const card = document.createElement("div");
        card.className =
          index % 2 === 0
            ? "rounded-xl border-l-4 border-tertiary bg-white p-6 shadow-sm"
            : "rounded-xl border-l-4 border-secondary bg-white p-6 shadow-sm";
        card.innerHTML = `
          <p class="mb-2 italic text-on-surface">"${truncateText(questionMap.get(response.questionId) || "Civic prompt", 90)}"</p>
          <div class="flex items-center justify-between text-[10px] uppercase tracking-tighter text-on-surface-variant">
            <span>Answer: ${truncateText(String(response.answer || "N/A"), 40)}</span>
            <span>${response.stallId || "Global"}</span>
          </div>
        `;
        recentSignalsList.appendChild(card);
      });
  }
}

async function fetchAndPopulateStalls() {
  if (!targetStallsSelect) {
    return;
  }

  const snapshot = await getDocs(collection(db, "stalls"));
  targetStallsSelect.innerHTML = "";

  if (snapshot.empty) {
    if (noStallsMessage) {
      noStallsMessage.hidden = false;
    }
    return;
  }

  if (noStallsMessage) {
    noStallsMessage.hidden = true;
  }

  snapshot.docs
    .map((stallDoc) => stallDoc.data())
    .sort((left, right) => String(left.name || "").localeCompare(String(right.name || "")))
    .forEach((stall) => {
    const option = document.createElement("option");
    option.value = String(stall.stallId || "").toLowerCase();
    option.textContent = `${stall.name || "Unnamed Stall"} (${stall.stallId || "N/A"})`;
    targetStallsSelect.appendChild(option);
    });
}

async function renderQuestions() {
  if (!existingQuestionsList) {
    return;
  }

  const snapshot = await getDocs(collection(db, "questions"));
  existingQuestionsList.innerHTML = "";

  if (snapshot.empty) {
    if (noExistingQuestions) {
      noExistingQuestions.hidden = false;
    }
    return;
  }

  if (noExistingQuestions) {
    noExistingQuestions.hidden = true;
  }

  snapshot.docs
    .sort((left, right) => {
      const leftDate = left.data().createdAt?.toDate?.() || new Date(0);
      const rightDate = right.data().createdAt?.toDate?.() || new Date(0);
      return rightDate - leftDate;
    })
    .forEach((questionDoc) => {
    const question = questionDoc.data();
    const wrapper = document.createElement("article");
    wrapper.className = "rounded-xl bg-surface-container-low p-6";
    wrapper.innerHTML = `
      <div class="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h4 class="text-lg font-bold text-primary">${question.text || "Untitled prompt"}</h4>
          <p class="mt-2 text-sm text-on-surface-variant">${(question.options || []).join(" • ") || "No options"}</p>
          <p class="mt-3 text-xs font-bold uppercase tracking-widest text-outline">
            ${question.scope === "specific" ? `Specific: ${(question.targetStalls || []).join(", ")}` : "Global"}
          </p>
        </div>
        <button type="button" data-question-id="${questionDoc.id}" class="rounded-full bg-red-50 px-4 py-2 text-xs font-bold uppercase tracking-widest text-red-700 hover:bg-red-100">
          Delete
        </button>
      </div>
    `;
    existingQuestionsList.appendChild(wrapper);
    });
}

async function renderUsers() {
  if (!userTableBody) {
    return;
  }

  const snapshot = await getDocs(collection(db, "users"));
  userTableBody.innerHTML = "";

  if (snapshot.empty) {
    if (noUsersFound) {
      noUsersFound.hidden = false;
    }
    return;
  }

  if (noUsersFound) {
    noUsersFound.hidden = true;
  }

  snapshot.forEach((userDoc) => {
    const userData = userDoc.data();
    const role = userData.role || "user";
    const isCurrentUser = userDoc.id === auth.currentUser?.uid;

    const row = document.createElement("tr");
    row.className = "border-b border-outline-variant/15";
    row.innerHTML = `
      <td class="px-6 py-4 text-sm font-bold text-on-surface">${userData.name || "Unnamed"}</td>
      <td class="px-6 py-4 text-sm text-on-surface-variant">${userData.email || "N/A"}</td>
      <td class="px-6 py-4 text-sm uppercase tracking-wider text-primary">${role}</td>
      <td class="px-6 py-4">
        <div class="flex flex-wrap gap-2" data-user-id="${userDoc.id}" data-locked="${isCurrentUser ? "true" : "false"}" data-role="${role}" data-email="${userData.email || ""}">
          <button type="button" data-action="promote" class="rounded-full bg-surface-container-high px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-primary ${isCurrentUser ? "cursor-not-allowed opacity-50" : ""}" ${isCurrentUser ? "disabled" : ""}>Promote</button>
          <button type="button" data-action="demote" class="rounded-full bg-surface-container-high px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-secondary ${isCurrentUser ? "cursor-not-allowed opacity-50" : ""}" ${isCurrentUser ? "disabled" : ""}>Demote</button>
          <button type="button" data-action="remove" class="rounded-full bg-red-50 px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-red-700 ${isCurrentUser ? "cursor-not-allowed opacity-50" : ""}" ${isCurrentUser ? "disabled" : ""}>Remove</button>
        </div>
      </td>
    `;
    userTableBody.appendChild(row);
  });
}

async function handleAddQuestion(event) {
  event.preventDefault();

  const scope = addQuestionForm.querySelector('input[name="scope"]:checked')?.value || "global";
  const options = newQuestionOptions.value
    .split("\n")
    .map((option) => option.trim())
    .filter(Boolean);

  if (!newQuestionText.value.trim() || options.length === 0) {
    showStatus(addQuestionStatus, "Question text and at least one option are required.", true);
    return;
  }

  const payload = {
    text: newQuestionText.value.trim(),
    options,
    scope,
    active: true,
    createdAt: serverTimestamp(),
  };

  if (scope === "specific") {
    const selectedStalls = [...targetStallsSelect.selectedOptions].map((option) => option.value);
    if (selectedStalls.length === 0) {
      showStatus(addQuestionStatus, "Select at least one stall for a specific prompt.", true);
      return;
    }
    payload.targetStalls = selectedStalls;
  }

  showStatus(addQuestionStatus, "Saving question...");

  try {
    await addDoc(collection(db, "questions"), payload);
    addQuestionForm.reset();
    targetStallsGroup.hidden = true;
    showStatus(addQuestionStatus, "Question added.");
    await Promise.all([renderQuestions(), initializeInsights()]);
  } catch (error) {
    console.error("Failed to add question:", error);
    showStatus(addQuestionStatus, "We could not save that question.", true);
  }
}

async function handleDeleteQuestion(questionId) {
  await deleteDoc(doc(db, "questions", questionId));
  await Promise.all([renderQuestions(), initializeInsights()]);
}

async function changeUserRole(userId, currentRole, direction) {
  let nextRole = currentRole;

  if (direction === "promote") {
    nextRole = currentRole === "user" ? "shop" : currentRole === "shop" ? "admin" : "admin";
  }

  if (direction === "demote") {
    nextRole = currentRole === "admin" ? "shop" : currentRole === "shop" ? "user" : "user";
  }

  if (nextRole === currentRole) {
    return;
  }

  await updateDoc(doc(db, "users", userId), { role: nextRole });
}

async function removeUser(userId) {
  await deleteDoc(doc(db, "users", userId));
}

async function initializeInsights() {
  const collections = await fetchCollections();
  renderInsights(collections);
}

function wireEvents() {
  if (addQuestionForm && !addQuestionForm.dataset.bound) {
    addQuestionForm.addEventListener("submit", handleAddQuestion);
    addQuestionForm.addEventListener("change", (event) => {
      if (event.target.name === "scope" && targetStallsGroup) {
        targetStallsGroup.hidden = event.target.value !== "specific";
      }
    });
    addQuestionForm.dataset.bound = "true";
  }

  if (existingQuestionsList && !existingQuestionsList.dataset.bound) {
    existingQuestionsList.addEventListener("click", async (event) => {
      const button = event.target.closest("[data-question-id]");
      if (!button) {
        return;
      }

      try {
        await handleDeleteQuestion(button.dataset.questionId);
      } catch (error) {
        console.error("Failed to delete question:", error);
        showStatus(addQuestionStatus, "We could not delete that question.", true);
      }
    });
    existingQuestionsList.dataset.bound = "true";
  }

  if (userTableBody && !userTableBody.dataset.bound) {
    userTableBody.addEventListener("click", async (event) => {
      const button = event.target.closest("[data-action]");
      const actionRoot = event.target.closest("[data-user-id]");
      if (!button || !actionRoot) {
        return;
      }

      const { userId, role } = actionRoot.dataset;
      const action = button.dataset.action;

      try {
        if (actionRoot.dataset.locked === "true") {
          showStatus(userActionStatus, "You cannot change your own admin role from this screen.", true);
          return;
        }
        showStatus(userActionStatus, "Updating user...");
        if (action === "remove") {
          await removeUser(userId);
        } else {
          await changeUserRole(userId, role, action);
        }
        showStatus(userActionStatus, "User updated.");
        await Promise.all([renderUsers(), initializeInsights()]);
      } catch (error) {
        console.error("Failed to update user:", error);
        showStatus(userActionStatus, "We could not update that user.", true);
      }
    });
    userTableBody.dataset.bound = "true";
  }
}

async function initializeAdminDashboard() {
  wireEvents();
  await Promise.all([fetchAndPopulateStalls(), renderQuestions(), renderUsers(), initializeInsights()]);
}

onAuthStateChanged(auth, (user) => {
  if (!user) {
    return;
  }

  initializeAdminDashboard().catch((error) => {
    console.error("Failed to initialize admin dashboard:", error);
    showStatus(userActionStatus, "We could not load the admin dashboard right now.", true);
  });
});
