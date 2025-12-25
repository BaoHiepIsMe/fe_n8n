import React, { useState, useEffect } from 'react';
import '../styles/dashboard.css';
import { departmentConfigAPI } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';

// Danh sách 7 phòng ban mặc định với category_key và department_name cố định
const DEFAULT_DEPARTMENTS = [
    { category_key: 'Finance & Tax', department_name: 'Phòng Tài chính - Kế toán' },
    { category_key: 'Legal & Contracts', department_name: 'Phòng Pháp chế' },
    { category_key: 'HR & Admin', department_name: 'Phòng Hành chính - Nhân sự' },
    { category_key: 'Sales & CRM', department_name: 'Phòng Kinh doanh' },
    { category_key: 'Projects & Tech', department_name: 'Phòng Kỹ thuật & Dự án' },
    { category_key: 'Marketing', department_name: 'Phòng Marketing' },
    { category_key: 'Other', department_name: 'Bộ phận Quản lý chung' },
];

const Settings = () => {
    const { user } = useAuth();
    const [autoClassification, setAutoClassification] = useState(true);
    const [departments, setDepartments] = useState([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState(null);

    // Load department configs
    useEffect(() => {
        if (user) {
            loadDepartments();
        }
    }, [user]);

    const loadDepartments = async () => {
        if (!user) return;
        
        setLoading(true);
        try {
            const result = await departmentConfigAPI.getDepartmentConfigs();
            console.log('Department configs API result:', result);
            
            // Handle different response structures - lấy danh sách từ database
            const existingDepts = result.data?.departments || result.data?.data?.departments || result.departments || [];
            console.log('Existing departments from DB:', existingDepts);
            
            // Merge với default departments - LUÔN hiển thị đủ 7 phòng ban
            const mergedDepts = DEFAULT_DEPARTMENTS.map(defaultDept => {
                const existing = existingDepts.find(
                    d => d.category_key === defaultDept.category_key
                );
                return {
                    id: existing?.id || null,
                    category_key: defaultDept.category_key,
                    department_name: defaultDept.department_name,
                    notification_email: existing?.notification_email || '',
                };
            });

            console.log('Merged departments (always showing all 7):', mergedDepts);
            setDepartments(mergedDepts);
        } catch (error) {
            console.error('Error loading departments:', error);
            // Nếu lỗi, vẫn hiển thị default với email trống
            setDepartments(DEFAULT_DEPARTMENTS.map(d => ({
                ...d,
                id: null,
                notification_email: '',
            })));
        } finally {
            setLoading(false);
        }
    };

    const handleEmailChange = (index, email) => {
        const updated = [...departments];
        updated[index].notification_email = email;
        setDepartments(updated);
    };

    const handleSave = async () => {
        if (!user) {
            alert('Vui lòng đăng nhập');
            return;
        }

        setSaving(true);
        setMessage(null);

        try {
            // Chuẩn bị data để gửi - gửi tất cả 7 phòng ban
            const dataToSave = departments.map(dept => ({
                id: dept.id,
                category_key: dept.category_key,
                department_name: dept.department_name,
                notification_email: dept.notification_email || null,
            }));

            const result = await departmentConfigAPI.updateDepartmentConfigs(dataToSave);
            
            setMessage({
                type: 'success',
                text: result.message || 'Đã lưu cấu hình email phòng ban thành công',
            });

            // Reload để lấy dữ liệu mới từ database
            setTimeout(async () => {
                await loadDepartments();
            }, 500);

            // Clear message after 3 seconds
            setTimeout(() => setMessage(null), 3000);
        } catch (error) {
            console.error('Error saving departments:', error);
            setMessage({
                type: 'error',
                text: error.message || 'Có lỗi xảy ra khi lưu cấu hình',
            });
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="dashboard-body">
            <div className="page-title">
                <h2>Cài đặt hệ thống</h2>
                <p>Quản lý cấu hình AI và thông tin phòng ban.</p>
            </div>

            {/* Message */}
            {message && (
                <div
                    style={{
                        padding: '15px 20px',
                        borderRadius: '8px',
                        marginBottom: '24px',
                        backgroundColor: message.type === 'success' ? '#f0fdf4' : '#fef2f2',
                        border: `1px solid ${message.type === 'success' ? '#86efac' : '#fca5a5'}`,
                        color: message.type === 'success' ? '#166534' : '#991b1b',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                    }}
                >
                    <i className={`fas ${message.type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}`}></i>
                    <span>{message.text}</span>
                </div>
            )}

            {/* Department Email Config */}
            <div className="settings-card" style={{ marginBottom: '30px' }}>
                <div className="settings-header">
                    <h3><i className="fas fa-building" style={{color: 'var(--accent)'}}></i> Cấu hình Email Phòng Ban</h3>
                    <button 
                        className="btn-sm" 
                        style={{background: 'var(--accent)', color: 'white', border: 'none'}}
                        onClick={handleSave}
                        disabled={saving || loading}
                    >
                        {saving ? (
                            <>
                                <i className="fas fa-spinner fa-spin"></i> Đang lưu...
                            </>
                        ) : (
                            <>
                                <i className="fas fa-save"></i> Lưu
                            </>
                        )}
                    </button>
                </div>

                <p style={{ marginBottom: '20px', color: 'var(--text-light)', fontSize: '14px' }}>
                    Nhập email thông báo cho từng phòng ban. Email này sẽ nhận thông báo khi có tài liệu được phân loại vào phòng ban tương ứng.
                </p>

                {loading ? (
                    <div style={{ textAlign: 'center', padding: '40px' }}>
                        <i className="fas fa-spinner fa-spin" style={{ fontSize: '24px', color: 'var(--accent)' }}></i>
                        <p style={{ marginTop: '10px', color: 'var(--text-light)' }}>Đang tải...</p>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                        {departments.map((dept, index) => (
                            <div
                                key={index}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '15px',
                                    padding: '15px',
                                    backgroundColor: '#f8fafc',
                                    borderRadius: '8px',
                                    border: '1px solid #e2e8f0',
                                }}
                            >
                                <div style={{ flex: '0 0 250px' }}>
                                    <div style={{ fontWeight: '600', fontSize: '14px', marginBottom: '4px' }}>
                                        {dept.department_name}
                                    </div>
                                    <div style={{ fontSize: '12px', color: 'var(--text-light)' }}>
                                        {dept.category_key}
                                    </div>
                                </div>
                                <div style={{ flex: 1 }}>
                                    <input
                                        type="email"
                                        placeholder="Nhập email thông báo (để trống nếu không cần)"
                                        value={dept.notification_email || ''}
                                        onChange={(e) => handleEmailChange(index, e.target.value)}
                                        style={{
                                            width: '100%',
                                            padding: '10px 15px',
                                            border: '1px solid #cbd5e1',
                                            borderRadius: '6px',
                                            fontSize: '14px',
                                            outline: 'none',
                                            transition: 'border-color 0.2s',
                                        }}
                                        onFocus={(e) => {
                                            e.target.style.borderColor = 'var(--accent)';
                                        }}
                                        onBlur={(e) => {
                                            e.target.style.borderColor = '#cbd5e1';
                                        }}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* AI Settings */}
            <div className="settings-card">
                <div className="settings-header">
                    <h3><i className="fas fa-robot" style={{color: 'var(--accent)'}}></i> Cấu hình AI Agents</h3>
                    <button className="btn-sm" style={{background: 'white', border: '1px solid #e2e8f0', color: '#64748b'}}>
                        <i className="fas fa-sync-alt"></i> Reset
                    </button>
                </div>

                <div className="setting-row">
                    <div className="setting-info">
                        <span className="setting-title">Auto-Classification (Tự động phân loại)</span>
                        <span className="setting-desc">Cho phép AI tự động đọc nội dung file tải lên và di chuyển vào thư mục.</span>
                    </div>
                    <div className="setting-action">
                        <div className={`toggle-switch ${autoClassification ? 'active' : ''}`} onClick={() => setAutoClassification(!autoClassification)}></div>
                    </div>
                </div>

                <div className="setting-row">
                    <div className="setting-info">
                        <span className="setting-title">Ngôn ngữ OCR ưu tiên</span>
                        <span className="setting-desc">Chọn ngôn ngữ chính để AI nhận diện văn bản chính xác hơn.</span>
                    </div>
                    <div className="setting-action">
                        <select className="custom-select">
                            <option value="vi">Tiếng Việt</option>
                            <option value="en">English</option>
                            <option value="auto">Tự động (Auto)</option>
                        </select>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Settings;
