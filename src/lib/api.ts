// src/lib/api.ts
import type { Product, Quiz, QuizSubmission, SubmissionStatus, User, AuditLogEntry, RuleCategory, MtaServerStatus } from '../types';

// --- API HELPER FUNCTIONS ---
const get = async <T>(endpoint: string): Promise<T> => {
    const response = await fetch(endpoint);
    if (!response.ok) throw new Error(`Failed to fetch from ${endpoint}: ${response.statusText}`);
    return response.json();
};

const post = async <T>(endpoint: string, body: any): Promise<T> => {
    const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    if (!response.ok) throw new Error(`Failed to POST to ${endpoint}: ${response.statusText}`);
    return response.json();
};

const put = async <T>(endpoint: string, body: any): Promise<T> => {
    const response = await fetch(endpoint, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    if (!response.ok) throw new Error(`Failed to PUT to ${endpoint}: ${response.statusText}`);
    return response.json();
};

const del = async (endpoint: string, body: any): Promise<void> => {
    const response = await fetch(endpoint, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    if (!response.ok) throw new Error(`Failed to DELETE from ${endpoint}: ${response.statusText}`);
};

// --- PUBLIC API FUNCTIONS ---

// Read-only data
export const getProducts = (): Promise<Product[]> => get('/api/products');
export const getRules = (): Promise<RuleCategory[]> => get('/api/rules');
export const getQuizzes = (): Promise<Quiz[]> => get('/api/quizzes');
export const getQuizById = (id: string): Promise<Quiz | undefined> => get(`/api/quizzes/${id}`);
export const getMtaServerStatus = (): Promise<MtaServerStatus> => get('/api/mta-status');

// Submissions
export const getSubmissions = (): Promise<QuizSubmission[]> => get('/api/submissions');
export const getSubmissionsByUserId = (userId: string): Promise<QuizSubmission[]> => get(`/api/users/${userId}/submissions`);
export const addSubmission = (submissionData: Omit<QuizSubmission, 'id' | 'status'>): Promise<void> => post('/api/submissions', submissionData);
export const updateSubmissionStatus = (submissionId: string, status: SubmissionStatus, admin: User): Promise<QuizSubmission> => {
    return put(`/api/submissions/${submissionId}/status`, { status, admin });
}

// Admin - Quizzes
export const saveQuiz = (quiz: Quiz, admin: User): Promise<Quiz> => post('/api/quizzes', { quiz, admin });
export const deleteQuiz = (quizId: string, admin: User): Promise<void> => del(`/api/quizzes/${quizId}`, { admin });

// Admin - Rules
export const saveRules = (rules: RuleCategory[], admin: User): Promise<RuleCategory[]> => post('/api/rules', { rules, admin });

// Admin - Products
export const saveProduct = (product: Product, admin: User): Promise<Product> => post('/api/products', { product, admin });
export const deleteProduct = (productId: string, admin: User): Promise<void> => del(`/api/products/${productId}`, { admin });

// Admin - General
export const getAuditLogs = (): Promise<AuditLogEntry[]> => get('/api/audit-logs');
export const revalidateSession = (user: User): Promise<User> => post('/api/auth/session', { user });
export const logAdminAccess = (admin: User): Promise<void> => post('/api/admin/log-access', { admin });