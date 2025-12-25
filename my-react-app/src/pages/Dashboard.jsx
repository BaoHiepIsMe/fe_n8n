import React, { useState, useRef, useCallback } from 'react';
import '../styles/dashboard.css';
import { documentAPI } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { useDocuments } from '../contexts/DocumentContext';

const Dashboard = () => {
    const { user } = useAuth();
    const { documents, stats, loadingDocuments, loadingStats, refreshDocuments, refreshStats, refreshFolderStats } = useDocuments();
    const [isDragging, setIsDragging] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadResult, setUploadResult] = useState(null);
    const fileInputRef = useRef(null);
    const dragCounterRef = useRef(0);

    // Xử lý upload file
    const handleFile = useCallback(async (file) => {
        if (!file) {
            return;
        }

        if (!user || !user.id) {
            alert('Vui lòng đăng nhập để upload file');
            return;
        }

        setIsUploading(true); // Hiển thị loading state (nhưng không chặn UI)
        setUploadResult({
            success: true,
            processing: true,
            message: 'Đang xử lý',
            fileName: file.name,
        });

        try {
            // Gửi file lên n8n và đợi response (như code HTML của bạn)
            const result = await documentAPI.uploadToN8n(file, user.id);
            
            // Khi có response, cập nhật kết quả
            setUploadResult({
                success: true,
                processing: false,
                message: result.message || 'Đã xử lý xong',
                data: result.data,
            });
            
            // Reset file input
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }

            // Reload documents, stats và folder stats để hiển thị dữ liệu mới
            await Promise.all([
                refreshDocuments(),
                refreshStats(),
                refreshFolderStats(),
            ]);
        } catch (error) {
            console.error('Upload error:', error);
            setUploadResult({
                success: false,
                processing: false,
                message: error.message || 'Có lỗi xảy ra khi upload file',
            });
        } finally {
            setIsUploading(false);
        }
    }, [user, refreshDocuments, refreshStats, refreshFolderStats]);

    // Xử lý khi chọn file từ input
    const handleFileSelect = useCallback((e) => {
        const file = e.target.files?.[0];
        if (file) {
            handleFile(file);
        }
    }, [handleFile]);

    // Xử lý drag events
    const handleDragEnter = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();
        dragCounterRef.current++;
        if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
            setIsDragging(true);
        }
    }, []);

    const handleDragLeave = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();
        dragCounterRef.current--;
        if (dragCounterRef.current === 0) {
            setIsDragging(false);
        }
    }, []);

    const handleDragOver = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();
    }, []);

    const handleDrop = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        dragCounterRef.current = 0;

        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            const file = e.dataTransfer.files[0];
            handleFile(file);
        }
    }, [handleFile]);

    // Xử lý click vào button Upload
    const handleUploadClick = useCallback(() => {
        if (fileInputRef.current) {
            fileInputRef.current.click();
        }
    }, []);


    // Helper: Lấy icon file từ mime_type
    const getFileIcon = (mimeType) => {
        if (!mimeType) return 'fa-file';
        const type = mimeType.toLowerCase();
        if (type.includes('pdf')) return 'fa-file-pdf';
        if (type.includes('word') || type.includes('docx') || type.includes('doc')) return 'fa-file-word';
        if (type.includes('excel') || type.includes('xlsx') || type.includes('xls')) return 'fa-file-excel';
        if (type.includes('image')) return 'fa-image';
        if (type.includes('text')) return 'fa-file-alt';
        return 'fa-file';
    };

    // Helper: Lấy màu icon từ mime_type
    const getFileIconColor = (mimeType) => {
        if (!mimeType) return '#94a3b8';
        const type = mimeType.toLowerCase();
        if (type.includes('pdf')) return '#ef4444';
        if (type.includes('word') || type.includes('docx') || type.includes('doc')) return '#3b82f6';
        if (type.includes('excel') || type.includes('xlsx') || type.includes('xls')) return '#10b981';
        if (type.includes('image')) return '#8b5cf6';
        return '#94a3b8';
    };

    // Helper: Parse storage_path để lấy phân loại AI (phần trước dấu gạch)
    const getAICategory = (storagePath) => {
        if (!storagePath) return [];
        // Lấy phần đầu tiên trước dấu gạch đầu tiên hoặc dấu /
        const parts = storagePath.split(/[-/]/);
        if (parts.length > 0 && parts[0]) {
            return [parts[0]];
        }
        return [];
    };

    // Helper: Format sensitivity_level thành badge
    const getSensitivityBadge = (level) => {
        const levelUpper = (level || '').toUpperCase();
        switch (levelUpper) {
            case 'PUBLIC':
                return { text: 'Công khai', className: 'safe' };
            case 'INTERNAL':
                return { text: 'Nội bộ', className: 'safe' };
            case 'CONFIDENTIAL':
                return { text: 'Bảo mật', className: 'risk' };
            case 'RESTRICTED':
                return { text: 'Hạn chế', className: 'pending' };
            default:
                return { text: 'Chưa phân loại', className: 'pending' };
        }
    };

    // Helper: Format status hiển thị
    const getDisplayStatus = (doc) => {
        // Nếu status = 'deleted' thì không hiển thị (đã filter ở trên)
        if (doc.status === 'deleted') {
            return null;
        }

        // Nếu status = 'signed' → "Đã ký"
        if (doc.status === 'signed') {
            return { text: 'Đã ký', className: 'safe' };
        }

        // Nếu status = 'uploaded' → hiển thị "Đang xử lý" (giữ nguyên processing)
        if (doc.status === 'uploaded') {
            const processing = (doc.processing || '').toLowerCase();
            if (processing === 'done') {
                return { text: 'Đã xử lý', className: 'safe' };
            }
            return { text: 'Đang xử lý', className: 'pending' };
        }

        // Các status khác (chưa ký) → "Chưa ký"
        return { text: 'Chưa ký', className: 'pending' };
    };

    // Helper: Format thời gian
    const formatTime = (dateString) => {
        if (!dateString) return '';
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'Vừa xong';
        if (diffMins < 60) return `${diffMins} phút trước`;
        if (diffHours < 24) return `${diffHours} giờ trước`;
        if (diffDays < 7) return `${diffDays} ngày trước`;
        return date.toLocaleDateString('vi-VN');
    };

    // Helper: Mở file khi click
    const handleDocumentClick = (storagePath) => {
        if (storagePath) {
            const url = `https://rtdqjujwbaotbvuioawp.supabase.co/storage/v1/object/public/${storagePath}`;
            window.open(url, '_blank');
        }
    };

    return (
        <div className="dashboard-body">
                <div className="page-title">
                    <h2>Xin chào, Admin! 👋</h2>
                    <p>Đây là những gì đang diễn ra với hệ thống tài liệu của bạn hôm nay.</p>
                </div>

                <div className="stats-grid">
                    <div className="card">
                        <div className="card-icon icon-blue"><i className="fas fa-file-alt"></i></div>
                        <h3>Tài liệu mới (Tuần này)</h3>
                        <div className="number">{loadingStats ? '...' : stats.newDocumentsThisWeek.toLocaleString()}</div>
                        <span className="trend up"><i className="fas fa-calendar-week"></i> Trong 7 ngày qua</span>
                    </div>

                    <div className="card">
                        <div className="card-icon icon-orange"><i className="fas fa-file-signature"></i></div>
                        <h3>Đang chờ ký duyệt</h3>
                        <div className="number">{loadingStats ? '...' : stats.pendingApproval}</div>
                        <span className="trend" style={{color: '#f59e0b'}}>Cần xử lý ngay</span>
                    </div>

                    <div className="card">
                        <div className="card-icon icon-red"><i className="fas fa-user-shield"></i></div>
                        <h3>Tài liệu có rủi ro</h3>
                        <div className="number">{loadingStats ? '...' : stats.riskDocuments}</div>
                        <span className="trend down">CONFIDENTIAL / RESTRICTED</span>
                    </div>

                    <div className="card">
                        <div className="card-icon icon-green"><i className="fas fa-clock"></i></div>
                        <h3>Tài liệu chưa xử lý</h3>
                        <div className="number">{loadingStats ? '...' : stats.unprocessedDocuments}</div>
                        <span className="trend">Tổng số chưa xong</span>
                    </div>
                </div>

                {/* File Input - Hidden */}
                <input
                    ref={fileInputRef}
                    id="file-upload-input-dashboard"
                    type="file"
                    onChange={handleFileSelect}
                    style={{ display: 'none' }}
                    accept="*/*"
                />

                <div className="table-section">
                    <div className="section-header">
                        <h3><i className="fas fa-clock" style={{color: '#94a3b8', marginRight: '8px'}}></i> Hoạt động gần đây</h3>
                        <button 
                            className="btn-sm" 
                            style={{background: 'var(--accent)', color: 'white', border: 'none', cursor: 'pointer'}}
                            onClick={handleUploadClick}
                            disabled={isUploading}
                        >
                            <i className="fas fa-upload"></i> Upload File
                        </button>
                    </div>

                    <div className="table-wrapper">
                        <table>
                        <thead>
                            <tr>
                                <th>Tên tài liệu</th>
                                <th>Phân loại AI (Auto-Tag)</th>
                                <th>Trạng thái</th>
                                <th>Trạng thái Audit</th>
                                <th>Thời gian</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loadingDocuments ? (
                                <tr>
                                    <td colSpan="5" style={{textAlign: 'center', padding: '20px'}}>
                                        <i className="fas fa-spinner fa-spin" style={{marginRight: '8px'}}></i>
                                        Đang tải...
                                    </td>
                                </tr>
                            ) : documents.filter(doc => doc.status !== 'deleted').length === 0 ? (
                                <tr>
                                    <td colSpan="5" style={{textAlign: 'center', padding: '20px', color: 'var(--text-light)'}}>
                                        Chưa có tài liệu nào
                                    </td>
                                </tr>
                            ) : (
                                documents
                                    .filter(doc => doc.status !== 'deleted')
                                    .slice(0, 5) // Chỉ hiển thị 5 tài liệu gần nhất
                                    .map((doc) => {
                                        const iconName = getFileIcon(doc.mime_type);
                                        const iconColor = getFileIconColor(doc.mime_type);
                                        const aiCategories = getAICategory(doc.storage_path);
                                        const sensitivityBadge = getSensitivityBadge(doc.sensitivity_level);
                                        const displayStatus = getDisplayStatus(doc);

                                        if (!displayStatus) return null;

                                        return (
                                            <tr 
                                                key={doc.id}
                                                style={{cursor: 'pointer'}}
                                                onClick={() => handleDocumentClick(doc.storage_path)}
                                                onMouseEnter={(e) => {
                                                    e.currentTarget.style.backgroundColor = '#f8fafc';
                                                }}
                                                onMouseLeave={(e) => {
                                                    e.currentTarget.style.backgroundColor = 'transparent';
                                                }}
                                            >
                                                <td>
                                                    <div style={{display: 'flex', alignItems: 'center', gap: '10px'}}>
                                                        <i className={`fas ${iconName}`} style={{color: iconColor, fontSize: '20px'}}></i>
                                                        <span style={{fontWeight: 500}}>{doc.title || 'Không có tên'}</span>
                                                    </div>
                                                </td>
                                                <td>
                                                    {aiCategories.length > 0 ? (
                                                        aiCategories.map((cat, idx) => (
                                                            <span key={idx} className="tag-badge">{cat}</span>
                                                        ))
                                                    ) : (
                                                        <span style={{color: 'var(--text-light)'}}>Chưa phân loại</span>
                                                    )}
                                                </td>
                                                <td>
                                                    <span className={`status-badge ${displayStatus.className}`}>
                                                        {displayStatus.text}
                                                    </span>
                                                </td>
                                                <td>
                                                    <span className={`status-badge ${sensitivityBadge.className}`}>
                                                        {sensitivityBadge.text}
                                                    </span>
                                                </td>
                                                <td>{formatTime(doc.update_at || doc.created_at)}</td>
                                            </tr>
                                        );
                                    })
                            )}
                        </tbody>
                    </table>
                    </div>
                </div>

                {/* Upload Result Modal */}
                {uploadResult && (
                    <div style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        backgroundColor: 'rgba(0, 0, 0, 0.5)',
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        zIndex: 1000,
                    }}>
                        <div style={{
                            backgroundColor: 'white',
                            padding: '30px',
                            borderRadius: '12px',
                            boxShadow: '0 10px 25px rgba(0, 0, 0, 0.1)',
                            maxWidth: '500px',
                            width: '90%',
                            textAlign: 'center',
                            position: 'relative',
                        }}>
                            <button
                                onClick={() => setUploadResult(null)}
                                style={{
                                    position: 'absolute',
                                    top: '15px',
                                    right: '15px',
                                    background: 'none',
                                    border: 'none',
                                    fontSize: '20px',
                                    color: 'var(--text-light)',
                                    cursor: 'pointer',
                                }}
                            >
                                <i className="fas fa-times"></i>
                            </button>
                            
                            {uploadResult.processing ? (
                                <>
                                    <div style={{
                                        fontSize: '64px',
                                        color: '#3b82f6',
                                        marginBottom: '20px',
                                    }}>
                                        <i className="fas fa-spinner fa-spin"></i>
                                    </div>
                                    <h3 style={{
                                        marginBottom: '15px',
                                        color: '#3b82f6',
                                        fontSize: '20px',
                                    }}>
                                        Đang xử lý
                                    </h3>
                                    <p style={{
                                        fontSize: '16px',
                                        color: 'var(--text)',
                                        marginBottom: '10px',
                                        lineHeight: '1.6',
                                    }}>
                                        File <strong>{uploadResult.fileName}</strong> đã được gửi và đang được xử lý. Bạn có thể tiếp tục sử dụng hệ thống.
                                    </p>
                                    <p style={{
                                        fontSize: '14px',
                                        color: 'var(--text-light)',
                                        marginBottom: '20px',
                                        fontStyle: 'italic',
                                    }}>
                                        Thông báo sẽ hiển thị khi quá trình xử lý hoàn tất.
                                    </p>
                                </>
                            ) : uploadResult.success && uploadResult.data ? (
                                <>
                                    <div style={{
                                        fontSize: '64px',
                                        color: 'var(--success)',
                                        marginBottom: '20px',
                                    }}>
                                        <i className="fas fa-check-circle"></i>
                                    </div>
                                    <h3 style={{
                                        marginBottom: '15px',
                                        color: 'var(--success)',
                                        fontSize: '20px',
                                    }}>
                                        Thành công
                                    </h3>
                                    <p style={{
                                        fontSize: '16px',
                                        color: 'var(--text)',
                                        marginBottom: '10px',
                                        lineHeight: '1.6',
                                    }}>
                                        Đã xử lý xong <strong>{uploadResult.data.ten_file}</strong> và gửi file đến <strong>{uploadResult.data.phong_ban}</strong>
                                    </p>
                                    {uploadResult.data.link_truy_cap && (
                                        <div style={{
                                            marginBottom: '20px',
                                            marginTop: '15px',
                                        }}>
                                            <a 
                                                href={uploadResult.data.link_truy_cap} 
                                                target="_blank" 
                                                rel="noopener noreferrer"
                                                style={{
                                                    textDecoration: 'none',
                                                    display: 'inline-block',
                                                }}
                                            >
                                                <button
                                                    style={{
                                                        background: '#28a745',
                                                        color: 'white',
                                                        border: 'none',
                                                        padding: '12px 24px',
                                                        borderRadius: '8px',
                                                        fontSize: '16px',
                                                        fontWeight: '600',
                                                        cursor: 'pointer',
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: '8px',
                                                        transition: 'background 0.2s ease',
                                                    }}
                                                    onMouseEnter={(e) => {
                                                        e.currentTarget.style.background = '#218838';
                                                    }}
                                                    onMouseLeave={(e) => {
                                                        e.currentTarget.style.background = '#28a745';
                                                    }}
                                                >
                                                    <i className="fas fa-folder-open"></i>
                                                    Xem File Online
                                                </button>
                                            </a>
                                        </div>
                                    )}
                                </>
                            ) : (
                                <>
                                    <div style={{
                                        fontSize: '64px',
                                        color: 'var(--danger)',
                                        marginBottom: '20px',
                                    }}>
                                        <i className="fas fa-exclamation-circle"></i>
                                    </div>
                                    <h3 style={{
                                        marginBottom: '10px',
                                        color: 'var(--danger)',
                                        fontSize: '20px',
                                    }}>
                                        {uploadResult.message || 'Có lỗi xảy ra'}
                                    </h3>
                                </>
                            )}
                            
                            <button
                                onClick={() => setUploadResult(null)}
                                style={{
                                    background: 'var(--accent)',
                                    color: 'white',
                                    border: 'none',
                                    padding: '10px 20px',
                                    borderRadius: '8px',
                                    fontSize: '14px',
                                    fontWeight: '600',
                                    cursor: 'pointer',
                                    marginTop: '20px',
                                }}
                            >
                                Đóng
                            </button>
                        </div>
                    </div>
                )}
            </div>
    );
};

export default Dashboard;



