const TOAST_CONTAINER_ID = "site-toast-container";

function getToastContainer() {
  let container = document.getElementById(TOAST_CONTAINER_ID);

  if (container) {
    return container;
  }

  container = document.createElement("div");
  container.id = TOAST_CONTAINER_ID;
  container.className =
    "pointer-events-none fixed right-4 top-4 z-[100] flex max-w-sm flex-col gap-3";
  document.body.appendChild(container);
  return container;
}

function showToast(message) {
  if (!message) {
    return;
  }

  const container = getToastContainer();
  const toast = document.createElement("div");
  toast.className =
    "pointer-events-auto rounded-2xl border border-[#d5c3b8] bg-[#fff8f1] px-4 py-3 text-sm font-semibold text-[#6f4627] shadow-[0_16px_40px_rgba(30,27,23,0.12)] transition-all duration-200";
  toast.style.opacity = "0";
  toast.style.transform = "translateY(-8px)";
  toast.textContent = message;

  container.appendChild(toast);

  window.requestAnimationFrame(() => {
    toast.style.opacity = "1";
    toast.style.transform = "translateY(0)";
  });

  window.setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(-8px)";
    window.setTimeout(() => toast.remove(), 200);
  }, 2800);
}

function wireToastMessages() {
  document.querySelectorAll("[data-toast-message]").forEach((element) => {
    if (element.dataset.bound) {
      return;
    }

    element.addEventListener("click", (event) => {
      event.preventDefault();
      showToast(element.dataset.toastMessage);
    });

    element.dataset.bound = "true";
  });
}

function wireStoryToggles() {
  document.querySelectorAll("[data-story-toggle]").forEach((button) => {
    if (button.dataset.bound) {
      return;
    }

    button.addEventListener("click", () => {
      const selector = button.dataset.storyToggle;
      const panel = selector ? document.querySelector(selector) : null;
      const label = button.querySelector("[data-story-toggle-label]");

      if (!panel) {
        return;
      }

      const willOpen = panel.hidden;
      panel.hidden = !willOpen;
      button.setAttribute("aria-expanded", String(willOpen));

      if (label) {
        label.textContent = willOpen
          ? button.dataset.labelClose || "Hide Story"
          : button.dataset.labelOpen || "Read Full Story";
      }

      if (willOpen) {
        panel.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    });

    button.dataset.bound = "true";
  });
}

wireToastMessages();
wireStoryToggles();
