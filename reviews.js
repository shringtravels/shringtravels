import { initializeApp, getApp, getApps } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { getDatabase, ref, push, set, remove, onValue } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyAQ_ZSrG4LI5AfOLJMNVSha0J96dHZC4-g",
  authDomain: "shring-travels.firebaseapp.com",
  databaseURL: "https://shring-travels-default-rtdb.firebaseio.com/",
  projectId: "shring-travels",
  storageBucket: "shring-travels.firebasestorage.app",
  messagingSenderId: "688417750927",
  appId: "1:688417750927:web:d564a8b45df58f772b55fa",
  measurementId: "G-ZJ58V6RR10"
};

const ADMIN_UID = "UlOwIKfAvCQnHCdpDoN8O3GhsOA2";
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

const reviewForm = document.getElementById("reviewForm");
const approvedBox = document.getElementById("approvedReviews");
const reviewStatus = document.getElementById("reviewStatus");
const adminForm = document.getElementById("adminLoginForm");
const adminStatus = document.getElementById("adminStatus");
const logoutButton = document.getElementById("adminLogout");
const pendingBox = document.getElementById("pendingReviews");

function showReviews(snapshot) {
  approvedBox.replaceChildren();
  if (!snapshot.exists()) {
    approvedBox.textContent = "No approved reviews yet.";
    return;
  }

  const entries = Object.entries(snapshot.val()).sort(
    (a, b) => (b[1].createdAt || 0) - (a[1].createdAt || 0)
  );

  entries.forEach(([id, review]) => {
    const card = document.createElement("article");
    const heading = document.createElement("h3");
    heading.textContent = review.name || "Guest";
    const stars = document.createElement("p");
    stars.textContent = "★".repeat(Number(review.rating) || 0);
    const message = document.createElement("p");
    message.textContent = review.message || "";
    card.append(heading, stars, message);
    approvedBox.append(card);
  });
}

onValue(ref(db, "approvedReviews"), showReviews, error => {
  approvedBox.textContent = "Reviews could not be loaded.";
  console.error(error);
});

reviewForm.addEventListener("submit", async event => {
  event.preventDefault();
  reviewStatus.textContent = "Submitting...";
  const name = document.getElementById("reviewName").value.trim();
  const rating = Number(document.getElementById("reviewRating").value);
  const message = document.getElementById("reviewMessage").value.trim();

  if (!name || name.length > 50 || !Number.isInteger(rating) ||
      rating < 1 || rating > 5 || !message || message.length > 500) {
    reviewStatus.textContent = "Please check your name, rating and review.";
    return;
  }

  try {
    const newReview = push(ref(db, "pendingReviews"));
    await set(newReview, { name, rating, message, createdAt: Date.now() });
    reviewForm.reset();
    reviewStatus.textContent = "Thank you! Your review is awaiting admin approval.";
  } catch (error) {
    reviewStatus.textContent = "Could not submit review. Please try again.";
    console.error(error);
  }
});

let stopPending = null;

function renderPending(snapshot) {
  pendingBox.replaceChildren();
  if (!snapshot.exists()) {
    pendingBox.textContent = "No pending reviews.";
    return;
  }

  Object.entries(snapshot.val()).forEach(([id, review]) => {
    const card = document.createElement("article");
    const heading = document.createElement("h3");
    heading.textContent = review.name || "Guest";
    const stars = document.createElement("p");
    stars.textContent = "★".repeat(Number(review.rating) || 0);
    const message = document.createElement("p");
    message.textContent = review.message || "";

    const approve = document.createElement("button");
    approve.type = "button";
    approve.className = "btn";
    approve.textContent = "Approve";
    approve.addEventListener("click", async () => {
      approve.disabled = true;
      try {
        await set(ref(db, "approvedReviews/" + id), review);
        await remove(ref(db, "pendingReviews/" + id));
      } catch (error) {
        adminStatus.textContent = "Approval failed. Please try again.";
        console.error(error);
        approve.disabled = false;
      }
    });

    const reject = document.createElement("button");
    reject.type = "button";
    reject.className = "btn";
    reject.textContent = "Reject";
    reject.addEventListener("click", async () => {
      reject.disabled = true;
      try {
        await remove(ref(db, "pendingReviews/" + id));
      } catch (error) {
        adminStatus.textContent = "Could not reject review.";
        console.error(error);
        reject.disabled = false;
      }
    });

    card.append(heading, stars, message, approve, reject);
    pendingBox.append(card);
  });
}

adminForm.addEventListener("submit", async event => {
  event.preventDefault();
  adminStatus.textContent = "Logging in...";
  const email = document.getElementById("adminEmail").value.trim();
  const password = document.getElementById("adminPassword").value;

  try {
    const result = await signInWithEmailAndPassword(auth, email, password);
    if (result.user.uid !== ADMIN_UID) {
      await signOut(auth);
      adminStatus.textContent = "This account is not authorized as admin.";
    }
  } catch (error) {
    adminStatus.textContent = "Login failed. Check your email and password.";
    console.error(error);
  }
});

logoutButton.addEventListener("click", () => signOut(auth));

onAuthStateChanged(auth, user => {
  const isAdmin = !!user && user.uid === ADMIN_UID;
  adminForm.querySelectorAll("input").forEach(input => input.hidden = isAdmin);
  adminForm.querySelector('button[type="submit"]').hidden = isAdmin;
  logoutButton.hidden = !isAdmin;

  if (stopPending) {
    stopPending();
    stopPending = null;
  }

  if (isAdmin) {
    adminStatus.textContent = "Admin logged in.";
    stopPending = onValue(ref(db, "pendingReviews"), renderPending, error => {
      adminStatus.textContent = "Could not load pending reviews.";
      console.error(error);
    });
  } else {
    pendingBox.replaceChildren();
  }
});
