// src/lib/api.ts
import type { Product, Quiz, QuizSubmission, SubmissionStatus, User, AuditLogEntry, RuleCategory } from '../types';
// We still import the mock data to provide initial values for things not yet on the backend.
import { products as mockProducts, getQuizzes as mockGetQuizzes, getQuizById as mockGetQuizById, getRules as mockGetRules, getMtaServerStatus as mockGetMtaServerStatus, saveQuiz as mockSaveQuiz, deleteQuiz as mockDeleteQuiz, saveRules as mockSaveRules, getAuditLogs as mockGetAuditLogs, addSubmission as mockAddSubmission, getSubmissions as mockGetSubmissions, getSubmissionsByUserId as mockGetSubmissionsByUserId, updateSubmissionStatus as mockUpdateSubmissionStatus } from './mockData';

// --- CONFIGURATION ---
// Set this to true to use the backend API, false to use local mock data.
// This is useful for local development without running the Vercel backend.
const USE_BACKEND = true;

// --- API HELPER FUNCTIONS ---
const get = async <T>(endpoint: string): Promise<T> => {
    // Requests are now relative to the current domain (e.g., /api/submissions)
    const response = await fetch(endpoint);
    if (!response.ok) {
        const errorText = await response.text();
        console.error(`API GET Error: ${response.status} ${response.statusText}`, errorText);
        throw new Error(`Failed to fetch from ${endpoint}`);
    }
    return response.json();
};

const post = async <T>(endpoint: string, body: any): Promise<T> => {
    const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    if (!response.ok) {
        const errorText = await response.text();
        console.error(`API POST Error: ${response.status} ${response.statusText}`, errorText);
        throw new Error(`Failed to POST to ${endpoint}`);
    }
    return response.json();
};

const put = async <T>(endpoint: string, body: any): Promise<T> => {
    const response = await fetch(endpoint, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    if (!response.ok) {
        const errorText = await response.text();
        console.error(`API PUT Error: ${response.status} ${response.statusText}`, errorText);
        throw new Error(`Failed to PUT to ${endpoint}`);
    }
    return response.json();
};

const del = async <T>(endpoint: string, body: any): Promise<T> => {
    const response = await fetch(endpoint, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
     if (!response.ok) {
        const errorText = await response.text();
        console.error(`API DELETE Error: ${response.status} ${response.statusText}`, errorText);
        throw new Error(`Failed to DELETE from ${endpoint}`);
    }
    return response.json();
};


// --- PUBLIC API FUNCTIONS ---

// These functions still use MOCK data
export const getProducts = async (): Promise<Product[]> => {
  await new Promise(resolve => setTimeout(resolve, 500));
  return mockProducts;
};
export const getMtaServerStatus = async () => {
    return mockGetMtaServerStatus();
}

// These functions can be toggled between backend and mock
export const getQuizzes = async (): Promise<Quiz[]> => {
  await new Promise(resolve => setTimeout(resolve, 500));
  return mockGetQuizzes();
};
export const getQuizById = async (id: string): Promise<Quiz | undefined> => {
  await new Promise(resolve => setTimeout(resolve, 200));
  return mockGetQuizById(id);
};
export const getRules = async (): Promise<RuleCategory[]> => {
  await new Promise(resolve => setTimeout(resolve, 500));
  return mockGetRules();
};

// Admin functions that are still mocked
export const saveQuiz = async (quiz: Quiz, admin: User): Promise<void> => {
  await new Promise(resolve => setTimeout(resolve, 500));
  mockSaveQuiz(quiz, admin);
};
export const deleteQuiz = async (quizId: string, admin: User): Promise<void> => {
    await new Promise(resolve => setTimeout(resolve, 500));
    mockDeleteQuiz(quizId, admin);
};
export const saveRules = async (rules: RuleCategory[], admin: User): Promise<void> => {
    await new Promise(resolve => setTimeout(resolve, 500));
    mockSaveRules(rules, admin);
};
export const getAuditLogs = async (): Promise<AuditLogEntry[]> => {
    await new Promise(resolve => setTimeout(resolve, 500));
    return mockGetAuditLogs();
};


// --- Functions that use the REAL BACKEND ---

export const getSubmissions = async (): Promise<QuizSubmission[]> => {
    if (!USE_BACKEND) return mockGetSubmissions();
    return get<QuizSubmission[]>('/api/submissions');
}

export const getSubmissionsByUserId = async (userId: string): Promise<QuizSubmission[]> => {
    if (!USE_BACKEND) return mockGetSubmissionsByUserId(userId);
    return get<QuizSubmission[]>(`/api/users/${userId}/submissions`);
}

export const addSubmission = async (submissionData: Omit<QuizSubmission, 'id' | 'status'>): Promise<void> => {
    if (!USE_BACKEND) return mockAddSubmission(submissionData);
    await post<QuizSubmission>('/api/submissions', submissionData);
}

export const updateSubmissionStatus = async (submissionId: string, status: SubmissionStatus, admin: User): Promise<QuizSubmission> => {
    if (!USE_BACKEND) {
      mockUpdateSubmissionStatus(submissionId, status, admin);
      return mockGetSubmissions().find(s => s.id === submissionId)!;
    }
    return put<QuizSubmission>(`/api/submissions/${submissionId}/status`, { status, admin });
}
