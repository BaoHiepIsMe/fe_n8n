



import React, { useState, useEffect } from 'react';
import axios from 'axios';
import moment from 'moment';
import '../styles/dashboard.css';

const Audit = () => {
    // --- STATE ---
    const [aiResult, setAiResult] = useState(null); 
    const [logs, setLogs] = useState([]);           
    const [stats, setStats] = useState({
        complianceScore: 100, totalEvents: 0, riskWarnings: 0, activeUsers: 0
    });
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState(false); // State loading khi bấm nút Block

    // --- CONFIG API URL (Dùng import.meta.env cho Vite) ---
    const API_URL = import.meta.env.VITE_API_URL2 || 'https://api.docsops.me/api/v2';

    // --- FETCH DATA ---
    const fetchData = async () => {
        try {
            setLoading(true);

            // 1. Lấy kết quả AI
            const aiResponse = await axios.get(`${API_URL}/audit/latest-result`);
            if (aiResponse.data.success) {
                setAiResult(aiResponse.data.data); 
            }

            // 2. Lấy Logs
            const logsResponse = await axios.get(`${API_URL}/audit`);
            if (logsResponse.data.success) {
                const { logs, stats } = logsResponse.data.data;
                setLogs(logs);
                setStats(prev => ({
                    ...prev,
                    totalEvents: stats.totalEvents,
                    activeUsers: stats.activeUsers,
                    riskWarnings: aiResponse.data.data?.anomalies?.length || stats.riskWarnings
                }));
            }
        } catch (error) {
            console.error("Lỗi tải dữ liệu:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 30000);
        return () => clearInterval(interval);
    }, []);

    // --- HÀM KHÓA TÀI KHOẢN (ACTION) ---
    const handleBlockUser = async () => {
        // Kiểm tra danh sách
        if (!aiResult || !aiResult.anomalies || aiResult.anomalies.length === 0) {
            alert("✅ Không có cảnh báo rủi ro nào cần xử lý.");
            return;
        }

        // Hỏi xác nhận
        const confirm = window.confirm("⚠️ CẢNH BÁO: Bạn có chắc chắn muốn KHÓA VĨNH VIỄN các tài khoản đang bị AI cảnh báo không?");
        if (!confirm) return;

        setProcessing(true);

        try {
            // Duyệt qua từng user bị AI cảnh báo để khóa
            for (const item of aiResult.anomalies) {
                const emailToBlock = item.user; // Lấy email từ AI (VD: duongdinh304@gmail.com)
                
                console.log(`🔄 Đang gọi API khóa user: ${emailToBlock}...`);

                // Gọi API Backend (status: 1 là Block)
                await axios.post(`${API_URL}/admin/block-user`, {
                    email: emailToBlock,
                    status: 1 
                });
            }

            alert("✅ Đã khóa tài khoản thành công!");
            
            // Tải lại dữ liệu để cập nhật trạng thái mới nhất (nếu có logic hiển thị status)
            fetchData();

        } catch (error) {
            console.error("❌ Lỗi Block User:", error);
            const msg = error.response?.data?.message || error.message;
            alert(`❌ Không thể khóa tài khoản. Lỗi: ${msg}`);
        } finally {
            setProcessing(false);
        }
    };

    // --- HELPER: Màu sắc ---
    const getRiskColor = (level) => {
        if (!level) return 'var(--primary)';
        const l = level.toLowerCase();
        if (l.includes('critical')) return '#991b1b';
        if (l.includes('high')) return '#ef4444';
        if (l.includes('medium')) return '#f59e0b';
        return '#10b981';
    };

    return (
        <div className="dashboard-body">
            <div className="page-title">
                <h2>Nhật ký Kiểm toán (Audit Logs)</h2>
                <p>Giám sát tuân thủ GDPR và phát hiện rủi ro bảo mật 24/7.</p>
            </div>

            {/* --- AI ALERT BOX --- */}
            {aiResult ? (
                <div className="ai-alert-box" style={{ 
                    borderLeft: `5px solid ${getRiskColor(aiResult.risk_level)}`,
                    backgroundColor: '#fff',
                    marginBottom: '24px', padding: '20px', display: 'flex', gap: '15px', borderRadius: '8px',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
                }}>
                    <i className="fas fa-robot" style={{ fontSize: '24px', color: getRiskColor(aiResult.risk_level), marginTop: '5px' }}></i>
                    
                    <div className="ai-alert-content" style={{width: '100%'}}>
                        <h4 style={{ margin: '0 0 10px 0', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '10px' }}>
                            Phát hiện hành vi bất thường
                            <span style={{ fontSize: '12px', backgroundColor: getRiskColor(aiResult.risk_level), color: 'white', padding: '2px 8px', borderRadius: '12px' }}>
                                {aiResult.risk_level}
                            </span>
                        </h4>
                        <p style={{ color: '#475569', marginBottom: '15px' }}>{aiResult.summary}</p>

                        {/* Danh sách Anomalies */}
                        {aiResult.anomalies && (
                            <div style={{ backgroundColor: '#f8fafc', padding: '15px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                                <strong style={{fontSize: '13px', color: '#334155'}}>⚠️ Chi tiết đối tượng:</strong>
                                <ul style={{ margin: '10px 0 0 20px', padding: 0, fontSize: '13px', color: '#475569' }}>
                                    {aiResult.anomalies.map((item, idx) => (
                                        <li key={idx} style={{ marginBottom: '8px' }}>User <b>{item.user}</b>: {item.issue}</li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {/* NÚT BẤM KHÓA TÀI KHOẢN */}
                        <div style={{marginTop: '15px'}}>
                            <button 
                                className="btn-sm" 
                                onClick={handleBlockUser}
                                disabled={processing}
                                style={{
                                    background: processing ? '#94a3b8' : '#991b1b', 
                                    color: 'white', border: 'none', padding: '8px 16px', borderRadius: '4px', cursor: processing ? 'wait' : 'pointer', marginRight: '10px'
                                }}
                            >
                                {processing ? (
                                    <span><i className="fas fa-spinner fa-spin"></i> Đang xử lý...</span>
                                ) : (
                                    <span><i className="fas fa-lock"></i> Khóa tài khoản rủi ro</span>
                                )}
                            </button>
                            
                            <button className="btn-sm" style={{background: 'white', border: '1px solid #cbd5e1', color: '#475569', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer'}}>
                                Bỏ qua
                            </button>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="ai-alert-box" style={{ padding: '20px', background: '#f1f5f9', borderRadius: '8px', textAlign: 'center', marginBottom: '24px' }}>
                     <p style={{color: '#64748b'}}><i className="fas fa-sync fa-spin"></i> Đang chờ kết quả phân tích từ AI...</p>
                </div>
            )}

            {/* --- STATS GRID --- */}
            <div className="stats-grid" style={{gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: '24px'}}>
                 <div className="card" style={{padding: '20px'}}>
                    <div style={{color: 'var(--text-light)', fontSize: '13px'}}>Điểm tuân thủ (GDPR)</div>
                    <div className="number" style={{color: 'var(--success)'}}>{stats.complianceScore}%</div>
                </div>
                <div className="card" style={{padding: '20px'}}>
                    <div style={{color: 'var(--text-light)', fontSize: '13px'}}>Tổng log đã xử lý</div>
                    <div className="number">{stats.totalEvents}</div>
                </div>
                <div className="card" style={{padding: '20px'}}>
                    <div style={{color: 'var(--text-light)', fontSize: '13px'}}>Cảnh báo Rủi ro</div>
                    <div className="number" style={{color: 'var(--danger)'}}>{stats.riskWarnings}</div>
                </div>
                <div className="card" style={{padding: '20px'}}>
                    <div style={{color: 'var(--text-light)', fontSize: '13px'}}>User đang hoạt động</div>
                    <div className="number">{stats.activeUsers}</div>
                </div>
            </div>

            {/* --- TABLE SECTION --- */}
            <div className="filter-bar">
                 <div className="filter-group">
                        <i className="fas fa-filter" style={{color: '#64748b'}}></i>
                        <span>Lọc theo:</span>
                    </div>
                    <button className="btn-sm" onClick={fetchData} style={{background: 'var(--primary)', color: 'white', border: 'none', marginLeft: 'auto'}}>
                        <i className="fas fa-sync"></i> Refresh
                    </button>
            </div>

            <div className="table-section">
                 <table>
                        <thead>
                            <tr>
                                <th>Thời gian</th>
                                <th>User (Email/ID)</th>
                                <th>Hành động</th>
                                <th>Tài nguyên</th>
                                <th>Kết quả</th>
                            </tr>
                        </thead>
                        <tbody>
                            {logs.length > 0 ? logs.map((log) => (
                                <tr key={log.id}>
                                    <td>
                                        {moment(log.created_at).format('HH:mm:ss')} <br />
                                        <span style={{ fontSize: '11px', color: '#94a3b8' }}>{moment(log.created_at).format('DD/MM/YYYY')}</span>
                                    </td>
                                    <td>
                                        <div className="user-cell">
                                            <b>{log.user_email || log.user_id?.slice(0, 8)}</b>
                                            {log.ip_address && <div className="user-ip">IP: {log.ip_address}</div>}
                                        </div>
                                    </td>
                                    <td><b>{log.action}</b></td>
                                    <td>{log.details?.filename || log.resource_type || 'N/A'}</td>
                                    <td>
                                        {log.action === 'mass_download' || log.action === 'delete' ? 
                                            <span className="badge-level level-critical">Critical</span> : 
                                            <span className="badge-level level-info">Info</span>
                                        }
                                    </td>
                                </tr>
                            )) : (
                                <tr><td colSpan="5" style={{textAlign:'center', padding:'20px'}}>Chưa có dữ liệu log.</td></tr>
                            )}
                        </tbody>
                    </table>
            </div>
        </div>
    );
};

export default Audit;