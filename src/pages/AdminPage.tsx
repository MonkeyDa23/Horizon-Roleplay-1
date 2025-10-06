import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useLocalization } from '../hooks/useLocalization';
import { 
  getQuizzes, 
  saveQuiz as apiSaveQuiz,
  deleteQuiz as apiDeleteQuiz,
  getSubmissions,
  updateSubmissionStatus,
  getAuditLogs,
  getRules,
  saveRules as apiSaveRules,
  revalidateSession,
  getProducts,
  saveProduct,
  deleteProduct,
} from '../lib/api';
import type { Quiz, QuizQuestion, QuizSubmission, SubmissionStatus, AuditLogEntry, RuleCategory, Rule, Product } from '../types';
import { useNavigate } from 'react-router-dom';
import { UserCog, Plus, Edit, Trash2, Check, X, FileText, Server, Eye, Loader2, ShieldCheck, BookCopy, ArrowUp, ArrowDown, Store } from 'lucide-react';
import Modal from '../components/Modal';

type AdminTab = 'submissions' | 'quizzes' | 'rules' | 'store' | 'audit';

const AdminPage: React.FC = () => {
  const { user, logout, updateUser } = useAuth();
  const { t } = useLocalization();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<AdminTab>('submissions');
  
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [editingQuiz, setEditingQuiz] = useState<Quiz | null>(null);

  const [submissions, setSubmissions] = useState<QuizSubmission[]>([]);
  const [viewingSubmission, setViewingSubmission] = useState<QuizSubmission | null>(null);
  
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  
  const [rules, setRules] = useState<RuleCategory[]>([]);
  const [editableRules, setEditableRules] = useState<RuleCategory[] | null>(null);

  const [products, setProducts] = useState<Product[]>([]);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const fetchAllData = useCallback(async () => {
    try {
      const [quizzesData, submissionsData, logsData, rulesData, productsData] = await Promise.all([
        getQuizzes(), getSubmissions(), getAuditLogs(), getRules(), getProducts()
      ]);
      setQuizzes(quizzesData);
      setSubmissions(submissionsData);
      setAuditLogs(logsData);
      setRules(rulesData);
      setEditableRules(JSON.parse(JSON.stringify(rulesData)));
      setProducts(productsData);
    } catch (error) {
        console.error("Failed to fetch admin data", error);
    }
  }, []);
  
  // CRITICAL: Gatekeeper effect to verify permissions on every load.
  useEffect(() => {
    const gateCheck = async () => {
      if (!user) {
        navigate('/');
        return;
      }

      setIsLoading(true);
      try {
        const freshUser = await revalidateSession(user);
        if (!freshUser.isAdmin) {
          // User is logged in, but not an admin.
          // Their permissions may have just been revoked.
          updateUser(freshUser); // Update their context to reflect non-admin status.
          navigate('/'); // Redirect them away securely.
          return;
        }
        
        // Authorization successful
        if(JSON.stringify(freshUser) !== JSON.stringify(user)) {
          updateUser(freshUser); // Ensure context is up to date
        }
        setIsAuthorized(true);

        // Now fetch all necessary admin data
        await fetchAllData();

      } catch (error) {
        console.error("Admin access check failed", error);
        // This error means the user might have been kicked from the server (API returns 404)
        // or the API is down. In either case, they can't access the admin panel.
        logout(); // Log them out for safety.
        navigate('/');
      } finally {
        setIsLoading(false);
      }
    };

    gateCheck();
  }, [user?.id, navigate, logout, updateUser, fetchAllData]);


  // --- Quiz Management Functions ---
  const handleCreateNewQuiz = () => setEditingQuiz({ id: '', titleKey: '', descriptionKey: '', isOpen: false, questions: [{ id: `q_${Date.now()}`, textKey: '', timeLimit: 60 }]});
  const handleEditQuiz = (quiz: Quiz) => setEditingQuiz(JSON.parse(JSON.stringify(quiz)));
  const handleDeleteQuiz = async (quizId: string) => {
    if (!user) return;
    const quizToDelete = quizzes.find(q => q.id === quizId);
    if (window.confirm(`Delete "${t(quizToDelete?.titleKey || 'this')}" quiz?`)) {
      await apiDeleteQuiz(quizId, user);
      await fetchAllData();
    }
  };
  const handleSaveQuiz = async () => {
    if (editingQuiz && user) {
      setIsSaving(true);
      await apiSaveQuiz(editingQuiz, user);
      await fetchAllData();
      setEditingQuiz(null);
      setIsSaving(false);
    }
  };
  
  // --- Product Management Functions ---
  const handleCreateNewProduct = () => setEditingProduct({ id: '', nameKey: '', descriptionKey: '', price: 0, imageUrl: '' });
  const handleEditProduct = (product: Product) => setEditingProduct(JSON.parse(JSON.stringify(product)));
  const handleDeleteProduct = async (productId: string) => {
      if (!user) return;
      const productToDelete = products.find(p => p.id === productId);
      if (window.confirm(`Delete "${t(productToDelete?.nameKey || 'this')}" product?`)) {
          await deleteProduct(productId, user);
          await fetchAllData();
      }
  };
  const handleSaveProduct = async () => {
      if (editingProduct && user) {
          setIsSaving(true);
          await saveProduct(editingProduct, user);
          await fetchAllData();
          setEditingProduct(null);
          setIsSaving(false);
      }
  };

  // --- Submission Management Functions ---
  const handleTakeOrder = async (submissionId: string) => { if(user) { await updateSubmissionStatus(submissionId, 'taken', user); await fetchAllData(); } }
  const handleDecision = async (submissionId: string, decision: 'accepted' | 'refused') => { if(user) { await updateSubmissionStatus(submissionId, decision, user); setViewingSubmission(null); await fetchAllData(); } }

  if (isLoading) {
    return <div className="flex justify-center items-center h-screen w-screen"><Loader2 size={48} className="text-brand-cyan animate-spin" /></div>;
  }
  
  if (!isAuthorized) {
      // This state should not be visible as the effect redirects, but serves as a failsafe.
      return null;
  }

  const renderStatusBadge = (status: SubmissionStatus) => {
    const statusMap = {
      pending: { text: t('status_pending'), color: 'bg-yellow-500/20 text-yellow-400' },
      taken: { text: t('status_taken'), color: 'bg-blue-500/20 text-blue-400' },
      accepted: { text: t('status_accepted'), color: 'bg-green-500/20 text-green-400' },
      refused: { text: t('status_refused'), color: 'bg-red-500/20 text-red-400' },
    };
    const { text, color } = statusMap[status];
    return <span className={`px-3 py-1 text-sm font-bold rounded-full ${color}`}>{text}</span>;
  };
  
  // --- RENDER METHODS ---
  const renderSharedPanel = (title:string, data: any[], columns: any[], renderRow: (item: any, index: number) => React.ReactNode, emptyMessage: string) => (
     <div className="bg-brand-dark-blue rounded-lg border border-brand-light-blue/50 mt-6">
      <div className="overflow-x-auto">
        <table className="w-full text-left min-w-[600px]">
          <thead className="border-b border-brand-light-blue/50 text-gray-300">
            <tr>{columns.map(c => <th key={c.key} className={`p-4 ${c.className || ''}`}>{c.label}</th>)}</tr>
          </thead>
          <tbody>
            {data.length === 0 ? (
              <tr><td colSpan={columns.length} className="p-8 text-center text-gray-400">{t(emptyMessage)}</td></tr>
            ) : data.map(renderRow)}
          </tbody>
        </table>
      </div>
    </div>
  );

  const SubmissionsPanel = () => renderSharedPanel('submissions', submissions,
    [{key:'applicant', label:t('applicant')}, {key:'quiz_title', label:t('quiz_title')}, {key:'date', label:t('submitted_on')}, {key:'status', label:t('status')}, {key:'actions', label:t('actions'), className:'text-right'}],
    (sub, i) => (
      <tr key={sub.id} className={`border-b border-brand-light-blue/50 ${i === submissions.length - 1 ? 'border-none' : ''}`}>
        <td className="p-4 font-semibold">{sub.username}</td> <td className="p-4">{sub.quizTitle}</td>
        <td className="p-4 text-sm text-gray-400">{new Date(sub.submittedAt).toLocaleDateString()}</td>
        <td className="p-4">{renderStatusBadge(sub.status)}</td>
        <td className="p-4 text-right">
          <div className="inline-flex gap-4 items-center">
            {sub.status === 'pending' && <button onClick={() => handleTakeOrder(sub.id)} className="bg-brand-cyan/20 text-brand-cyan font-bold py-1 px-3 rounded-md hover:bg-brand-cyan/40 text-sm">{t('take_order')}</button>}
            {sub.status === 'taken' && <span className="text-xs text-gray-400 italic">{t('taken_by')} {sub.adminUsername === user.username ? 'You' : sub.adminUsername}</span>}
            <button onClick={() => setViewingSubmission(sub)} className="text-gray-300 hover:text-brand-cyan" title={t('view_submission')}><Eye size={20}/></button>
          </div>
        </td>
      </tr>
    ), 'no_pending_submissions'
  );

  const AuditLogPanel = () => renderSharedPanel('audit', auditLogs,
    [{key:'ts', label:t('log_timestamp')},{key:'admin', label:t('log_admin')},{key:'action', label:t('log_action')}],
    (log, i) => (
      <tr key={log.id} className={`border-b border-brand-light-blue/50 ${i === auditLogs.length - 1 ? 'border-none' : ''}`}>
        <td className="p-4 text-sm text-gray-400 whitespace-nowrap">{new Date(log.timestamp).toLocaleString()}</td>
        <td className="p-4 font-semibold">{log.adminUsername}</td><td className="p-4">{log.action}</td>
      </tr>
    ), 'no_logs_found'
  );

  const StorePanel = () => (
    <>
    <div className="flex justify-between items-center my-6">
        <h2 className="text-2xl font-bold">Store Management</h2>
        <button onClick={handleCreateNewProduct} className="bg-brand-cyan text-brand-dark font-bold py-2 px-4 rounded-md hover:bg-white transition-all flex items-center gap-2">
            <Plus size={20} /> Add New Product
        </button>
    </div>
    {renderSharedPanel('store', products,
        [{key:'product', label:'Product'}, {key:'price', label:'Price'}, {key:'actions', label:t('actions'), className:'text-right'}],
        (p, i) => (
            <tr key={p.id} className={`border-b border-brand-light-blue/50 ${i === products.length - 1 ? 'border-none' : ''}`}>
                <td className="p-4 font-semibold flex items-center gap-4"><img src={p.imageUrl} alt="" className="w-12 h-12 rounded-md object-cover" /><span>{t(p.nameKey)}</span></td>
                <td className="p-4 text-brand-cyan font-bold">${p.price.toFixed(2)}</td>
                <td className="p-4 text-right">
                    <div className="inline-flex gap-4">
                        <button onClick={() => handleEditProduct(p)} className="text-gray-300 hover:text-brand-cyan"><Edit size={20}/></button>
                        <button onClick={() => handleDeleteProduct(p.id)} className="text-gray-300 hover:text-red-500"><Trash2 size={20}/></button>
                    </div>
                </td>
            </tr>
        ), 'No products found.'
    )}
    </>
  );

  const QuizzesPanel = () => (
      <div>
        <div className="flex justify-between items-center my-6">
            <h2 className="text-2xl font-bold">{t('quiz_management')}</h2>
            <button onClick={handleCreateNewQuiz} className="bg-brand-cyan text-brand-dark font-bold py-2 px-4 rounded-md hover:bg-white transition-all flex items-center gap-2">
                <Plus size={20} />
                {t('create_new_quiz')}
            </button>
        </div>
        {editingQuiz ? <div>...QuizEditor...</div> : (
        <div className="bg-brand-dark-blue rounded-lg border border-brand-light-blue/50">
          <table className="w-full text-left">
            <thead className="border-b border-brand-light-blue/50 text-gray-300">
              <tr>
                <th className="p-4">{t('quiz_title')}</th>
                <th className="p-4">{t('status')}</th>
                <th className="p-4 text-right">{t('actions')}</th>
              </tr>
            </thead>
            <tbody>
              {quizzes.map((quiz, index) => (
                <tr key={quiz.id} className={`border-b border-brand-light-blue/50 ${index === quizzes.length - 1 ? 'border-none' : ''}`}>
                  <td className="p-4 font-semibold">{t(quiz.titleKey)}</td>
                  <td className="p-4">
                    <span className={`px-3 py-1 text-sm font-bold rounded-full ${quiz.isOpen ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                      {quiz.isOpen ? t('open') : t('closed')}
                    </span>
                  </td>
                  <td className="p-4 text-right">
                    <div className="inline-flex gap-4">
                       <button onClick={() => handleEditQuiz(quiz)} className="text-gray-300 hover:text-brand-cyan"><Edit size={20}/></button>
                       <button onClick={() => handleDeleteQuiz(quiz.id)} className="text-gray-300 hover:text-red-500"><Trash2 size={20}/></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        )}
      </div>
  );


  return (
    <div className="container mx-auto px-6 py-16">
      <div className="text-center mb-12"><div className="inline-block p-4 bg-brand-light-blue rounded-full mb-4"><UserCog className="text-brand-cyan" size={48} /></div><h1 className="text-4xl md:text-5xl font-bold mb-4">{t('page_title_admin')}</h1></div>
      <div className="max-w-6xl mx-auto">
        <div className="flex border-b border-brand-light-blue/50 mb-6 overflow-x-auto">
            <button onClick={() => setActiveTab('submissions')} className={`py-3 px-6 font-bold flex-shrink-0 flex items-center gap-2 ${activeTab === 'submissions' ? 'text-brand-cyan border-b-2 border-brand-cyan' : 'text-gray-400'}`}><FileText size={18}/> {t('submission_management')}</button>
            <button onClick={() => setActiveTab('quizzes')} className={`py-3 px-6 font-bold flex-shrink-0 flex items-center gap-2 ${activeTab === 'quizzes' ? 'text-brand-cyan border-b-2 border-brand-cyan' : 'text-gray-400'}`}><Server size={18}/> {t('quiz_management')}</button>
            <button onClick={() => setActiveTab('rules')} className={`py-3 px-6 font-bold flex-shrink-0 flex items-center gap-2 ${activeTab === 'rules' ? 'text-brand-cyan border-b-2 border-brand-cyan' : 'text-gray-400'}`}><BookCopy size={18}/> {t('rules_management')}</button>
            <button onClick={() => setActiveTab('store')} className={`py-3 px-6 font-bold flex-shrink-0 flex items-center gap-2 ${activeTab === 'store' ? 'text-brand-cyan border-b-2 border-brand-cyan' : 'text-gray-400'}`}><Store size={18}/> Store Management</button>
            <button onClick={() => setActiveTab('audit')} className={`py-3 px-6 font-bold flex-shrink-0 flex items-center gap-2 ${activeTab === 'audit' ? 'text-brand-cyan border-b-2 border-brand-cyan' : 'text-gray-400'}`}><ShieldCheck size={18}/> {t('audit_log')}</button>
        </div>
        
        {
          <>
            {activeTab === 'submissions' && <SubmissionsPanel />}
            {activeTab === 'quizzes' && <QuizzesPanel />}
            {activeTab === 'audit' && <AuditLogPanel />}
            {activeTab === 'store' && <StorePanel />}
          </>
        }
      </div>
      
      {/* Modals */}
      {viewingSubmission && (<Modal isOpen={!!viewingSubmission} onClose={() => setViewingSubmission(null)} title={t('submission_details')}>
          <div className="space-y-4 text-gray-200">
              <p><strong>{t('applicant')}:</strong> {viewingSubmission.username}</p>
              <p><strong>{t('status')}:</strong> {renderStatusBadge(viewingSubmission.status)}</p>
              {viewingSubmission.adminUsername && <p><strong>{t('taken_by')}:</strong> {viewingSubmission.adminUsername}</p>}
              <div className="border-t border-brand-light-blue pt-4 mt-4">
                  <h4 className="text-lg font-bold text-brand-cyan mb-2">{t('quiz_questions')}</h4>
                  <div className="space-y-3 max-h-60 overflow-y-auto pr-2">{viewingSubmission.answers.map((ans, i) => (<div key={ans.questionId}><p className="font-semibold text-gray-300">{i+1}. {ans.questionText}</p><p className="bg-brand-dark p-2 rounded mt-1 text-gray-200 whitespace-pre-wrap">{ans.answer}</p></div>))}</div>
              </div>
              {viewingSubmission.status === 'taken' && user && viewingSubmission.adminId === user.id && (
                  <div className="flex justify-end gap-4 pt-6 border-t border-brand-light-blue">
                      <button onClick={() => handleDecision(viewingSubmission.id, 'refused')} className="flex items-center gap-2 bg-red-600 text-white font-bold py-2 px-5 rounded-md hover:bg-red-500 transition-colors"><X size={20}/> {t('refuse')}</button>
                      <button onClick={() => handleDecision(viewingSubmission.id, 'accepted')} className="flex items-center gap-2 bg-green-600 text-white font-bold py-2 px-5 rounded-md hover:bg-green-500 transition-colors"><Check size={20}/> {t('accept')}</button>
                  </div>
              )}
          </div>
      </Modal>)}
      
      {editingProduct && (<Modal isOpen={!!editingProduct} onClose={() => setEditingProduct(null)} title={editingProduct.id ? 'Edit Product' : 'Create New Product'}>
         <div className="space-y-4">
            <div><label className="block mb-1 font-semibold text-gray-300">Name Key</label><input type="text" value={editingProduct.nameKey} onChange={(e) => setEditingProduct({...editingProduct, nameKey: e.target.value})} className="w-full bg-brand-light-blue p-2 rounded border border-gray-600" /></div>
            <div><label className="block mb-1 font-semibold text-gray-300">Description Key</label><input type="text" value={editingProduct.descriptionKey} onChange={(e) => setEditingProduct({...editingProduct, descriptionKey: e.target.value})} className="w-full bg-brand-light-blue p-2 rounded border border-gray-600" /></div>
            <div><label className="block mb-1 font-semibold text-gray-300">Price ($)</label><input type="number" value={editingProduct.price} onChange={(e) => setEditingProduct({...editingProduct, price: parseFloat(e.target.value) || 0})} className="w-full bg-brand-light-blue p-2 rounded border border-gray-600" /></div>
            <div><label className="block mb-1 font-semibold text-gray-300">Image URL</label><input type="text" value={editingProduct.imageUrl} onChange={(e) => setEditingProduct({...editingProduct, imageUrl: e.target.value})} className="w-full bg-brand-light-blue p-2 rounded border border-gray-600" /></div>
            <div className="flex justify-end gap-4 pt-4">
                <button onClick={() => setEditingProduct(null)} disabled={isSaving} className="bg-gray-600 text-white font-bold py-2 px-6 rounded-md hover:bg-gray-500">Cancel</button>
                <button onClick={handleSaveProduct} disabled={isSaving} className="bg-brand-cyan text-brand-dark font-bold py-2 px-6 rounded-md hover:bg-white flex items-center justify-center min-w-[8rem]">{isSaving ? <Loader2 className="animate-spin"/> : 'Save Product'}</button>
            </div>
         </div>
      </Modal>)}
    </div>
  );
};

export default AdminPage;