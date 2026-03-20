import {
  collection,
  getDocs,
  limit,
  query,
  where,
} from "https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js";
import { db } from "./auth.js";

const STALL_STORAGE_KEY = "chai:lastStallId";

function normalizeStallId(value) {
  return value ? value.trim().toLowerCase() : null;
}

function rememberStallId(stallId) {
  const normalized = normalizeStallId(stallId);

  if (!normalized) {
    return;
  }

  window.sessionStorage.setItem(STALL_STORAGE_KEY, normalized);
}

function readRememberedStallId() {
  return normalizeStallId(window.sessionStorage.getItem(STALL_STORAGE_KEY));
}

async function getAnsweredQuestionIds(userId) {
  const answeredIds = new Set();

  if (!userId) {
    return answeredIds;
  }

  const responsesSnapshot = await getDocs(query(collection(db, "user_responses"), where("userId", "==", userId)));
  responsesSnapshot.forEach((responseDoc) => {
    const questionId = responseDoc.data().questionId;
    if (questionId) {
      answeredIds.add(questionId);
    }
  });

  return answeredIds;
}

function sortQuestions(questions) {
  return questions.sort((left, right) => {
    const leftDate = left.createdAt?.toDate?.() || new Date(0);
    const rightDate = right.createdAt?.toDate?.() || new Date(0);
    return rightDate - leftDate;
  });
}

async function fetchEligibleQuestions(stallId) {
  const questionsRef = collection(db, "questions");
  const normalizedStallId = normalizeStallId(stallId);
  const questions = [];
  const seenIds = new Set();
  const snapshots = normalizedStallId
    ? await Promise.all([
        getDocs(query(questionsRef, where("scope", "==", "global"))),
        getDocs(query(questionsRef, where("targetStalls", "array-contains", normalizedStallId))),
      ])
    : [await getDocs(query(questionsRef, where("scope", "==", "global")))];

  snapshots.forEach((snapshot) => {
    snapshot.forEach((questionDoc) => {
      if (seenIds.has(questionDoc.id)) {
        return;
      }

      const questionData = questionDoc.data();
      if (questionData.active === false) {
        return;
      }

      seenIds.add(questionDoc.id);
      questions.push({
        id: questionDoc.id,
        ...questionData,
      });
    });
  });

  return sortQuestions(questions);
}

async function fetchPendingQuestions(userId, stallId) {
  const [answeredIds, eligibleQuestions] = await Promise.all([
    getAnsweredQuestionIds(userId),
    fetchEligibleQuestions(stallId),
  ]);

  return eligibleQuestions.filter((question) => !answeredIds.has(question.id));
}

async function fetchStallById(stallId) {
  const normalizedStallId = normalizeStallId(stallId);

  if (!normalizedStallId) {
    return null;
  }

  const snapshot = await getDocs(
    query(collection(db, "stalls"), where("stallId", "==", normalizedStallId), limit(1)),
  );

  if (snapshot.empty) {
    return null;
  }

  const stallDoc = snapshot.docs[0];
  return {
    id: stallDoc.id,
    ...stallDoc.data(),
  };
}

async function fetchUserResponseCount(userId) {
  if (!userId) {
    return 0;
  }

  const responsesSnapshot = await getDocs(query(collection(db, "user_responses"), where("userId", "==", userId)));
  return responsesSnapshot.size;
}

export {
  fetchEligibleQuestions,
  fetchPendingQuestions,
  fetchStallById,
  fetchUserResponseCount,
  getAnsweredQuestionIds,
  normalizeStallId,
  readRememberedStallId,
  rememberStallId,
};
