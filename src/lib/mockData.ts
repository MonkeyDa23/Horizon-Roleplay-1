// src/lib/mockData.ts
import type { Product, Quiz, QuizSubmission, SubmissionStatus, User, AuditLogEntry, RuleCategory } from '../types';
import { CONFIG } from './config';

// --- STORE DATA ---
export let products: Product[] = [
  { id: 'prod_001', nameKey: 'product_vip_bronze_name', descriptionKey: 'product_vip_bronze_desc', price: 9.99, imageUrl: 'https://picsum.photos/seed/vip_bronze/400/300' },
  { id: 'prod_002', nameKey: 'product_vip_silver_name', descriptionKey: 'product_vip_silver_desc', price: 19.99, imageUrl: 'https://picsum.photos/seed/vip_silver/400/300' },
  { id: 'prod_003', nameKey: 'product_cash_1_name', descriptionKey: 'product_cash_1_desc', price: 4.99, imageUrl: 'https://picsum.photos/seed/cash_pack/400/300' },
  { id: 'prod_004', nameKey: 'product_custom_plate_name', descriptionKey: 'product_custom_plate_desc', price: 14.99, imageUrl: 'https://picsum.photos/seed/license_plate/400/300' },
];

// --- RULES DATA ---
let rules: RuleCategory[] = [
  { 
    id: 'cat_general', 
    titleKey: 'rules_general_title', 
    rules: [
      { id: 'rule_gen_1', textKey: 'rule_general_1' },
      { id: 'rule_gen_2', textKey: 'rule_general_2' },
    ]
  },
  {
    id: 'cat_rp',
    titleKey: 'rules_rp_title',
    rules: [
      { id: 'rule_rp_1', textKey: 'rule_rp_1' }
    ]
  }
];

// --- QUIZ DATA ---
let quizzes: Quiz[] = [
  {
    id: 'quiz_police_dept',
    titleKey: 'quiz_police_name',
    descriptionKey: 'quiz_police_desc',
    isOpen: true,
    questions: [
      { id: 'q1_police', textKey: 'q_police_1', timeLimit: 60 },
      { id: 'q2_police', textKey: 'q_police_2', timeLimit: 90 },
    ],
  },
  {
    id: 'quiz_ems_dept',
    titleKey: 'quiz_medic_name',
    descriptionKey: 'quiz_medic_desc',
    isOpen: false,
    questions: [
      { id: 'q1_ems', textKey: 'q_medic_1', timeLimit: 75 },
    ],
  },
];

// --- SUBMISSION & AUDIT LOG DATA (Mock Database) ---
let submissions: QuizSubmission[] = [];
let auditLogs: AuditLogEntry[] = [];
let nextLogId = 0;

const addAuditLog = (admin: User, action: string) => {
  auditLogs.unshift({
    id: `log_${nextLogId++}`,
    adminId: admin.id,
    adminUsername: admin.username,
    timestamp: new Date().toISOString(),
    action: action,
  });
};

// --- DATA MANIPULATION FUNCTIONS (called by api.ts) ---

export const getQuizzes = (): Quiz[] => JSON.parse(JSON.stringify(quizzes));
export const getQuizById = (id: string): Quiz | undefined => JSON.parse(JSON.stringify(quizzes.find(q => q.id === id)));
export const saveQuiz = (quizToSave: Quiz, admin: User): void => {
    const isNew = !quizzes.some(q => q.id === quizToSave.id);
    const index = quizzes.findIndex(q => q.id === quizToSave.id);
    if (index !== -1) {
        quizzes[index] = quizToSave;
    } else {
        quizzes.push(quizToSave);
    }
    const action = isNew 
      ? `Created new quiz form: "${quizToSave.titleKey}"` 
      : `Updated quiz form: "${quizToSave.titleKey}"`;
    addAuditLog(admin, action);
}
export const deleteQuiz = (quizId: string, admin: User): void => {
    const quizToDelete = quizzes.find(q => q.id === quizId);
    quizzes = quizzes.filter(q => q.id !== quizId);
    if (quizToDelete) {
        addAuditLog(admin, `Deleted quiz form: "${quizToDelete.titleKey}"`);
    }
}

export const getRules = (): RuleCategory[] => JSON.parse(JSON.stringify(rules));
export const saveRules = (newRules: RuleCategory[], admin: User): void => {
    rules = JSON.parse(JSON.stringify(newRules));
    addAuditLog(admin, 'Updated server rules.');
};

export const getSubmissions = (): QuizSubmission[] => {
  return JSON.parse(JSON.stringify(submissions.sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime())));
}
export const getSubmissionsByUserId = (userId: string): QuizSubmission[] => {
  return getSubmissions().filter(sub => sub.userId === userId);
}
export const addSubmission = (submission: Omit<QuizSubmission, 'id' | 'status'>): void => {
    const newSubmission: QuizSubmission = {
      ...submission,
      id: `sub_${Date.now()}`,
      status: 'pending',
    }
    submissions.push(newSubmission);
}
export const updateSubmissionStatus = (submissionId: string, status: SubmissionStatus, admin: User): void => {
  const index = submissions.findIndex(sub => sub.id === submissionId);
  if (index !== -1) {
    submissions[index].status = status;
    submissions[index].adminId = admin.id;
    submissions[index].adminUsername = admin.username;

    let action = '';
    const sub = submissions[index];
    switch(status) {
        case 'taken':
            action = `Took submission #${sub.id.slice(-5)} for "${sub.quizTitle}" from user ${sub.username}.`;
            break;
        case 'accepted':
            action = `Accepted submission #${sub.id.slice(-5)} for "${sub.quizTitle}" from user ${sub.username}.`;
            break;
        case 'refused':
            action = `Refused submission #${sub.id.slice(-5)} for "${sub.quizTitle}" from user ${sub.username}.`;
            break;
    }
    if (action) addAuditLog(admin, action);
  }
}

export const getAuditLogs = (): AuditLogEntry[] => {
  return JSON.parse(JSON.stringify(auditLogs));
};

// --- MTA SERVER API ---
export const getMtaServerStatus = async () => {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Simulate a chance of the server being offline
    if (Math.random() < 0.1) { // 10% chance of being offline
        return Promise.reject(new Error("Server is offline"));
    }

    // Simulate player count fluctuation
    const players = 80 + Math.floor(Math.random() * 40); // 80-120 players
    const maxPlayers = 200;

    return {
        name: `${CONFIG.COMMUNITY_NAME} Roleplay | Your Story Begins`,
        players,
        maxPlayers,
    };
}
