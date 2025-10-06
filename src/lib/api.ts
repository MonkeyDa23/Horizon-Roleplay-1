// src/lib/api.ts
// FIX: Corrected import path for AppConfig. It is exported from './config'.
import type { Product, Quiz, QuizSubmission, SubmissionStatus, User, AuditLogEntry, RuleCategory, MtaServerStatus } from '../types';
import type { AppConfig } from './config';

export class ApiError extends Error {
    status: number;
    data: any;

    constructor(message: string, status: number, data: any) {
        super(message);
        this.name = 'ApiError';
        this.status = status;
        this.data = data;
    }
}

const handleResponse = async (response: Response) => {
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: response.statusText }));
        throw new ApiError(errorData.message || 'An unknown API error occurred', response.status, errorData);
    }
    return response.status === 204 ? null : response.json();
};

const get = <T>(endpoint: string): Promise<T> => fetch(endpoint).then(res => handleResponse(res));
const post = <T>(endpoint: string, body: any): Promise<T> => fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(res => handleResponse(res));
const put = <T>(endpoint: string, body: any): Promise<T> => fetch(endpoint, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(res => handleResponse(res));
const del = <T>(endpoint: string, body?: any): Promise<T> => fetch(endpoint, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }).then(res => handleResponse(res));


// --- Public API Functions ---

// Config
export const getPublicConfig = (): Promise<Partial<AppConfig>> => get('/api/config');

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