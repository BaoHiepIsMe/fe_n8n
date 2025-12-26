

import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext'; // Cần auth để lấy userId
import '../styles/dashboard.css';

// URL API của bạn (Backend 1 hoặc Backend 2 tùy cấu hình proxy)
// const API_URL = import.meta.env.VITE_API_URL || 'https://api.docsops.me/api/v1';
const API_URL = import.meta.env.VITE_API_URL2 || 'https://api.docsops.me/api/v2';

const Storage = () => {
    const { user } = useAuth(); // Lấy userId từ context
    const [stats, setStats] = useState(null); // State cho thống kê (code cũ)
    
    // --- STATE MỚI CHO TÍNH NĂNG CHECK CŨ/MỚI ---
    const [checkResult, setCheckResult] = useState(null);
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef(null);

    // --- HÀM XỬ LÝ UPLOAD ĐỂ CHECK ---
    const handleFileCheck = async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        if (!user || !user.id) {
            alert("Vui lòng đăng nhập để thực hiện chức năng này.");
            return;
        }

        setUploading(true);
        setCheckResult(null); // Reset kết quả cũ

        const formData = new FormData();
        formData.append('file', file);
        formData.append('userId', user.id); // Backend yêu cầu userId trong body

        try {
            // Gọi API uploadDocument của Backend
            const response = await axios.post(`${API_URL}/documents/upload`, formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                    // Thêm Authorization header nếu Backend yêu cầu token
                    // 'Authorization': `Bearer ${token}` 
                }
            });

            if (response.data.success) {
                // Lưu kết quả trả về từ Backend (dbData)
                setCheckResult(response.data.data);
            }
        } catch (error) {
            console.error("Lỗi kiểm tra file:" + API_URL, error);
            alert("Có lỗi xảy ra khi phân tích file.");
        } finally {
            setUploading(false);
            // Reset input để có thể chọn lại file đó lần nữa nếu muốn
            if(fileInputRef.current) fileInputRef.current.value = "";
        }
    };

    // Hàm gọi API lấy thống kê Storage (Code cũ - giữ nguyên logic hiển thị)
    useEffect(() => {
        // Giả lập dữ liệu stats nếu chưa có API thực
        setStats({
            totalUsedGB: 124.5,
            totalCapacityGB: 500,
            percentUsed: 24.9,
            breakdown: { docsPercent: 45, mediaPercent: 25, backupPercent: 15 }
        });
    }, []);

    // Format ngày hiển thị
    const formatDate = (dateString) => {
        if (!dateString) return 'Không xác định';
        return new Date(dateString).toLocaleDateString('vi-VN', {
            day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute:'2-digit'
        });
    };

    return (
        <div className="dashboard-body">
            <div className="page-title">
                <h2>PHÂN LOẠI FILE CŨ HAY MỚI</h2>
                <p>Hệ thống tự động phát hiện ngày tạo gốc (Metadata) để phân loại lưu trữ.</p>
            </div>

            {/* --- PHẦN MỚI: AI CLASSIFIER SECTION --- */}
            <div className="ai-alert-box" style={{ 
                backgroundColor: '#fff', 
                border: '1px solid #e2e8f0',
                padding: '25px', 
                borderRadius: '12px',
                marginBottom: '30px',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
            }}>
                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'start'}}>
                    <div>
                        <h3 style={{color: '#1e293b', marginTop: 0, marginBottom: '10px'}}>
                            <i className="fas fa-robot" style={{color: '#8b5cf6', marginRight: '10px'}}></i>
                            AI Kiểm tra Vòng đời Tài liệu
                        </h3>
                        <p style={{color: '#64748b', marginBottom: '20px', maxWidth: '600px'}}>
                            Tải file lên để hệ thống trích xuất <strong>Ngày tạo gốc (Creation Date)</strong> từ Metadata.
                            <br/>
                            • Nếu &gt; 2 năm: Đánh dấu là <strong>Cũ (Archived)</strong> và chuyển kho lạnh.
                            <br/>
                            • Nếu &le; 2 năm: Đánh dấu là <strong>Mới (Uploaded)</strong>.
                        </p>
                        
                        <input 
                            type="file" 
                            ref={fileInputRef}
                            style={{display: 'none'}} 
                            onChange={handleFileCheck}
                        />
                        
                        <button 
                            className="btn-sm" 
                            onClick={() => fileInputRef.current.click()}
                            disabled={uploading}
                            style={{
                                background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)', 
                                color: 'white', 
                                border: 'none', 
                                padding: '12px 24px', 
                                fontSize: '15px',
                                cursor: uploading ? 'wait' : 'pointer',
                                opacity: uploading ? 0.7 : 1
                            }}
                        >
                            {uploading ? (
                                <span><i className="fas fa-spinner fa-spin"></i> Đang phân tích...</span>
                            ) : (
                                <span><i className="fas fa-upload"></i> Tải file lên để kiểm tra</span>
                            )}
                        </button>
                    </div>

                    {/* HIỂN THỊ KẾT QUẢ CHECK */}
                    {checkResult && (
                        <div style={{
                            flex: 1, 
                            marginLeft: '40px', 
                            padding: '20px', 
                            backgroundColor: checkResult.status === 'archived' ? '#fff1f2' : '#f0fdf4', // Đỏ nhạt hoặc Xanh nhạt
                            border: `1px solid ${checkResult.status === 'archived' ? '#fda4af' : '#86efac'}`,
                            borderRadius: '8px'
                        }}>
                            <h4 style={{marginTop: 0, color: checkResult.status === 'archived' ? '#9f1239' : '#166534'}}>
                                {checkResult.status === 'archived' 
                                    ? <><i className="fas fa-archive"></i> TÀI LIỆU CŨ (TRÊN 2 NĂM)</> 
                                    : <><i className="fas fa-check-circle"></i> TÀI LIỆU MỚI</>
                                }
                            </h4>
                            
                            <ul style={{listStyle: 'none', padding: 0, margin: '10px 0', fontSize: '14px', color: '#334155'}}>
                                <li style={{marginBottom: '8px'}}>
                                    <strong>Tên file:</strong> {checkResult.title}
                                </li>
                                <li style={{marginBottom: '8px'}}>
                                    <strong>Ngày gốc tìm thấy:</strong> {formatDate(checkResult.document_date)}
                                </li>
                                <li style={{marginBottom: '8px'}}>
                                    <strong>Trạng thái lưu:</strong> <span className="tag-badge">{checkResult.status}</span>
                                </li>
                                <li style={{paddingTop: '10px', borderTop: '1px dashed #cbd5e1'}}>
                                    <strong>AI Phân tích:</strong> <br/>
                                    <span style={{fontStyle: 'italic', color: '#475569'}}>
                                        "{checkResult.ai_analysis_result}"
                                    </span>
                                </li>
                            </ul>
                        </div>
                    )}
                </div>
            </div>

            {/* --- PHẦN STATS CŨ (GIỮ NGUYÊN) --- */}
            

            <h3 style={{marginBottom: '20px', fontSize: '18px', marginTop: '30px'}}>Quy tắc Vòng đời đang áp dụng</h3>
            <div className="policy-grid">
                <div className="policy-card policy-active">
                    <div className="policy-header">
                        <div className="policy-title"><i className="fas fa-history" style={{color: 'var(--success)', marginRight: '8px'}}></i> Lưu trữ dài hạn</div>
                        <div className="switch-toggle switch-active"></div>
                    </div>
                    <p className="policy-desc">Tự động chuyển các tài liệu có ngày tạo gốc (Metadata) cũ hơn <strong>2 năm</strong> vào kho lạnh (Archived).</p>
                    <div style={{fontSize: '12px', color: 'var(--text-light)'}}>
                        <i className="fas fa-robot"></i> Đang hoạt động thông qua n8n Agent.
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Storage;