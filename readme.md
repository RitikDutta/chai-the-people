# Chai ThePeople ☕🇮🇳

**Sip, Share, Shape India's Tomorrow.**

Chai ThePeople is an innovative web application designed to connect citizens, local tea vendors (chai wallahs), and policymakers. Users receive free tea at participating stalls in exchange for answering short surveys, providing valuable feedback for economic development while supporting local businesses.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
<!-- Add other badges later if applicable (e.g., build status, deployment) -->

---

## Table of Contents

1.  [Introduction](#introduction)
2.  [How it Works](#how-it-works)
3.  [Key Features](#key-features)
4.  [Technology Stack](#technology-stack)
5.  [Getting Started](#getting-started)
    *   [Prerequisites](#prerequisites)
    *   [Installation](#installation)
    *   [Firebase Setup](#firebase-setup)
    *   [Configuration](#configuration)
    *   [Running Locally](#running-locally)
6.  [Project Structure](#project-structure)
7.  [Usage](#usage)
8.  [Security Considerations](#security-considerations)
9.  [Contributing](#contributing)
10. [Future Enhancements](#future-enhancements)
11. [License](#license)
12. [Contact](#contact)

---

## Introduction

The simple act of drinking chai is a cornerstone of daily life in India. Chai ThePeople leverages this ritual to foster civic engagement and local economic growth. By offering a free cup of tea in return for survey participation via a web app, the project aims to:

*   **Gather valuable, localized data:** Collect diverse opinions on various topics relevant to economic development and public policy directly from citizens.
*   **Support Local Vendors:** Increase footfall and provide a direct incentive (reimbursement for free tea - *mechanism to be fully defined*) to small tea stall owners.
*   **Empower Citizen Voices:** Give people an easy and rewarding way to share their perspectives.
*   **Inform Policymaking:** Provide anonymized, aggregated data insights to relevant bodies to help shape better policies.

---

## How it Works

**For Users:**

1.  Visit a participating local tea stall.
2.  Scan the stall's unique Chai ThePeople QR code using their smartphone.
3.  The QR code directs them to the web app (`user_dashboard.html?stall=[STALL_ID]`).
4.  Users log in or register.
5.  The User Dashboard displays relevant surveys (global questions + questions specific to that stall).
6.  Users answer a survey.
7.  Upon completion (handled within the app), they show a confirmation (or the app communicates with the vendor - *mechanism TBD*) to receive their free chai.

**For Shop Owners:**

1.  Register an account and have their role set to `shop` (currently manual).
2.  Log in to access the Shop Dashboard.
3.  Register their stall(s), generating unique `stallId`s (used for QR codes).
4.  View basic statistics about survey completions at their stall(s).

**For Admins:**

1.  Register an account and have their role set to `admin` (currently manual).
2.  Log in to access the Admin Dashboard.
3.  Manage survey questions (add, delete, set scope - global or specific stalls).
4.  Manage users (view list, change roles, remove user data from Firestore).
5.  View overall statistics and insights derived from survey responses.
6.  Manage stalls (view list - potentially add edit/delete later).

---

## Key Features

*   **User Authentication:** Secure registration and login using Firebase Authentication (Email/Password).
*   **Role-Based Dashboards:** Separate, protected dashboards for Users, Shop Owners, and Admins.
*   **Dynamic Survey Display:** Users see relevant global questions and questions targeted specifically to the stall they scanned (using URL parameters).
*   **Answer Tracking:** Prevents users from seeing questions they have already answered.
*   **Question Management (Admin):** Admins can add/delete questions and define their scope (global or specific stalls via dropdown).
*   **Stall Management (Shop):** Shop owners can register their stalls with unique IDs.
*   **User Management (Admin):** Admins can view users, promote/demote roles (user <-> shop <-> admin), and remove user data from Firestore.
*   **Admin Insights:** Admins can view aggregated statistics (KPIs, user/stall activity, survey engagement) and basic charts.
*   **Responsive UI:** Basic responsiveness for different screen sizes.

---

## Technology Stack

*   **Frontend:** HTML5, CSS3, Vanilla JavaScript (ES6 Modules)
*   **Backend & Database:** Firebase
    *   **Authentication:** Manages user login and registration.
    *   **Firestore:** NoSQL database for storing users, questions, stalls, and responses.
*   **Charting:** Chart.js (for admin dashboard insights)
*   **Icons:** Font Awesome

---

## Getting Started

Follow these instructions to set up and run the project locally.

### Prerequisites

*   A modern web browser (Chrome, Firefox, Edge, Safari).
*   [Git](https://git-scm.com/) installed.
*   A Google account for Firebase access.
*   Node.js and npm (Optional - only if you plan to add build tools or dependencies later. Not required for current vanilla JS setup).
*   A local web server for serving static files (due to ES Module CORS restrictions). Examples:
    *   VS Code [Live Server](https://marketplace.visualstudio.com/items?itemName=ritwickdey.LiveServer) extension.
    *   Python's built-in server: `python -m http.server [PORT]` (Python 3) or `python -m SimpleHTTPServer [PORT]` (Python 2) run in the project directory.
    *   Node.js `http-server`: `npm install -g http-server` then `http-server . -p [PORT]`

### Installation

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/[your-github-username]/chai-thepeople.git
    cd chai-thepeople
    ```

### Firebase Setup

This is the most critical part.

1.  **Create Firebase Project:**
    *   Go to the [Firebase Console](https://console.firebase.google.com/).
    *   Click "Add project" and follow the steps to create a new project (e.g., "Chai ThePeople Dev").

2.  **Add Web App:**
    *   In your project's overview page, click the Web icon (`</>`).
    *   Register a new web app. Give it a nickname (e.g., "Chai Web App"). **Do not** check the box for Firebase Hosting at this stage (you can add it later if deploying).
    *   Firebase will provide you with a `firebaseConfig` object. **Copy this entire object.**

3.  **Enable Authentication:**
    *   In the Firebase console, go to Build -> Authentication -> Sign-in method.
    *   Enable the "Email/Password" provider.

4.  **Enable Firestore:**
    *   Go to Build -> Firestore Database -> Create database.
    *   Choose **Start in test mode** for initial development. **Warning:** This is insecure for production.
    *   Select a Firestore location (e.g., `asia-south1` for India).

5.  **Firestore Data Structure (Collections):**
    *   Manually create these collections initially or let the app create them as needed (if rules allow).
    *   `users`: Stores user profile information.
        *   *Document ID:* User's Firebase Auth UID.
        *   *Fields:* `name` (string), `email` (string), `age` (number), `role` (string: "user", "shop", or "admin"), `createdAt` (timestamp).
    *   `questions`: Stores survey questions.
        *   *Document ID:* Auto-generated.
        *   *Fields:* `text` (string), `options` (array of strings), `scope` (string: "global" or "specific"), `targetStalls` (array of strings - *lowercase* stall IDs, exists only if scope is "specific"), `createdAt` (timestamp), `active` (boolean - optional).
    *   `stalls`: Stores tea stall information.
        *   *Document ID:* Auto-generated or unique stall ID.
        *   *Fields:* `name` (string), `stallId` (string - *lowercase*, unique identifier), `ownerId` (string: UID of the shop owner from `users` collection), `location` (string - optional), `createdAt` (timestamp).
    *   `user_responses`: Stores user answers to surveys.
        *   *Document ID:* Auto-generated.
        *   *Fields:* `userId` (string: UID of the user), `questionId` (string: ID of the question answered), `answer` (string: the selected option), `stallId` (string - *lowercase* or null: ID of the stall where answered), `submittedAt` (timestamp).

6.  **Security Rules:**
    *   Go to Build -> Firestore Database -> Rules.
    *   **Replace** the default test rules with the latest secure rules developed for the project (refer to the last provided version in your development history or the `firestore.rules` file if you create one).
    *   **Crucially:** The initial test rules are insecure. The provided rules aim to restrict access based on roles and ownership. Review and understand them. **These need hardening for production.**

7.  **Firestore Indexes:**
    *   Firestore requires composite indexes for queries involving filtering (`where`) and sorting (`orderBy`) on different fields.
    *   If you encounter a `FirebaseError: The query requires an index...` error in the browser console, **click the link provided in the error message**. This link will take you directly to the Firebase console page to create the specific index needed for that query. Review the details and click "Create Index". Wait for it to build (status becomes "Enabled").

### Configuration

1.  Open the `auth.js` file in your code editor.
2.  Find the `firebaseConfig` constant near the top.
3.  **Paste** the configuration object you copied from the Firebase console, replacing the placeholder values.

    ```javascript
    const firebaseConfig = {
      apiKey: "YOUR_API_KEY",
      authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
      projectId: "YOUR_PROJECT_ID",
      storageBucket: "YOUR_PROJECT_ID.appspot.com",
      messagingSenderId: "YOUR_SENDER_ID",
      appId: "YOUR_APP_ID"
    };
    ```

### Running Locally

1.  Navigate to the project's root directory in your terminal.
2.  Start your chosen local web server. Examples:
    *   **VS Code Live Server:** Right-click `index.html` and select "Open with Live Server".
    *   **Python 3:** `python -m http.server 8000`
    *   **http-server:** `http-server . -p 8000`
3.  Open your web browser and navigate to the local address provided by the server (e.g., `http://localhost:8000` or `http://127.0.0.1:8000`).

---

## Project Structure
chai-thepeople/
├── index.html # Homepage
├── login.html # Login page
├── register.html # Registration page
├── user_dashboard.html # Dashboard for regular users
├── shop_dashboard.html # Dashboard for shop owners
├── admin_dashboard.html # Dashboard for administrators
├── style.css # Main CSS styles for all pages
├── auth.js # Handles Firebase Auth (login, register, state) & Role Logic
├── dashboard.js # Logic for user_dashboard.html (fetch/display questions, submit answers)
├── shop.js # Logic for shop_dashboard.html (manage stalls, view stats)
├── admin.js # Logic for admin_dashboard.html (manage questions/users/stalls, view insights)
├── counters.js # Animation for homepage counters
├── firestore.rules # (Recommended) Store your Firestore rules here
└── README.md # This file



---

## Usage

1.  **Register:** Create accounts using the registration page.
2.  **Assign Roles (Manual):**
    *   Currently, roles (`shop`, `admin`) must be assigned manually.
    *   Go to your Firebase Console -> Firestore Database -> `users` collection.
    *   Find the user document you want to modify.
    *   Edit the `role` field to `"shop"` or `"admin"` (must be lowercase string).
3.  **Login:** Log in using registered credentials. You will be redirected based on your role.
4.  **Admin:** Manage questions, users, view insights.
5.  **Shop Owner:** Register stalls, view statistics for their stalls.
6.  **User (via QR Code URL):** Access `user_dashboard.html?stall=[stall_id]` (replace `[stall_id]` with a valid, lowercase stall ID from your `stalls` collection) to see global + stall-specific questions.
7.  **User (Direct Access):** Accessing `user_dashboard.html` without a `stall` parameter shows only global questions.

---

## Security Considerations

*   **Firestore Rules:** The provided rules are a starting point. **They MUST be reviewed and hardened before any production deployment.** Ensure least privilege access. Test rules thoroughly using the Firebase emulator or simulator.
*   **Test Mode:** Do **NOT** deploy to production with Firestore in test mode (`allow read, write: if true;`). Change to production mode (`allow read, write: if false;`) and rely on your specific rules.
*   **Client-Side Logic:** Sensitive operations (like full user deletion including Auth record, complex calculations on large datasets, sending notifications) should ideally be moved to secure backend code (e.g., Firebase Functions).
*   **Input Validation:** While basic patterns are used (e.g., for `stallId`), more robust client-side and server-side (via rules or Functions) validation should be added.
*   **Rate Limiting/Abuse Prevention:** Consider implementing measures to prevent spamming survey responses or other potential abuse vectors, likely using Firebase Functions.

---

## Contributing

Contributions are welcome! If you'd like to contribute, please follow these general steps:

1.  Fork the repository.
2.  Create a new branch (`git checkout -b feature/your-feature-name`).
3.  Make your changes.
4.  Commit your changes (`git commit -m 'Add some feature'`).
5.  Push to the branch (`git push origin feature/your-feature-name`).
6.  Open a Pull Request.

Please ensure your code follows the existing style and includes comments where necessary.

---

## Future Enhancements

*   **Gamification:** Badges, points, streaks, leaderboards.
*   **Advanced Admin Insights:** Date filtering, demographic filtering, data export, sentiment analysis.
*   **Enhanced Shop Dashboard:** Detailed stats trends, QR code generation, edit stall details.
*   **User Profile & Settings:** Allow users to manage basic info, view stats/badges.
*   **Improved Survey Types:** Rating scales, optional text input.
*   **Notifications:** Inform users/shops about new surveys or activity (requires backend/native app).
*   **Offline Support:** Allow users to complete surveys offline and sync later.
*   **Firebase Functions:** Implement backend logic for security, aggregation, and complex tasks.
*   **Native Mobile App:** Develop iOS/Android versions for better integration and notifications.
*   **Deployment:** Set up Firebase Hosting for easy deployment.
*   **Testing:** Add unit and integration tests.

---

## License

This project is licensed under the MIT License - see the [LICENSE.md](LICENSE.md) file for details (You'll need to create this file and add the MIT License text).

---

## Contact

Your Name / Organization Name – [your-email@example.com](mailto:your-email@example.com)

Project Link: [https://github.com/[your-github-username]/chai-thepeople](https://github.com/[your-github-username]/chai-thepeople)

---