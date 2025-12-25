import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { departmentConfigAPI } from '../lib/api';
import '../styles/dashboard.css';

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

const DepartmentSetup = ({ onComplete, isModal = false }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  // Load existing department configs và merge với default
  useEffect(() => {
    if (user) {
      loadDepartments();
    }
  }, [user]);

  const loadDepartments = async () => {
    setLoading(true);
    try {
      const result = await departmentConfigAPI.getDepartmentConfigs();
      const existingDepts = result.data?.departments || result.data?.data?.departments || result.departments || [];
      
      // Merge với default departments - đảm bảo đủ 7 phòng ban
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

      setDepartments(mergedDepts);
    } catch (error) {
      console.error('Error loading departments:', error);
      // Nếu lỗi, hiện default với email trống
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
      // Chuẩn bị data để gửi - chỉ gửi những phòng ban có thay đổi hoặc có email
      const dataToSave = departments.map(dept => ({
        id: dept.id,
        category_key: dept.category_key,
        department_name: dept.department_name,
        notification_email: dept.notification_email || null,
      }));

      const result = await departmentConfigAPI.updateDepartmentConfigs(dataToSave);

      setMessage({
        type: 'success',
        text: result.message || 'Đã lưu cấu hình phòng ban thành công!',
      });

      // Reload để lấy ID mới (nếu có insert)
      await loadDepartments();

      // Callback khi hoàn thành
      setTimeout(() => {
        if (onComplete) {
          onComplete();
        } else {
          navigate('/dashboard');
        }
      }, 1500);

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

  const handleSkip = () => {
    if (onComplete) {
      onComplete();
    } else {
      navigate('/dashboard');
    }
  };

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: isModal ? '400px' : '100vh',
        backgroundColor: isModal ? 'transparent' : '#f1f5f9',
      }}>
        <div style={{ textAlign: 'center' }}>
          <i className="fas fa-spinner fa-spin" style={{ fontSize: '32px', color: '#6366f1' }}></i>
          <p style={{ marginTop: '15px', color: '#64748b' }}>Đang tải...</p>
        </div>
      </div>
    );
  }

  const containerStyle = isModal ? {
    padding: '20px',
    backgroundColor: 'white',
  } : {
    minHeight: '100vh',
    backgroundColor: '#f1f5f9',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    padding: '40px 20px',
  };

  const cardStyle = isModal ? {
    width: '100%',
  } : {
    backgroundColor: 'white',
    borderRadius: '16px',
    boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06)',
    padding: '40px',
    width: '100%',
    maxWidth: '700px',
  };

  return (
    <div style={containerStyle}>
      <div style={cardStyle}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '30px' }}>
          <div style={{
            width: '70px',
            height: '70px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 20px',
          }}>
            <i className="fas fa-building" style={{ fontSize: '28px', color: 'white' }}></i>
          </div>
          <h2 style={{ 
            fontSize: '24px', 
            fontWeight: '700', 
            color: '#1e293b',
            marginBottom: '10px' 
          }}>
            Thiết lập Email Phòng Ban
          </h2>
          <p style={{ color: '#64748b', fontSize: '15px', lineHeight: '1.6' }}>
            Nhập email thông báo cho từng phòng ban. Bạn có thể để trống và cập nhật sau trong phần Cài đặt.
          </p>
        </div>

        {/* Message */}
        {message && (
          <div
            style={{
              padding: '12px 16px',
              borderRadius: '8px',
              marginBottom: '20px',
              backgroundColor: message.type === 'success' ? '#f0fdf4' : '#fef2f2',
              border: `1px solid ${message.type === 'success' ? '#86efac' : '#fca5a5'}`,
              color: message.type === 'success' ? '#166534' : '#991b1b',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              fontSize: '14px',
            }}
          >
            <i className={`fas ${message.type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}`}></i>
            <span>{message.text}</span>
          </div>
        )}

        {/* Department List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '30px' }}>
          {departments.map((dept, index) => (
            <div
              key={dept.category_key}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '15px',
                padding: '16px',
                backgroundColor: '#f8fafc',
                borderRadius: '10px',
                border: '1px solid #e2e8f0',
                transition: 'border-color 0.2s',
              }}
            >
              <div style={{ 
                width: '40px', 
                height: '40px', 
                borderRadius: '10px',
                backgroundColor: getColorByIndex(index),
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}>
                <i className={getIconByCategory(dept.category_key)} style={{ color: 'white', fontSize: '16px' }}></i>
              </div>
              
              <div style={{ flex: '0 0 180px', minWidth: '150px' }}>
                <div style={{ fontWeight: '600', fontSize: '14px', color: '#1e293b', marginBottom: '2px' }}>
                  {dept.department_name}
                </div>
                <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                  {dept.category_key}
                </div>
              </div>
              
              <div style={{ flex: 1 }}>
                <input
                  type="email"
                  placeholder="example@company.com"
                  value={dept.notification_email || ''}
                  onChange={(e) => handleEmailChange(index, e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    border: '1px solid #cbd5e1',
                    borderRadius: '8px',
                    fontSize: '14px',
                    outline: 'none',
                    transition: 'border-color 0.2s, box-shadow 0.2s',
                    backgroundColor: 'white',
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = '#6366f1';
                    e.target.style.boxShadow = '0 0 0 3px rgba(99, 102, 241, 0.1)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = '#cbd5e1';
                    e.target.style.boxShadow = 'none';
                  }}
                />
              </div>
            </div>
          ))}
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
          <button
            onClick={handleSkip}
            disabled={saving}
            style={{
              padding: '12px 24px',
              borderRadius: '8px',
              border: '1px solid #e2e8f0',
              backgroundColor: 'white',
              color: '#64748b',
              fontSize: '14px',
              fontWeight: '500',
              cursor: saving ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              if (!saving) {
                e.target.style.backgroundColor = '#f8fafc';
              }
            }}
            onMouseLeave={(e) => {
              e.target.style.backgroundColor = 'white';
            }}
          >
            Bỏ qua
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              padding: '12px 28px',
              borderRadius: '8px',
              border: 'none',
              background: saving ? '#94a3b8' : 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
              color: 'white',
              fontSize: '14px',
              fontWeight: '600',
              cursor: saving ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 0.2s',
              boxShadow: saving ? 'none' : '0 4px 6px -1px rgba(99, 102, 241, 0.3)',
            }}
          >
            {saving ? (
              <>
                <i className="fas fa-spinner fa-spin"></i>
                Đang lưu...
              </>
            ) : (
              <>
                <i className="fas fa-save"></i>
                Lưu cấu hình
              </>
            )}
          </button>
        </div>

        {/* Footer note */}
        <p style={{ 
          textAlign: 'center', 
          marginTop: '24px', 
          fontSize: '13px', 
          color: '#94a3b8',
          lineHeight: '1.5',
        }}>
          <i className="fas fa-info-circle" style={{ marginRight: '6px' }}></i>
          Bạn có thể thay đổi cài đặt này bất cứ lúc nào trong <strong>Cài đặt hệ thống</strong>
        </p>
      </div>
    </div>
  );
};

// Helper functions
const getColorByIndex = (index) => {
  const colors = [
    '#6366f1', // Finance - Indigo
    '#8b5cf6', // Legal - Purple
    '#ec4899', // HR - Pink
    '#f97316', // Sales - Orange
    '#06b6d4', // Tech - Cyan
    '#10b981', // Marketing - Emerald
    '#64748b', // Other - Slate
  ];
  return colors[index % colors.length];
};

const getIconByCategory = (categoryKey) => {
  const icons = {
    'Finance & Tax': 'fas fa-coins',
    'Legal & Contracts': 'fas fa-balance-scale',
    'HR & Admin': 'fas fa-users',
    'Sales & CRM': 'fas fa-chart-line',
    'Projects & Tech': 'fas fa-laptop-code',
    'Marketing': 'fas fa-bullhorn',
    'Other': 'fas fa-folder',
  };
  return icons[categoryKey] || 'fas fa-folder';
};

export default DepartmentSetup;
