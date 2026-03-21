import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js";
import {
  addDoc,
  collection,
  getDocs,
  limit,
  query,
  serverTimestamp,
  Timestamp,
  where,
} from "https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js";
import { auth, db } from "./auth.js";
import { normalizeStallId, rememberStallId } from "./survey-data.js";

const activeStallSelect = document.getElementById("active-stall-select");
const ownedStallsList = document.getElementById("owned-stalls-list");
const noOwnedStalls = document.getElementById("no-owned-stalls");
const shopActiveStallName = document.getElementById("shop-active-stall-name");
const shopActiveStallMeta = document.getElementById("shop-active-stall-meta");
const shopQrCode = document.getElementById("shop-qr-code");
const downloadQrButton = document.getElementById("download-qr-button");
const printQrButton = document.getElementById("print-qr-button");
const copyLinkButton = document.getElementById("copy-link-button");
const addStallForm = document.getElementById("add-stall-form");
const addStallStatus = document.getElementById("add-stall-status");
const recentResponsesBody = document.getElementById("recent-responses-body");
const shopTotalResponses = document.getElementById("shop-total-responses");
const shopTodayResponses = document.getElementById("shop-today-responses");
const shopStallCount = document.getElementById("shop-stall-count");
const shopActiveSurveys = document.getElementById("shop-active-surveys");
const shopRepeatVisitors = document.getElementById("shop-repeat-visitors");
const shopBestTime = document.getElementById("shop-best-time");
const shopBestDay = document.getElementById("shop-best-day");
const shopLoyaltyStatus = document.getElementById("shop-loyalty-status");
const shopSidebar = document.getElementById("shop-sidebar");
const shopNavBackdrop = document.getElementById("shop-nav-backdrop");
const shopNavOpenButtons = document.querySelectorAll("[data-shop-nav-open]");
const shopNavCloseButtons = document.querySelectorAll("[data-shop-nav-close]");

let ownedStalls = [];
let activeStall = null;
let activeSurveyLink = "";
let allQuestionMap = new Map();

function showStatus(message, isError = false) {
  if (!addStallStatus) {
    return;
  }

  addStallStatus.textContent = message || "";
  addStallStatus.className = isError
    ? "mt-4 text-sm font-semibold text-red-700"
    : "mt-4 text-sm font-semibold text-primary";
  addStallStatus.hidden = !message;
}

function buildSurveyLink(stallId) {
  const url = new URL("survey.html", window.location.href);
  url.searchParams.set("stall", stallId);
  return {
    relative: `${url.pathname.split("/").pop()}${url.search}`,
    absolute: url.href,
  };
}

function createShortUserLabel(userId) {
  return `User #${String(userId || "NA").slice(0, 6).toUpperCase()}`;
}

function isDesktopLayout() {
  return window.matchMedia("(min-width: 1024px)").matches;
}

function setShopNavOpen(isOpen) {
  if (!shopSidebar) {
    return;
  }

  const desktop = isDesktopLayout();
  const open = desktop ? true : isOpen;

  shopSidebar.classList.toggle("-translate-x-full", !open);
  shopSidebar.classList.toggle("translate-x-0", open);

  if (shopNavBackdrop) {
    shopNavBackdrop.classList.toggle("hidden", !isOpen || desktop);
  }

  document.body.classList.toggle("overflow-hidden", isOpen && !desktop);
}

function renderQrCode() {
  if (!shopQrCode || !activeStall) {
    return;
  }

  shopQrCode.innerHTML = "";

  if (typeof window.QRCode !== "function") {
    shopQrCode.innerHTML = `<div class="flex h-48 w-48 items-center justify-center rounded-2xl bg-on-surface text-background text-center text-sm font-bold">${activeSurveyLink}</div>`;
    return;
  }

  new window.QRCode(shopQrCode, {
    text: activeSurveyLink,
    width: 192,
    height: 192,
    colorDark: "#1e1b17",
    colorLight: "#ffffff",
    correctLevel: window.QRCode.CorrectLevel.H,
  });
}

function getQrDownloadSource() {
  const canvas = shopQrCode?.querySelector("canvas");
  if (canvas) {
    return canvas.toDataURL("image/png");
  }

  const image = shopQrCode?.querySelector("img");
  return image?.src || null;
}

function renderOwnedStalls() {
  if (!ownedStallsList || !activeStallSelect || !noOwnedStalls) {
    return;
  }

  activeStallSelect.innerHTML = "";
  ownedStallsList.innerHTML = "";

  if (ownedStalls.length === 0) {
    noOwnedStalls.hidden = false;
    return;
  }

  noOwnedStalls.hidden = true;

  ownedStalls.forEach((stall) => {
    const option = document.createElement("option");
    option.value = stall.stallId;
    option.textContent = `${stall.name} (${stall.stallId})`;
    activeStallSelect.appendChild(option);

    const button = document.createElement("button");
    button.type = "button";
    button.className =
      "w-full rounded-xl bg-surface-container-low p-4 text-left transition-colors hover:bg-surface-container-high";
    button.innerHTML = `
      <p class="text-sm font-bold text-primary">${stall.name}</p>
      <p class="mt-1 text-xs text-on-surface-variant">${stall.stallId}${stall.location ? ` • ${stall.location}` : ""}</p>
    `;
    button.addEventListener("click", () => {
      activeStallSelect.value = stall.stallId;
      setActiveStall(stall.stallId);
    });
    ownedStallsList.appendChild(button);
  });

  activeStallSelect.value = activeStall?.stallId || ownedStalls[0].stallId;
}

async function fetchOwnedStalls(userId) {
  const snapshot = await getDocs(query(collection(db, "stalls"), where("ownerId", "==", userId)));

  ownedStalls = snapshot.docs
    .map((stallDoc) => ({
      id: stallDoc.id,
      ...stallDoc.data(),
    }))
    .sort((left, right) => String(left.name || "").localeCompare(String(right.name || "")));
}

async function fetchAllQuestions() {
  const snapshot = await getDocs(collection(db, "questions"));
  allQuestionMap = new Map();
  snapshot.forEach((questionDoc) => {
    allQuestionMap.set(questionDoc.id, questionDoc.data());
  });
}

async function fetchResponsesForStalls(stallIds) {
  const responses = [];

  for (let index = 0; index < stallIds.length; index += 30) {
    const batch = stallIds.slice(index, index + 30);
    const snapshot = await getDocs(query(collection(db, "user_responses"), where("stallId", "in", batch)));
    snapshot.forEach((responseDoc) => {
      responses.push({
        id: responseDoc.id,
        ...responseDoc.data(),
      });
    });
  }

  return responses;
}

function countActiveQuestionsForStall(stallId) {
  let count = 0;

  allQuestionMap.forEach((question) => {
    if (question.active === false) {
      return;
    }

    if (question.scope === "global") {
      count += 1;
      return;
    }

    if (Array.isArray(question.targetStalls) && question.targetStalls.includes(stallId)) {
      count += 1;
    }
  });

  return count;
}

function calculateRepeatVisitorRate(responses) {
  const counts = new Map();
  responses.forEach((response) => {
    const nextValue = (counts.get(response.userId) || 0) + 1;
    counts.set(response.userId, nextValue);
  });

  if (counts.size === 0) {
    return "0%";
  }

  let repeatCount = 0;
  counts.forEach((count) => {
    if (count > 1) {
      repeatCount += 1;
    }
  });

  return `${Math.round((repeatCount / counts.size) * 100)}%`;
}

function findBestHourLabel(responses) {
  if (responses.length === 0) {
    return "No traffic yet";
  }

  const hourCounts = new Map();
  responses.forEach((response) => {
    const date = response.submittedAt?.toDate?.();
    if (!date) {
      return;
    }
    const hour = date.getHours();
    hourCounts.set(hour, (hourCounts.get(hour) || 0) + 1);
  });

  const [bestHour] = [...hourCounts.entries()].sort((left, right) => right[1] - left[1])[0];
  const nextHour = (bestHour + 1) % 24;
  return `${bestHour}:00 - ${nextHour}:00`;
}

function findBestDayLabel(responses) {
  if (responses.length === 0) {
    return "No activity yet";
  }

  const dayCounts = new Map();
  const labels = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  responses.forEach((response) => {
    const date = response.submittedAt?.toDate?.();
    if (!date) {
      return;
    }
    const day = date.getDay();
    dayCounts.set(day, (dayCounts.get(day) || 0) + 1);
  });

  const [bestDay] = [...dayCounts.entries()].sort((left, right) => right[1] - left[1])[0];
  return labels[bestDay];
}

async function renderRecentResponses(stallId) {
  if (!recentResponsesBody) {
    return;
  }

  const snapshot = await getDocs(query(collection(db, "user_responses"), where("stallId", "==", stallId)));
  const rows = snapshot.docs
    .map((responseDoc) => ({
      id: responseDoc.id,
      ...responseDoc.data(),
    }))
    .sort((left, right) => {
      const leftDate = left.submittedAt?.toDate?.() || new Date(0);
      const rightDate = right.submittedAt?.toDate?.() || new Date(0);
      return rightDate - leftDate;
    })
    .slice(0, 8);

  recentResponsesBody.innerHTML = "";

  if (rows.length === 0) {
    recentResponsesBody.innerHTML =
      "<tr><td colspan=\"4\" class=\"px-4 py-6 text-sm text-on-surface-variant sm:px-8\">No recent responses for this stall yet.</td></tr>";
    return;
  }

  rows.forEach((response) => {
    const questionText = allQuestionMap.get(response.questionId)?.text || "Civic prompt";
    const submittedAt = response.submittedAt?.toDate?.();
    const timeLabel = submittedAt ? submittedAt.toLocaleString() : "Pending sync";

    const row = document.createElement("tr");
    row.className = "transition-colors hover:bg-surface-container-high";
    row.innerHTML = `
      <td class="px-4 py-4 text-sm font-bold text-on-surface sm:px-8">${createShortUserLabel(response.userId)}</td>
      <td class="px-4 py-4 text-sm italic text-on-surface-variant sm:px-8">${questionText}</td>
      <td class="px-4 py-4 sm:px-8">
        <span class="rounded-full bg-tertiary-fixed px-2.5 py-1 text-[10px] font-bold uppercase text-on-tertiary-fixed">Completed</span>
      </td>
      <td class="px-4 py-4 text-xs text-outline sm:px-8">${timeLabel}</td>
    `;
    recentResponsesBody.appendChild(row);
  });
}

async function renderShopStats() {
  const stallIds = ownedStalls.map((stall) => stall.stallId).filter(Boolean);
  const responses = stallIds.length > 0 ? await fetchResponsesForStalls(stallIds) : [];

  const todayStart = Timestamp.fromDate(new Date(new Date().setHours(0, 0, 0, 0)));
  const todayCount = responses.filter((response) => response.submittedAt instanceof Timestamp && response.submittedAt >= todayStart).length;

  if (shopTotalResponses) {
    shopTotalResponses.textContent = String(responses.length);
  }
  if (shopTodayResponses) {
    shopTodayResponses.textContent = String(todayCount);
  }
  if (shopStallCount) {
    shopStallCount.textContent = String(ownedStalls.length);
  }
  if (shopActiveSurveys) {
    shopActiveSurveys.textContent = activeStall ? String(countActiveQuestionsForStall(activeStall.stallId)) : "0";
  }
  if (shopRepeatVisitors) {
    shopRepeatVisitors.textContent = calculateRepeatVisitorRate(responses);
  }

  const activeResponses = responses.filter((response) => response.stallId === activeStall?.stallId);
  if (shopBestTime) {
    shopBestTime.textContent = findBestHourLabel(activeResponses);
  }
  if (shopBestDay) {
    shopBestDay.textContent = findBestDayLabel(activeResponses);
  }
  if (shopLoyaltyStatus) {
    const repeatRate = calculateRepeatVisitorRate(activeResponses);
    shopLoyaltyStatus.textContent = repeatRate === "0%" ? "Building Momentum" : `Repeat voices ${repeatRate}`;
  }
}

async function setActiveStall(stallId) {
  activeStall = ownedStalls.find((stall) => stall.stallId === stallId) || ownedStalls[0] || null;

  if (!activeStall) {
    return;
  }

  if (activeStallSelect) {
    activeStallSelect.value = activeStall.stallId;
  }

  rememberStallId(activeStall.stallId);
  activeSurveyLink = buildSurveyLink(activeStall.stallId).absolute;

  if (shopActiveStallName) {
    shopActiveStallName.textContent = activeStall.name || "Partner Stall";
  }
  if (shopActiveStallMeta) {
    shopActiveStallMeta.textContent = `${activeStall.stallId}${activeStall.location ? ` • ${activeStall.location}` : ""}`;
  }

  renderQrCode();
  await Promise.all([renderRecentResponses(activeStall.stallId), renderShopStats()]);
}

async function handleAddStallSubmit(event) {
  event.preventDefault();

  const form = event.currentTarget;
  const stallName = form.elements.namedItem("stall-name")?.value.trim() || "";
  const stallId = normalizeStallId(form.elements.namedItem("stall-id")?.value || "");
  const stallLocation = form.elements.namedItem("stall-location")?.value.trim() || "";

  if (!stallName || !stallId) {
    showStatus("Stall name and a unique stall ID are required.", true);
    return;
  }

  if (!/^[a-z0-9_]+$/.test(stallId)) {
    showStatus("Use only lowercase letters, numbers, and underscores in the stall ID.", true);
    return;
  }

  showStatus("Adding stall...");

  try {
    const existingSnapshot = await getDocs(
      query(collection(db, "stalls"), where("stallId", "==", stallId), limit(1)),
    );

    if (!existingSnapshot.empty) {
      showStatus(`The stall ID "${stallId}" is already in use.`, true);
      return;
    }

    await addDoc(collection(db, "stalls"), {
      name: stallName,
      stallId,
      location: stallLocation,
      ownerId: auth.currentUser.uid,
      createdAt: serverTimestamp(),
    });

    form.reset();
    showStatus("Stall added successfully.");

    await fetchOwnedStalls(auth.currentUser.uid);
    renderOwnedStalls();
    await setActiveStall(stallId);
  } catch (error) {
    console.error("Failed to add stall:", error);
    showStatus("We could not add that stall. Please try again.", true);
  }
}

function wireActions() {
  if (shopSidebar && !shopSidebar.dataset.bound) {
    shopNavOpenButtons.forEach((button) => {
      button.addEventListener("click", () => {
        setShopNavOpen(true);
      });
    });

    shopNavCloseButtons.forEach((button) => {
      button.addEventListener("click", () => {
        setShopNavOpen(false);
      });
    });

    if (shopNavBackdrop) {
      shopNavBackdrop.addEventListener("click", () => {
        setShopNavOpen(false);
      });
    }

    window.addEventListener("resize", () => {
      setShopNavOpen(false);
    });

    window.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        setShopNavOpen(false);
      }
    });

    shopSidebar.dataset.bound = "true";
    setShopNavOpen(false);
  }

  if (activeStallSelect && !activeStallSelect.dataset.bound) {
    activeStallSelect.addEventListener("change", (event) => {
      setActiveStall(event.target.value);
    });
    activeStallSelect.dataset.bound = "true";
  }

  if (copyLinkButton && !copyLinkButton.dataset.bound) {
    copyLinkButton.addEventListener("click", async () => {
      if (!activeSurveyLink) {
        return;
      }

      try {
        await navigator.clipboard.writeText(activeSurveyLink);
        copyLinkButton.innerHTML =
          '<span class="material-symbols-outlined text-[18px]">check</span>Copied';
        window.setTimeout(() => {
          copyLinkButton.innerHTML =
            '<span class="material-symbols-outlined text-[18px]" data-icon="content_copy">content_copy</span>Copy Link';
        }, 1500);
      } catch (error) {
        console.error("Failed to copy link:", error);
        showStatus("Copy failed. You can use the printed poster instead.", true);
      }
    });
    copyLinkButton.dataset.bound = "true";
  }

  if (downloadQrButton && !downloadQrButton.dataset.bound) {
    downloadQrButton.addEventListener("click", () => {
      const source = getQrDownloadSource();
      if (!source) {
        return;
      }

      const link = document.createElement("a");
      link.href = source;
      link.download = `${activeStall?.stallId || "stall"}-qr.png`;
      link.click();
    });
    downloadQrButton.dataset.bound = "true";
  }

  if (printQrButton && !printQrButton.dataset.bound) {
    printQrButton.addEventListener("click", () => {
      const source = getQrDownloadSource();
      if (!source || !activeStall) {
        return;
      }

      const printWindow = window.open("", "_blank", "width=700,height=900");
      if (!printWindow) {
        return;
      }

      printWindow.document.write(`
        <html>
          <head>
            <title>${activeStall.name} Poster</title>
            <style>
              body { font-family: Arial, sans-serif; padding: 40px; text-align: center; }
              img { width: 280px; height: 280px; margin: 24px auto; }
            </style>
          </head>
          <body>
            <h1>${activeStall.name}</h1>
            <p>Scan to answer the live prompt and claim chai.</p>
            <img src="${source}" alt="QR code">
            <p>${activeSurveyLink}</p>
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.focus();
      printWindow.print();
    });
    printQrButton.dataset.bound = "true";
  }

  if (addStallForm && !addStallForm.dataset.bound) {
    addStallForm.addEventListener("submit", handleAddStallSubmit);
    addStallForm.dataset.bound = "true";
  }
}

async function initializeShopDashboard(user) {
  await Promise.all([fetchOwnedStalls(user.uid), fetchAllQuestions()]);
  renderOwnedStalls();
  wireActions();

  if (ownedStalls.length > 0) {
    const requestedStallId =
      normalizeStallId(new URLSearchParams(window.location.search).get("stall")) || ownedStalls[0].stallId;
    await setActiveStall(requestedStallId);
  } else {
    await renderShopStats();
  }
}

onAuthStateChanged(auth, (user) => {
  if (!user) {
    return;
  }

  initializeShopDashboard(user).catch((error) => {
    console.error("Failed to initialize shop dashboard:", error);
    showStatus("We could not load your shop dashboard right now.", true);
  });
});
