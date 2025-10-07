import type { User, Product, Quiz, QuizSubmission, SubmissionStatus, DiscordRole, DiscordAnnouncement, MtaServerStatus, AuditLogEntry, RuleCategory, AppConfig, MtaLogEntry } from '../types';

// --- API Error Handling ---
// FIX: Updated ApiError to include a status code for better error handling.
export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

// --- MOCK DATABASE ---
let MOCK_CONFIG: AppConfig = {
    COMMUNITY_NAME: 'Horizon',
    LOGO_URL: 'https://l.top4top.io/p_356271n1v1.png',
    DISCORD_INVITE_URL: 'https://discord.gg/u3CazwhxVa',
    MTA_SERVER_URL: 'mtasa://134.255.216.22:22041',
    BACKGROUND_IMAGE_URL: '',
    SHOW_HEALTH_CHECK: false,
    SUPER_ADMIN_ROLE_IDS: ["role_admin"],
};

let MOCK_DB = {
  products: [
    { id: 'prod_1', nameKey: 'product_vip_bronze_name', descriptionKey: 'product_vip_bronze_desc', price: 10.00, imageUrl: 'https://i.imgur.com/S8wO2G6.png' },
    { id: 'prod_2', nameKey: 'product_vip_silver_name', descriptionKey: 'product_vip_silver_desc', price: 20.00, imageUrl: 'https://i.imgur.com/S8wO2G6.png' },
    { id: 'prod_3', nameKey: 'product_cash_1_name', descriptionKey: 'product_cash_1_desc', price: 5.00, imageUrl: 'https://i.imgur.com/S8wO2G6.png' },
    { id: 'prod_4', nameKey: 'product_custom_plate_name', descriptionKey: 'product_custom_plate_desc', price: 15.00, imageUrl: 'https://i.imgur.com/S8wO2G6.png' },
  ],
  quizzes: [
    { id: 'quiz_1', titleKey: 'quiz_police_name', descriptionKey: 'quiz_police_desc', isOpen: true, questions: [
      { id: 'q_1_1', textKey: 'q_police_1', timeLimit: 60 },
      { id: 'q_1_2', textKey: 'q_police_2', timeLimit: 90 },
    ], logoUrl: 'https://i.imgur.com/your_logo.png', bannerUrl: 'https://i.imgur.com/your_banner.png', lastOpenedAt: new Date().toISOString() },
    { id: 'quiz_2', titleKey: 'quiz_medic_name', descriptionKey: 'quiz_medic_desc', isOpen: false, questions: [
      { id: 'q_2_1', textKey: 'q_medic_1', timeLimit: 75 },
    ]},
  ],
  submissions: [],
  audit_logs: [],
  rules: [],
};

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));


// --- Public Functions ---

// FIX: Added getConfig to fetch dynamic configuration.
export const getConfig = async (): Promise<AppConfig> => {
    await delay(200);
    return MOCK_CONFIG;
}

export const getProducts = async (): Promise<Product[]> => {
  await delay(500);
  return MOCK_DB.products;
};

export const getQuizzes = async (): Promise<Quiz[]> => {
  await delay(500);
  return MOCK_DB.quizzes;
};

export const getQuizById = async (id: string): Promise<Quiz | undefined> => {
  await delay(300);
  return MOCK_DB.quizzes.find(q => q.id === id);
}

export const getMtaServerStatus = async (): Promise<MtaServerStatus> => {
    await delay(800);
    return {
        name: `${MOCK_CONFIG.COMMUNITY_NAME} Roleplay`,
        players: Math.floor(Math.random() * 100),
        maxPlayers: 128,
    };
}

// --- User-Specific Functions ---

export const getSubmissionsByUserId = async (userId: string): Promise<QuizSubmission[]> => {
    await delay(600);
    return MOCK_DB.submissions.filter(s => s.userId === userId);
}

export const addSubmission = async (submissionData: Partial<QuizSubmission>): Promise<QuizSubmission> => {
    await delay(1000);
    const newSubmission: QuizSubmission = {
        id: `sub_${Date.now()}`,
        status: 'pending',
        submittedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ...submissionData,
    } as QuizSubmission;
    MOCK_DB.submissions.push(newSubmission);
    return newSubmission;
};


// --- Admin Functions ---

export const getSubmissions = async (): Promise<QuizSubmission[]> => {
    await delay(700);
    return MOCK_DB.submissions.sort((a,b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
}

export const updateSubmissionStatus = async (submissionId: string, status: SubmissionStatus): Promise<void> => {
    await delay(400);
    const submission = MOCK_DB.submissions.find(s => s.id === submissionId);
    if(submission) {
        submission.status = status;
        // FIX: Added updatedAt timestamp on status change.
        submission.updatedAt = new Date().toISOString();
        // In a real scenario, admin details would be taken from the session
        submission.adminId = "1423683069893673050";
        submission.adminUsername = "AdminUser";
    } else {
        // FIX: Throw ApiError with a status code.
        throw new ApiError("Submission not found", 404);
    }
}

export const saveQuiz = async (quiz: Quiz): Promise<Quiz> => {
    await delay(500);
    if(quiz.id) { // update
        const index = MOCK_DB.quizzes.findIndex(q => q.id === quiz.id);
        if(index > -1) MOCK_DB.quizzes[index] = quiz;
    } else { // create
        const newQuiz = { ...quiz, id: `quiz_${Date.now()}`};
        MOCK_DB.quizzes.push(newQuiz);
        return newQuiz;
    }
    return quiz;
}

export const deleteQuiz = async (quizId: string): Promise<void> => {
    await delay(500);
    MOCK_DB.quizzes = MOCK_DB.quizzes.filter(q => q.id !== quizId);
}

// FIX: Added saveConfig to allow admins to update settings.
export const saveConfig = async (config: Partial<AppConfig>): Promise<void> => {
    await delay(500);
    MOCK_CONFIG = { ...MOCK_CONFIG, ...config };
}

export const revalidateSession = async (currentUser: User): Promise<User> => {
    await delay(200);
    // FIX: This mock function now simulates fetching a primary role.
    const primaryRole = currentUser.discordRoles.find(r => r.id === 'role_admin') || currentUser.discordRoles[0];
    return { ...currentUser, primaryRole };
}

export const logAdminAccess = async (user: User): Promise<void> => {
    console.log(`Admin access by ${user.username}`);
}
export const getAuditLogs = async (): Promise<AuditLogEntry[]> => { return []; }
export const getRules = async (): Promise<RuleCategory[]> => { return MOCK_DB.rules; }
export const saveRules = async (rules: RuleCategory[]): Promise<void> => { MOCK_DB.rules = rules; }
export const saveProduct = async (product: Product): Promise<Product> => { return product; }
export const deleteProduct = async (productId: string): Promise<void> => {}


// --- NEW MOCK DISCORD FUNCTIONS ---

export const getDiscordRoles = async (userId: string): Promise<DiscordRole[]> => {
    await delay(300);
    // Mock roles based on user ID. The mock admin ID gets special roles.
    const isAdmin = userId === "1423683069893673050";
    
    let roles = [
      { id: 'role_member', name: 'Member', color: '#8a95a3' },
      { id: 'role_level10', name: 'Level 10+', color: '#f1c40f' },
    ];

    if (isAdmin) {
      roles.unshift({ id: 'role_admin', name: 'Server Admin', color: '#00f2ea' });
      roles.push({ id: 'role_booster', name: 'Server Booster', color: '#f47fff' });
    }

    return roles;
};

export const getDiscordAnnouncements = async (): Promise<DiscordAnnouncement[]> => {
    await delay(1200);
    return [
        {
            id: '1',
            title: '🎉 Community Event: Summer Drift King!',
            content: 'Get your engines ready! This Saturday, we are hosting the annual Summer Drift King competition. Sign-ups are open now in the #events channel. Amazing prizes to be won, including exclusive custom vehicles!',
            author: {
                name: 'AdminUser',
                avatarUrl: 'https://cdn.discordapp.com/embed/avatars/0.png'
            },
            timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(), // 1 day ago
            url: '#'
        },
        {
            id: '2',
            title: '🔧 Server Maintenance & Update v2.5',
            content: 'Please be advised that the server will be down for scheduled maintenance tonight at 2 AM for approximately one hour. We will be deploying update v2.5 which includes new police vehicles, bug fixes, and performance improvements.',
            author: {
                name: 'AdminUser',
                avatarUrl: 'https://cdn.discordapp.com/embed/avatars/1.png'
            },
            timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString(), // 3 days ago
            url: '#'
        }
    ];
};

// FIX: Added mock function to get player logs for the admin panel.
export const getMtaPlayerLogs = async (userId: string): Promise<MtaLogEntry[]> => {
    await delay(800);
    if (userId === "1423683069893673050" || userId === "AdminUser") { // Allow lookup by name for mock
        return [
            { timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(), text: "Player connected with IP 127.0.0.1" },
            { timestamp: new Date(Date.now() - 1000 * 60 * 45).toISOString(), text: "Purchased a 'Sultan' from the dealership." },
            { timestamp: new Date(Date.now() - 1000 * 60 * 20).toISOString(), text: "Was jailed for 10 minutes by Admin 'AnotherAdmin' for Reckless Driving." },
            { timestamp: new Date(Date.now() - 1000 * 60 * 5).toISOString(), text: "Sent a private message to 'PlayerTwo'." },
            { timestamp: new Date(Date.now() - 1000 * 60 * 1).toISOString(), text: "Player disconnected." },
        ];
    }
    return [];
};
