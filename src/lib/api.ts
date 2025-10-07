import type { Quiz, QuizSubmission, User, RuleCategory, Product, AuditLogEntry, MtaServerStatus, SubmissionStatus, AppConfig } from '../types';

// --- API Error Handling ---
export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function fetchApi<T>(url: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(url, options);
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: response.statusText }));
    throw new ApiError(errorData.message || 'An unknown API error occurred', response.status);
  }
  const contentType = response.headers.get("content-type");
  if (contentType && contentType.indexOf("application/json") !== -1) {
    return response.json();
  } else {
    return Promise.resolve(null as T);
  }
}

// --- Public Routes ---
export const getPublicConfig = (): Promise<AppConfig> => fetchApi('/api/config');
export const getMtaServerStatus = (): Promise<MtaServerStatus> => fetchApi('/api/mta/status');
export const getDiscordStats = (): Promise<{ onlineCount: number, totalCount: number }> => fetchApi('/api/discord/stats');
export const getProducts = (): Promise<Product[]> => fetchApi('/api/products');
export const getQuizzes = (): Promise<Quiz[]> => fetchApi('/api/quizzes');
export const getQuizById = (id: string): Promise<Quiz> => fetchApi(`/api/quizzes/${id}`);
export const getRules = (): Promise<RuleCategory[]> => fetchApi('/api/rules');

// --- User/Submission Routes ---
export const addSubmission = (submission: Partial<QuizSubmission>): Promise<QuizSubmission> => {
    return fetchApi('/api/submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(submission),
    });
};

export const getSubmissionsByUserId = (userId: string): Promise<QuizSubmission[]> => fetchApi(`/api/submissions/user/${userId}`);

// --- Authenticated Routes ---
export const revalidateSession = (user: User): Promise<User> => {
    return fetchApi('/api/session/revalidate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user }),
    });
};

// --- Admin Routes ---

const getAuthHeaders = (user: User) => ({
    'Content-Type': 'application/json',
    'x-user-id': user.id,
    'x-user-roles': user.roles.join(','),
});

export const logAdminAccess = (user: User): Promise<void> => {
    return fetchApi('/api/admin/access-log', {
        method: 'POST',
        headers: getAuthHeaders(user),
    });
};

export const getSubmissions = (user: User): Promise<QuizSubmission[]> => fetchApi('/api/submissions', { headers: getAuthHeaders(user) });

export const updateSubmissionStatus = (submissionId: string, status: SubmissionStatus, user: User): Promise<QuizSubmission> => {
    return fetchApi(`/api/submissions/${submissionId}/status`, {
        method: 'PATCH',
        headers: getAuthHeaders(user),
        body: JSON.stringify({ status, adminId: user.id, adminUsername: user.username }),
    });
};

export const saveQuiz = (quiz: Quiz, user: User): Promise<Quiz> => {
    return fetchApi('/api/quizzes', {
        method: 'POST',
        headers: getAuthHeaders(user),
        body: JSON.stringify(quiz),
    });
};

export const deleteQuiz = (quizId: string, user: User): Promise<void> => {
    return fetchApi(`/api/quizzes/${quizId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(user),
    });
};

export const getAuditLogs = (user: User): Promise<AuditLogEntry[]> => fetchApi('/api/audit-logs', { headers: getAuthHeaders(user) });

export const saveRules = (rules: RuleCategory[], user: User): Promise<void> => {
    return fetchApi('/api/rules', {
        method: 'POST',
        headers: getAuthHeaders(user),
        body: JSON.stringify({ rules }),
    });
};

export const saveProduct = (product: Product, user: User): Promise<Product> => {
    return fetchApi('/api/products', {
        method: 'POST',
        headers: getAuthHeaders(user),
        body: JSON.stringify(product),
    });
};

export const deleteProduct = (productId: string, user: User): Promise<void> => {
    return fetchApi(`/api/products/${productId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(user),
    });
};

export const updatePublicConfig = (config: Partial<AppConfig>, user: User): Promise<void> => {
    return fetchApi('/api/admin/config', {
        method: 'POST',
        headers: getAuthHeaders(user),
        body: JSON.stringify(config)
    });
};
