import React, { useState, useEffect } from 'react';
import '../styles/dashboard.css';
import InsertSignatureModal from '../components/InsertSignatureModal';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';

const ESignature = () => {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('pending');
    const [showInsertModal, setShowInsertModal] = useState(false);
    const [signatureRequests, setSignatureRequests] = useState([]);
    const [stats, setStats] = useState({ pending: 0, waiting: 0, completed: 0 });
    const [loading, setLoading] = useState(false);
    const [user, setUser] = useState(null);

    // Initial load fetch user
    useEffect(() => {
        const fetchUser = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user) {
                setUser(session.user);
            }
        };
        fetchUser();
    }, []);

    // Load signature requests when user available or tab changes (to refresh)
    useEffect(() => {
        if (user) {
            loadSignatureRequests();
        }
    }, [user, activeTab]);

    const loadSignatureRequests = async () => {
        setLoading(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;

            const res = await fetch(`${API_BASE_URL}/e-signature/signature-requests`, {
                headers: {
                    'Authorization': `Bearer ${session.access_token}`
                }
            });
            const result = await res.json();
            
            if (result.success) {
                setSignatureRequests(result.data);
                calculateStats(result.data, session.user);
            }
        } catch (error) {
            console.error('Error loading requests:', error);
        } finally {
            setLoading(false);
        }
    };

    const calculateStats = (requests, currentUser) => {
        const userId = currentUser.id;
        const userEmail = currentUser.email;

        let pendingCount = 0;
        let waitingCount = 0;
        let completedCount = 0;

        requests.forEach(req => {
            const mySignerRecord = req.signers?.find(s => s.signer_id === userId || s.signer_email === userEmail);
            const isCreator = req.creator_id === userId;

            // Pending: Cần tôi ký
            if (mySignerRecord && mySignerRecord.status === 'pending') {
                pendingCount++;
            }
            
            // Waiting: Tôi tạo hoặc tôi đã ký xong, nhưng request chưa xong
            else if (req.status === 'pending' && (isCreator || (mySignerRecord && mySignerRecord.status === 'signed'))) {
                waitingCount++;
            }

            // Completed: Request đã xong
            else if (req.status === 'signed') {
                completedCount++;
            }
        });

        setStats({ pending: pendingCount, waiting: waitingCount, completed: completedCount });
    };

    const getFilteredRequests = () => {
        if (!user) return [];
        const userId = user.id;
        const userEmail = user.email;

        return signatureRequests.filter(req => {
            const mySignerRecord = req.signers?.find(s => s.signer_id === userId || s.signer_email === userEmail);
            const isCreator = req.creator_id === userId;

            if (activeTab === 'pending') {
                return mySignerRecord && mySignerRecord.status === 'pending';
            }
            if (activeTab === 'waiting') {
                const isMySignerDone = mySignerRecord && mySignerRecord.status === 'signed';
                // Chỉ hiện ở waiting nếu request chưa hoàn thành (status pending)
                return req.status === 'pending' && (isCreator || isMySignerDone) && !(mySignerRecord && mySignerRecord.status === 'pending');
            }
            if (activeTab === 'completed') {
                return req.status === 'signed';
            }
            if (activeTab === 'cancelled') {
                return req.status === 'cancelled';
            }
            return false;
        });
    };

    const handleSignatureSuccess = (result) => {
        console.log('Signature inserted successfully:', result);
        loadSignatureRequests();
        alert('Yêu cầu ký đã được tạo thành công!');
    };
    
    const handleSignClick = (requestId) => {
        // Navigate based on tab/status
        if (activeTab === 'pending') {
            // Need to sign -> Go to Sign Page
            navigate(`/sign?requestId=${requestId}`);
        } else {
            // Just viewing -> Go to View Page
            navigate(`/view-document/${requestId}`);
        }
    };

    const filteredRequests = getFilteredRequests();

    return (
        <div className="dashboard-body">
            <div className="page-title" style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                <div>
                    <h2>Trung tâm Chữ ký số</h2>
                    <p>AI đang giám sát <b>{stats.pending + stats.waiting}</b> luồng ký. Dữ liệu thực.</p>
                </div>
                <button 
                    className="btn-sm" 
                    style={{
                        background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)', 
                        color: 'white', 
                        border: 'none', 
                        padding: '12px 24px',
                        borderRadius: '8px',
                        fontWeight: '500',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                    }}
                    onClick={() => setShowInsertModal(true)}
                >
                    <i className="fas fa-pen-nib"></i> Tạo luồng ký mới
                </button>
            </div>

            <div className="stats-grid" style={{gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: '20px'}}>
                <div className={`card ${activeTab === 'pending' ? 'stats-active' : ''}`} style={{flexDirection: 'row', alignItems: 'center', padding: '20px', cursor: 'pointer', border: activeTab === 'pending' ? '2px solid #f97316' : ''}} onClick={() => setActiveTab('pending')}>
                    <div className="card-icon icon-orange" style={{marginBottom: 0, marginRight: '15px'}}><i className="fas fa-clock"></i></div>
                    <div>
                        <div className="number">{stats.pending}</div>
                        <h3 style={{margin: 0}}>Cần tôi ký duyệt</h3>
                    </div>
                </div>
                <div className={`card ${activeTab === 'waiting' ? 'stats-active' : ''}`} style={{flexDirection: 'row', alignItems: 'center', padding: '20px', cursor: 'pointer', border: activeTab === 'waiting' ? '2px solid #3b82f6' : ''}} onClick={() => setActiveTab('waiting')}>
                    <div className="card-icon icon-blue" style={{marginBottom: 0, marginRight: '15px'}}><i className="fas fa-spinner"></i></div>
                    <div>
                        <div className="number">{stats.waiting}</div>
                        <h3 style={{margin: 0}}>Chờ người khác ký</h3>
                    </div>
                </div>
                <div className={`card ${activeTab === 'completed' ? 'stats-active' : ''}`} style={{flexDirection: 'row', alignItems: 'center', padding: '20px', cursor: 'pointer', border: activeTab === 'completed' ? '2px solid #10b981' : ''}} onClick={() => setActiveTab('completed')}>
                    <div className="card-icon icon-green" style={{marginBottom: 0, marginRight: '15px'}}><i className="fas fa-check-circle"></i></div>
                    <div>
                        <div className="number">{stats.completed}</div>
                        <h3 style={{margin: 0}}>Đã hoàn thành</h3>
                    </div>
                </div>
            </div>

            <div className="table-section">
                <div className="tab-menu">
                    <div className={`tab-item ${activeTab === 'pending' ? 'active' : ''}`} onClick={() => setActiveTab('pending')}>
                        Cần xử lý <span className="tab-count">{stats.pending}</span>
                    </div>
                    <div className={`tab-item ${activeTab === 'waiting' ? 'active' : ''}`} onClick={() => setActiveTab('waiting')}>
                        Đang chờ <span className="tab-count">{stats.waiting}</span>
                    </div>
                    <div className={`tab-item ${activeTab === 'completed' ? 'active' : ''}`} onClick={() => setActiveTab('completed')}>
                        Đã hoàn thành <span className="tab-count">{stats.completed}</span>
                    </div>
                     <div className={`tab-item ${activeTab === 'cancelled' ? 'active' : ''}`} onClick={() => setActiveTab('cancelled')}>
                        Đã hủy
                    </div>
                </div>

                {loading ? (
                    <div style={{padding: '40px', textAlign: 'center', color: '#6b7280'}}>
                        <i className="fas fa-spinner fa-spin fa-2x"></i>
                        <p style={{marginTop: '10px'}}>Đang tải dữ liệu...</p>
                    </div>
                ) : filteredRequests.length === 0 ? (
                     <div style={{padding: '40px', textAlign: 'center', color: '#6b7280'}}>
                        <i className="fas fa-inbox fa-3x" style={{marginBottom: '15px', color: '#e5e7eb'}}></i>
                        <p>Không có yêu cầu nào trong mục này.</p>
                    </div>
                ) : (
                    <table>
                        <thead>
                            <tr>
                                <th style={{width: '30%'}}>Tên tài liệu</th>
                                <th>Người tạo</th>
                                <th>Tiến độ ký</th>
                                <th>Trạng thái</th>
                                <th>Hạn chót</th>
                                <th>Thao tác</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredRequests.map(req => {
                                const signedCount = req.signers?.filter(s => s.status === 'signed').length || 0;
                                const totalSigners = req.signers?.length || 0;
                                const progress = totalSigners > 0 ? (signedCount / totalSigners) * 100 : 0;
                                
                                return (
                                    <tr key={req.id}>
                                        <td>
                                            <div style={{display: 'flex', alignItems: 'center', gap: '10px'}}>
                                                <i className="fas fa-file-pdf" style={{color: '#ef4444', fontSize: '18px'}}></i>
                                                <div>
                                                    <div style={{fontWeight: 600, color: '#374151'}}>{req.document?.title || 'Không có tiêu đề'}</div>
                                                    <div style={{fontSize: '11px', color: '#6b7280'}}>ID: {req.id.slice(0, 8)}...</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td>
                                            <span style={{fontSize: '13px', color: '#4b5563'}}>
                                                {req.creator_id === user?.id ? 'Tôi' : (req.creator_email || 'Người khác')}
                                            </span>
                                        </td>
                                        <td>
                                            <div className="progress-wrapper">
                                                <div className="progress-text"><span>{signedCount}/{totalSigners}</span> <span>{Math.round(progress)}%</span></div>
                                                <div className="progress-bar-bg"><div className="progress-bar-fill" style={{width: `${progress}%`, backgroundColor: progress === 100 ? '#10b981' : '#f59e0b'}}></div></div>
                                            </div>
                                        </td>
                                        <td>
                                            {req.status === 'pending' && <span className="status-badge status-pending">Đang xử lý</span>}
                                            {req.status === 'signed' && <span className="status-badge status-success">Hoàn thành</span>}
                                            {req.status === 'cancelled' && <span className="status-badge status-error">Đã hủy</span>}
                                        </td>
                                        <td>
                                            {req.expires_at ? new Date(req.expires_at).toLocaleDateString('vi-VN') : 'Không thời hạn'}
                                        </td>
                                        <td>
                                            {activeTab === 'pending' ? (
                                                <button 
                                                    className="btn-sm" 
                                                    style={{background: 'var(--accent)', color: 'white', border: 'none'}}
                                                    onClick={() => handleSignClick(req.id)}
                                                >
                                                    Ký ngay
                                                </button>
                                            ) : (
                                                <button 
                                                    className="btn-sm" 
                                                    style={{background: '#f3f4f6', color: '#374151', border: '1px solid #d1d5db'}}
                                                    onClick={() => handleSignClick(req.id)}
                                                >
                                                    Xem chi tiết
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </div>

            {showInsertModal && (
                <InsertSignatureModal 
                    isOpen={showInsertModal}
                    onClose={() => setShowInsertModal(false)}
                    onSuccess={handleSignatureSuccess}
                />
            )}
        </div>
    );
};

export default ESignature;
