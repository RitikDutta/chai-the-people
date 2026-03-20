// Import functions from the Firebase SDKs
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js";
import {
    getAuth,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js";

// Your web app's Firebase configuration (assuming it's correct)
const firebaseConfig = {
    apiKey: "AIzaSyCkcPBhFk6NsVZ9PHQGIDZY6QhbRbvBM80",
    authDomain: "actbuildertest.firebaseapp.com",
    projectId: "actbuildertest",
    storageBucket: "actbuildertest.firebasestorage.app",
    messagingSenderId: "211406345282",
    appId: "1:211406345282:web:ac9666a560e00ca2ecc9db"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// --- Get DOM Elements (Add shop nav link) ---
const registrationForm = document.getElementById('registration-form');
const loginForm = document.getElementById('login-form');
const navLogin = document.getElementById('nav-login');
const navRegister = document.getElementById('nav-register');
const navLogout = document.getElementById('nav-logout');
const navDashboard = document.getElementById('nav-dashboard');
const navAdminDash = document.getElementById('nav-admin-dash');
const navShopDash = document.getElementById('nav-shop-dash'); // Added Shop Dash nav item
const userGreeting = document.getElementById('user-greeting');
const logoutButton = document.getElementById('logout-button');

// --- Registration Logic ---
if (registrationForm) {
     registrationForm.addEventListener('submit', (event) => {
        event.preventDefault();
        const name = registrationForm.name.value;
        const age = registrationForm.age.value; // Keep age for users, maybe optional for shops?
        const email = registrationForm.email.value;
        const password = registrationForm.password.value;

        // *** For now, users register as 'user'. Assign 'shop' role MANUALLY in Firestore. ***
        // Later, could have a separate registration form or checkbox for shops.
        const defaultRole = "user";

        console.log("Attempting registration for:", email);
        createUserWithEmailAndPassword(auth, email, password)
            .then((userCredential) => {
                const user = userCredential.user;
                console.log("User registered:", user.uid);
                const userDocRef = doc(db, "users", user.uid);
                return setDoc(userDocRef, {
                    name: name,
                    age: parseInt(age), // maybe make this optional for shop role?
                    email: email,
                    role: defaultRole, // Set the role here
                    createdAt: new Date()
                });
            })
            .then(() => {
                console.log("User data saved to Firestore");
                alert("Registration successful! You can now login.");
                window.location.href = 'login.html';
            })
            .catch((error) => {
                 console.error("Registration or data saving failed: ", error);
                let friendlyMessage = error.message;
                // ... (error messages remain the same) ...
                alert(friendlyMessage);
            });
    });
}

// --- Login Logic --- (calls role-based redirect)
if (loginForm) {
    loginForm.addEventListener('submit', (event) => {
        event.preventDefault();
        const email = loginForm.email.value;
        const password = loginForm.password.value;
        console.log("Attempting login for:", email);
        signInWithEmailAndPassword(auth, email, password)
            .then((userCredential) => {
                const user = userCredential.user;
                console.log("User logged in:", user.uid);
                redirectUserBasedOnRole(user.uid); // Redirect after successful login
            })
            .catch((error) => {
                 console.error("Login failed:", error);
                // ... (error messages remain the same) ...
                alert(friendlyMessage);
            });
    });
}

// --- Logout Logic --- (remains the same)
function handleLogout() { /* ... same as before ... */
    signOut(auth).then(() => {
        console.log("User signed out successfully");
        window.location.href = 'index.html';
    }).catch((error) => {
        console.error("Sign out error:", error);
        alert("Failed to log out. Error: " + error.message);
    });
}
if (logoutButton) {
    logoutButton.addEventListener('click', (event) => {
        event.preventDefault();
        handleLogout();
    });
}


// --- *** UPDATED Role-Based Redirect Function *** ---
async function redirectUserBasedOnRole(userId) {
    console.log(`Redirecting user ${userId} based on role...`);
    try {
        const userDocRef = doc(db, "users", userId);
        const userDocSnap = await getDoc(userDocRef);

        let role = 'user'; // Default role
        if (userDocSnap.exists()) {
            role = userDocSnap.data().role || 'user';
        } else {
            console.warn(`User document ${userId} not found! Assigning default role 'user'.`);
        }
        console.log(`User role determined as: ${role}`);

        // --- Redirect logic ---
        if (role === 'admin') {
            console.log("Redirecting to admin dashboard.");
            window.location.href = 'admin_dashboard.html';
        } else if (role === 'shop') { // <-- Added Shop Role Check
             console.log("Redirecting to shop dashboard.");
            window.location.href = 'shop_dashboard.html';
        } else { // Default role 'user'
             console.log("Redirecting to user dashboard.");
            window.location.href = 'user_dashboard.html';
        }
    } catch (error) {
        console.error("Error fetching user role for redirection: ", error);
        alert("Error determining your role. Redirecting to home page.");
        window.location.href = 'index.html';
    }
}


// --- *** UPDATED Auth State Observer *** ---
onAuthStateChanged(auth, async (user) => {
    console.log("Auth state changed. User:", user ? user.uid : 'None');
    const currentPage = window.location.pathname.split("/").pop() || "index.html";
    // --- Add shop dashboard to protected pages ---
    const protectedPages = ['user_dashboard.html', 'admin_dashboard.html', 'shop_dashboard.html'];

    if (user) {
        // User is signed in
        const uid = user.uid;
        let userRole = 'user';
        let userName = user.email;

        // Fetch user role and name (same logic as before)
        try {
            const userDocRef = doc(db, "users", uid);
            const userDocSnap = await getDoc(userDocRef);
             if (userDocSnap.exists()) {
                 const userData = userDocSnap.data();
                 userRole = userData.role || 'user';
                 userName = userData.name || user.email;
                 console.log(`Auth check: User role is ${userRole}, Name: ${userName}`);
             } else {
                 console.warn("User document not found in Firestore during auth state check. Using defaults.");
             }
         } catch (error) {
             console.error("Error fetching user data in onAuthStateChanged:", error);
         }

        // --- Update UI based on role ---
        if (navLogin) navLogin.style.display = 'none';
        if (navRegister) navRegister.style.display = 'none';
        if (navLogout) navLogout.style.display = 'inline';
        // Show/hide dashboard links
        if (navDashboard) navDashboard.style.display = (userRole === 'user') ? 'inline' : 'none';
        if (navAdminDash) navAdminDash.style.display = (userRole === 'admin') ? 'inline' : 'none';
        if (navShopDash) navShopDash.style.display = (userRole === 'shop') ? 'inline' : 'none'; // <-- Show/hide shop link
        // Update greeting
        if (userGreeting) {
             userGreeting.textContent = `Welcome, ${userName}! (${userRole})`;
             userGreeting.style.display = 'inline';
        }

        // --- Protection & Redirection for Logged-In Users ---
        // 1. Redirect from login/register pages
        if (currentPage === 'login.html' || currentPage === 'register.html') {
            console.log("User logged in, redirecting from auth page based on role.");
            redirectUserBasedOnRole(uid);
            return;
        }

        // 2. Protect pages based on role
        if (currentPage === 'admin_dashboard.html' && userRole !== 'admin') {
            console.warn(`Access Denied: User (role: ${userRole}) trying to access Admin Dashboard.`);
            alert("Access Denied: You do not have permission to view this page.");
            redirectUserBasedOnRole(uid);
            return;
        }
        // --- Added Shop Dashboard Protection ---
        if (currentPage === 'shop_dashboard.html' && userRole !== 'shop') {
             console.warn(`Access Denied: User (role: ${userRole}) trying to access Shop Dashboard.`);
             alert("Access Denied: You do not have permission to view this page.");
             redirectUserBasedOnRole(uid);
             return;
        }
         if (currentPage === 'user_dashboard.html' && userRole !== 'user') {
             console.warn(`Redirect: Non-user (role: ${userRole}) trying to access User Dashboard.`);
             redirectUserBasedOnRole(uid);
             return;
        }

    } else {
        // User is signed out
        console.log("User is logged out.");

        // Update UI
         if (navLogin) navLogin.style.display = 'inline';
         if (navRegister) navRegister.style.display = 'inline';
         if (navLogout) navLogout.style.display = 'none';
         if (navDashboard) navDashboard.style.display = 'none';
         if (navAdminDash) navAdminDash.style.display = 'none';
         if (navShopDash) navShopDash.style.display = 'none'; // <-- Hide shop link
         if (userGreeting) userGreeting.style.display = 'none';

         // --- PROTECTION LOGIC for Logged-Out Users ---
         if (protectedPages.includes(currentPage)) {
             console.log(`User logged out. Access denied for protected page ${currentPage}. Redirecting to login.`);
             window.location.href = 'login.html'; // Redirect to login
         }
    }
});

// Export auth and db
export { auth, db };