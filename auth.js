import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
} from "https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCkcPBhFk6NsVZ9PHQGIDZY6QhbRbvBM80",
  authDomain: "actbuildertest.firebaseapp.com",
  projectId: "actbuildertest",
  storageBucket: "actbuildertest.firebasestorage.app",
  messagingSenderId: "211406345282",
  appId: "1:211406345282:web:ac9666a560e00ca2ecc9db",
};

const ROUTES = Object.freeze({
  home: "index.html",
  login: "login.html",
  register: "register.html",
  howItWorks: "how_it_works.html",
  vendorStories: "vendor_stories.html",
  userDashboard: "user_dashboard.html",
  shopDashboard: "shop_dashboard.html",
  adminDashboard: "admin_dashboard.html",
  survey: "survey.html",
  reward: "reward.html",
});

const ROLE_ROUTES = Object.freeze({
  user: ROUTES.userDashboard,
  shop: ROUTES.shopDashboard,
  admin: ROUTES.adminDashboard,
});

const PROTECTED_PAGES = new Set([
  ROUTES.userDashboard,
  ROUTES.shopDashboard,
  ROUTES.adminDashboard,
  ROUTES.survey,
  ROUTES.reward,
]);

const ALLOWED_ROUTES = new Set(Object.values(ROUTES));

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

function getCurrentPageName() {
  return window.location.pathname.split("/").pop() || ROUTES.home;
}

function getCurrentRelativeUrl() {
  const pageName = getCurrentPageName();
  return `${pageName}${window.location.search}${window.location.hash}`;
}

function readQueryParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}

function normalizeRedirectTarget(rawTarget) {
  if (!rawTarget) {
    return null;
  }

  try {
    const url = new URL(rawTarget, window.location.href);
    const pageName = url.pathname.split("/").pop() || ROUTES.home;

    if (!ALLOWED_ROUTES.has(pageName)) {
      return null;
    }

    return `${pageName}${url.search}${url.hash}`;
  } catch (error) {
    console.warn("Ignoring invalid redirect target:", rawTarget, error);
    return null;
  }
}

function buildAuthPageUrl(pageName) {
  const currentPage = getCurrentPageName();
  const currentUrl = getCurrentRelativeUrl();
  const target = new URL(pageName, window.location.href);
  const existingRedirect = normalizeRedirectTarget(readQueryParam("redirect"));
  const shouldPreserveContext = PROTECTED_PAGES.has(currentPage)
    || document.body?.dataset.requiresAuth === "true"
    || new URLSearchParams(window.location.search).has("stall")
    || Boolean(existingRedirect);

  if (currentPage !== pageName && shouldPreserveContext) {
    target.searchParams.set("redirect", existingRedirect || currentUrl);
  }

  return `${target.pathname.split("/").pop()}${target.search}`;
}

function redirectTo(target) {
  if (target) {
    window.location.href = target;
  }
}

function setDisplay(element, visible, displayValue = "") {
  if (!element) {
    return;
  }

  element.hidden = !visible;

  if (visible) {
    if (displayValue) {
      element.style.display = displayValue;
    } else {
      element.style.removeProperty("display");
    }
  } else {
    element.style.display = "none";
  }
}

function updateAnchorHref(target, href) {
  if (!target) {
    return;
  }

  if (target.tagName === "A") {
    target.href = href;
    return;
  }

  const anchor = target.querySelector("a");
  if (anchor) {
    anchor.href = href;
  }
}

function updateContextualLinks() {
  const loginUrl = buildAuthPageUrl(ROUTES.login);
  const registerUrl = buildAuthPageUrl(ROUTES.register);

  document.querySelectorAll('[data-auth-link="login"]').forEach((element) => {
    updateAnchorHref(element, loginUrl);
  });
  document.querySelectorAll('[data-auth-link="register"]').forEach((element) => {
    updateAnchorHref(element, registerUrl);
  });

  updateAnchorHref(document.getElementById("nav-login"), loginUrl);
  updateAnchorHref(document.getElementById("nav-register"), registerUrl);
}

function updateDashboardLinks(role = "user") {
  const dashboardRoute = ROLE_ROUTES[role] || ROUTES.userDashboard;

  document.querySelectorAll("[data-dashboard-link]").forEach((element) => {
    updateAnchorHref(element, dashboardRoute);
  });

  updateAnchorHref(document.getElementById("nav-dashboard"), ROUTES.userDashboard);
  updateAnchorHref(document.getElementById("nav-shop-dash"), ROUTES.shopDashboard);
  updateAnchorHref(document.getElementById("nav-admin-dash"), ROUTES.adminDashboard);
}

function setConditionalVisibility(isAuthenticated, role = null) {
  document.querySelectorAll("[data-auth-visible]").forEach((element) => {
    const expectedState = element.dataset.authVisible;
    const visible = expectedState === "in" ? isAuthenticated : !isAuthenticated;
    setDisplay(element, visible, element.dataset.display || "");
  });

  document.querySelectorAll("[data-role-visible]").forEach((element) => {
    const visible = Boolean(isAuthenticated && role && element.dataset.roleVisible === role);
    setDisplay(element, visible, element.dataset.display || "");
  });

  setDisplay(document.getElementById("nav-login"), !isAuthenticated, "inline-flex");
  setDisplay(document.getElementById("nav-register"), !isAuthenticated, "inline-flex");
  setDisplay(document.getElementById("nav-logout"), isAuthenticated, "inline-flex");
  setDisplay(document.getElementById("nav-dashboard"), Boolean(isAuthenticated && role === "user"), "inline-flex");
  setDisplay(document.getElementById("nav-shop-dash"), Boolean(isAuthenticated && role === "shop"), "inline-flex");
  setDisplay(document.getElementById("nav-admin-dash"), Boolean(isAuthenticated && role === "admin"), "inline-flex");
  setDisplay(document.getElementById("user-greeting"), isAuthenticated, "inline-flex");
}

function updateIdentityLabels(user, profile) {
  const name = profile?.name || user?.email?.split("@")[0] || "Guest";
  const role = profile?.role || "user";
  const initial = name.charAt(0).toUpperCase();

  document.querySelectorAll("[data-user-name]").forEach((element) => {
    element.textContent = name;
  });
  document.querySelectorAll("[data-user-role]").forEach((element) => {
    element.textContent = role;
  });
  document.querySelectorAll("[data-user-email]").forEach((element) => {
    element.textContent = user?.email || "";
  });
  document.querySelectorAll("[data-user-initial]").forEach((element) => {
    element.textContent = initial;
  });

  const greeting = document.getElementById("user-greeting");
  if (greeting && user) {
    greeting.textContent = `Welcome, ${name}`;
  }
}

function getStatusElement(scope = document) {
  return scope.querySelector("[data-auth-status]") || document.getElementById("auth-status");
}

function setStatus(message, isError = false, scope = document) {
  const statusElement = getStatusElement(scope);
  if (!statusElement) {
    if (message) {
      console[isError ? "error" : "log"](message);
    }
    return;
  }

  statusElement.textContent = message || "";
  statusElement.className = isError
    ? "mt-4 text-sm font-semibold text-red-700"
    : "mt-4 text-sm font-semibold text-primary";
  statusElement.hidden = !message;
}

function normalizeAuthError(error) {
  const authMessages = {
    "auth/email-already-in-use": "That email address is already registered.",
    "auth/invalid-email": "Enter a valid email address.",
    "auth/invalid-credential": "Incorrect email or password.",
    "auth/missing-password": "Enter your password.",
    "auth/weak-password": "Use a password with at least 6 characters.",
    "auth/too-many-requests": "Too many attempts. Try again in a few minutes.",
  };

  return authMessages[error?.code] || error?.message || "Something went wrong. Please try again.";
}

async function getUserProfile(userId) {
  if (!userId) {
    return null;
  }

  try {
    const snapshot = await getDoc(doc(db, "users", userId));
    return snapshot.exists() ? snapshot.data() : null;
  } catch (error) {
    console.error("Failed to fetch user profile:", error);
    return null;
  }
}

async function getUserRole(userId) {
  const profile = await getUserProfile(userId);
  return profile?.role || "user";
}

async function redirectUserBasedOnRole(userId, preferredTarget = null) {
  const redirectTarget = normalizeRedirectTarget(preferredTarget);

  if (redirectTarget && ![ROUTES.login, ROUTES.register].includes(redirectTarget.split("?")[0])) {
    redirectTo(redirectTarget);
    return;
  }

  const role = await getUserRole(userId);
  redirectTo(ROLE_ROUTES[role] || ROUTES.userDashboard);
}

async function handleRegistrationSubmit(event) {
  event.preventDefault();

  const form = event.currentTarget;
  const name = form.elements.namedItem("name")?.value.trim() || "";
  const ageValue = form.elements.namedItem("age")?.value?.trim() || "";
  const email = form.elements.namedItem("email")?.value.trim() || "";
  const password = form.elements.namedItem("password")?.value || "";
  const termsCheckbox = form.elements.namedItem("terms");

  if (termsCheckbox && !termsCheckbox.checked) {
    setStatus("Accept the terms to create an account.", true, form);
    return;
  }

  if (!name || !email || !password) {
    setStatus("Name, email, and password are required.", true, form);
    return;
  }

  setStatus("Creating your account...", false, form);

  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    const parsedAge = Number.parseInt(ageValue, 10);

    await setDoc(doc(db, "users", user.uid), {
      name,
      age: Number.isFinite(parsedAge) ? parsedAge : null,
      email,
      role: "user",
      createdAt: new Date(),
    });

    const redirectTarget = normalizeRedirectTarget(readQueryParam("redirect"));
    await redirectUserBasedOnRole(user.uid, redirectTarget || ROUTES.userDashboard);
  } catch (error) {
    setStatus(normalizeAuthError(error), true, form);
  }
}

async function handleLoginSubmit(event) {
  event.preventDefault();

  const form = event.currentTarget;
  const email = form.elements.namedItem("email")?.value.trim() || "";
  const password = form.elements.namedItem("password")?.value || "";

  if (!email || !password) {
    setStatus("Enter your email and password.", true, form);
    return;
  }

  setStatus("Signing you in...", false, form);

  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const redirectTarget = normalizeRedirectTarget(readQueryParam("redirect"));
    await redirectUserBasedOnRole(userCredential.user.uid, redirectTarget);
  } catch (error) {
    setStatus(normalizeAuthError(error), true, form);
  }
}

function wireAuthForms() {
  const registrationForm = document.getElementById("registration-form");
  if (registrationForm && !registrationForm.dataset.bound) {
    registrationForm.addEventListener("submit", handleRegistrationSubmit);
    registrationForm.dataset.bound = "true";
  }

  const loginForm = document.getElementById("login-form");
  if (loginForm && !loginForm.dataset.bound) {
    loginForm.addEventListener("submit", handleLoginSubmit);
    loginForm.dataset.bound = "true";
  }
}

function wireLogoutHandlers() {
  const logoutTargets = new Set([
    ...document.querySelectorAll("[data-logout]"),
    document.getElementById("logout-button"),
  ]);

  logoutTargets.forEach((element) => {
    if (!element || element.dataset.bound) {
      return;
    }

    element.addEventListener("click", async (event) => {
      event.preventDefault();

      try {
        await signOut(auth);
        redirectTo(ROUTES.home);
      } catch (error) {
        console.error("Sign out failed:", error);
        setStatus("Sign out failed. Please try again.", true);
      }
    });

    element.dataset.bound = "true";
  });
}

function wirePasswordVisibilityToggles() {
  document.querySelectorAll("[data-password-toggle]").forEach((button) => {
    if (button.dataset.bound) {
      return;
    }

    button.addEventListener("click", () => {
      const selector = button.dataset.passwordToggle;
      const input = selector ? document.querySelector(selector) : button.previousElementSibling;
      if (!input) {
        return;
      }

      input.type = input.type === "password" ? "text" : "password";
    });

    button.dataset.bound = "true";
  });
}

function requiresAuthForCurrentPage() {
  const pageName = getCurrentPageName();
  const body = document.body;
  return body?.dataset.requiresAuth === "true" || PROTECTED_PAGES.has(pageName);
}

async function handleAuthState(user) {
  updateContextualLinks();
  wireLogoutHandlers();

  const currentPage = getCurrentPageName();

  if (!user) {
    setConditionalVisibility(false);
    updateIdentityLabels(null, null);
    updateDashboardLinks();

    if (requiresAuthForCurrentPage()) {
      redirectTo(buildAuthPageUrl(ROUTES.login));
    }
    return;
  }

  const profile = await getUserProfile(user.uid);
  const role = profile?.role || "user";

  setConditionalVisibility(true, role);
  updateIdentityLabels(user, profile);
  updateDashboardLinks(role);

  if ([ROUTES.login, ROUTES.register].includes(currentPage)) {
    const redirectTarget = normalizeRedirectTarget(readQueryParam("redirect"));
    await redirectUserBasedOnRole(user.uid, redirectTarget);
    return;
  }

  const requiredRole = document.body?.dataset.role;
  if (requiredRole && requiredRole !== role) {
    await redirectUserBasedOnRole(user.uid);
  }
}

updateContextualLinks();
wireAuthForms();
wireLogoutHandlers();
wirePasswordVisibilityToggles();
onAuthStateChanged(auth, handleAuthState);

export { ROUTES, auth, db, getUserProfile, getUserRole, normalizeRedirectTarget, redirectUserBasedOnRole };
