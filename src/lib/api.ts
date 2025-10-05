
// src/lib/api.ts
import { 
    products as mockProducts, 
    getQuizzes as mockGetQuizzes,
    getQuizById as mockGetQuizById,
    saveQuiz as mockSaveQuiz,
    deleteQuiz as mockDeleteQuiz,
    getSubmissions as mockGetSubmissions,
    getSubmissionsByUserId as mockGetSubmissionsByUserId,
    addSubmission as mockAddSubmission,
    updateSubmissionStatus as mockUpdateSubmissionStatus,
    getMtaServerStatus as mockGetMtaServerStatus,
    getAuditLogs as mockGetAuditLogs,
    getRules as mockGetRules,
    saveRules as mockSaveRules
} from './mockData';
import type { Product, Quiz, QuizSubmission, SubmissionStatus, User, Answer, AuditLogEntry, RuleCategory } from '../types';

/**
 * This file acts as a mock API layer.
 * In a real application, the functions in this file would make `fetch` calls 
 * to a backend server.
 * 
 * For now, they call functions from `mockData.ts` to simulate that interaction
 * and keep the application functional for demonstration purposes.
 * A backend developer would only need to change the logic inside these functions.
 */

const SIMULATED_DELAY = 500; // ms

// --- Audit Log API ---
export const getAuditLogs = async (): Promise<AuditLogEntry[]> => {
    console.log("API: Fetching audit logs...");
    await new Promise(resolve => setTimeout(resolve, SIMULATED_DELAY));
    return mockGetAuditLogs();
};


// --- Product & Store API ---
export const getProducts = async (): Promise<Product[]> => {
  console.log("API: Fetching products...");
  await new Promise(resolve => setTimeout(resolve, SIMULATED_DELAY));
  // In a real app: return await fetch('/api/products').then(res => res.json());
  return mockProducts;
};

// --- Quiz API ---
export const getQuizzes = async (): Promise<Quiz[]> => {
  console.log("API: Fetching all quizzes...");
  await new Promise(resolve => setTimeout(resolve, SIMULATED_DELAY));
  return mockGetQuizzes();
};

export const getQuizById = async (id: string): Promise<Quiz | undefined> => {
  console.log(`API: Fetching quiz with id: ${id}`);
  await new Promise(resolve => setTimeout(resolve, 200));
  return mockGetQuizById(id);
};

export const saveQuiz = async (quiz: Quiz, admin: User): Promise<void> => {
  console.log(`API: User ${admin.username} saving quiz: ${quiz.titleKey}`);
  await new Promise(resolve => setTimeout(resolve, SIMULATED_DELAY));
  mockSaveQuiz(quiz, admin);
};

export const deleteQuiz = async (quizId: string, admin: User): Promise<void> => {
  console.log(`API: User ${admin.username} deleting quiz: ${quizId}`);
  await new Promise(resolve => setTimeout(resolve, SIMULATED_DELAY));
  mockDeleteQuiz(quizId, admin);
};

// --- Rules API ---
export const getRules = async (): Promise<RuleCategory[]> => {
  console.log("API: Fetching rules...");
  await new Promise(resolve => setTimeout(resolve, SIMULATED_DELAY));
  return mockGetRules();
};

export const saveRules = async (rules: RuleCategory[], admin: User): Promise<void> => {
  console.log(`API: User ${admin.username} saving rules...`);
  await new Promise(resolve => setTimeout(resolve, SIMULATED_DELAY));
  mockSaveRules(rules, admin);
};


// --- Submission API ---
export const getSubmissions = async (): Promise<QuizSubmission[]> => {
    console.log("API: Fetching all submissions for admin...");
    await new Promise(resolve => setTimeout(resolve, 800));
    return mockGetSubmissions();
}

export const getSubmissionsByUserId = async (userId: string): Promise<QuizSubmission[]> => {
    console.log(`API: Fetching submissions for user: ${userId}`);
    await new Promise(resolve => setTimeout(resolve, SIMULATED_DELAY));
    return mockGetSubmissionsByUserId(userId);
}

export const addSubmission = async (submissionData: {
  quizId: string;
  quizTitle: string;
  userId: string;
  username: string;
  answers: Answer[];
  submittedAt: string;
}): Promise<void> => {
    console.log(`API: Adding new submission for quiz: ${submissionData.quizTitle}`);
    await new Promise(resolve => setTimeout(resolve, SIMULATED_DELAY));
    mockAddSubmission(submissionData);
}

export const updateSubmissionStatus = async (submissionId: string, status: SubmissionStatus, admin: User): Promise<void> => {
    console.log(`API: User ${admin.username} updating submission ${submissionId} to status ${status}`);
    await new Promise(resolve => setTimeout(resolve, SIMULATED_DELAY));
    mockUpdateSubmissionStatus(submissionId, status, admin);
}

// --- MTA Server Status API ---
export const getMtaServerStatus = async () => {
    // This function in mockData already simulates delay
    return mockGetMtaServerStatus();
}