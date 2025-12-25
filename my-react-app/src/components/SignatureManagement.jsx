/**
 * SignatureManagement Component
 * 
 * Component để tạo và quản lý chữ ký người dùng:
 * - Vẽ chữ ký tay trên canvas
 * - Upload ảnh chữ ký
 * - Tạo chữ ký từ text
 * - Xem danh sách chữ ký
 * - Đặt chữ ký mặc định
 * - Xóa chữ ký
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';

const SignatureManagement = () => {
  // State for signature creation
  const [signatureType, setSignatureType] = useState('drawn'); // drawn, uploaded, typed
  const [typedText, setTypedText] = useState('');
  const [uploadedFile, setUploadedFile] = useState(null);
  const [pin, setPin] = useState('');
  const [label, setLabel] = useState('My Signature');
  const [isDefault, setIsDefault] = useState(true);
  
  // State for signatures list
  const [signatures, setSignatures] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  
  // State for drawing
  const [isDrawing, setIsDrawing] = useState(false);
  const [lastPos, setLastPos] = useState({ x: 0, y: 0 });
  
  // Refs
  const canvasRef = useRef(null);
  
  // Get access token
  const getAccessToken = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token;
  };
  
  // Initialize canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = '#1a1a2e';
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
    }
  }, [signatureType]);
  
  // Load signatures on mount
  useEffect(() => {
    loadSignatures();
  }, []);
  
  // Drawing handlers
  const getPosition = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    if (e.touches) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY
      };
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  };
  
  const startDrawing = (e) => {
    e.preventDefault();
    setIsDrawing(true);
    const pos = getPosition(e);
    setLastPos(pos);
  };
  
  const draw = useCallback((e) => {
    if (!isDrawing) return;
    e.preventDefault();
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const pos = getPosition(e);
    
    ctx.beginPath();
    ctx.moveTo(lastPos.x, lastPos.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    
    setLastPos(pos);
  }, [isDrawing, lastPos]);
  
  const stopDrawing = () => {
    setIsDrawing(false);
  };
  
  // Clear canvas
  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
  };
  
  // Convert canvas to blob
  const canvasToBlob = () => {
    return new Promise((resolve) => {
      const canvas = canvasRef.current;
      if (!canvas) {
        resolve(null);
        return;
      }
      canvas.toBlob((blob) => {
        resolve(blob);
      }, 'image/png', 1.0);
    });
  };
  
  // Convert text to image blob
  const textToImageBlob = async (text) => {
    const canvas = document.createElement('canvas');
    canvas.width = 400;
    canvas.height = 120;
    const ctx = canvas.getContext('2d');
    
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    ctx.font = 'italic 48px "Dancing Script", cursive, serif';
    ctx.fillStyle = '#1a1a2e';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, canvas.width / 2, canvas.height / 2);
    
    return new Promise((resolve) => {
      canvas.toBlob((blob) => {
        resolve(blob);
      }, 'image/png', 1.0);
    });
  };
  
  // Load signatures
  const loadSignatures = async () => {
    const token = await getAccessToken();
    if (!token) return;
    
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/e-signature-ext/user-signature/my-signatures`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      const result = await res.json();
      if (res.ok && result.data) {
        setSignatures(result.data);
      }
    } catch (err) {
      console.error('Load signatures error:', err);
    } finally {
      setLoading(false);
    }
  };
  
  // Create signature
  const createSignature = async () => {
    setError(null);
    setSuccess(null);
    
    if (!pin || pin.length < 4) {
      setError('PIN phải có ít nhất 4 ký tự');
      return;
    }
    
    let imageBlob;
    
    // Get image based on type
    if (signatureType === 'drawn') {
      imageBlob = await canvasToBlob();
      if (!imageBlob || imageBlob.size < 100) {
        setError('Vui lòng vẽ chữ ký trên canvas');
        return;
      }
    } else if (signatureType === 'uploaded') {
      if (!uploadedFile) {
        setError('Vui lòng chọn file ảnh');
        return;
      }
      imageBlob = uploadedFile;
    } else if (signatureType === 'typed') {
      if (!typedText || typedText.trim().length === 0) {
        setError('Vui lòng nhập text cho chữ ký');
        return;
      }
      imageBlob = await textToImageBlob(typedText);
    }
    
    setLoading(true);
    
    try {
      const token = await getAccessToken();
      
      const formData = new FormData();
      formData.append('signatureImage', imageBlob, 'signature.png');
      formData.append('signatureType', signatureType);
      formData.append('pin', pin);
      if (label) formData.append('label', label);
      formData.append('isDefault', isDefault.toString());
      
      const res = await fetch(`${API_BASE_URL}/e-signature-ext/user-signature/create`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });
      
      const result = await res.json();
      
      if (!res.ok) {
        throw new Error(result.message || 'Không thể tạo chữ ký');
      }
      
      setSuccess('Tạo chữ ký thành công!');
      clearCanvas();
      setTypedText('');
      setUploadedFile(null);
      loadSignatures();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  
  // Set default signature
  const setDefaultSignature = async (signatureId) => {
    const token = await getAccessToken();
    if (!token) return;
    
    try {
      const res = await fetch(`${API_BASE_URL}/e-signature-ext/user-signature/${signatureId}/set-default`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (res.ok) {
        setSuccess('Đã đặt làm chữ ký mặc định');
        loadSignatures();
      }
    } catch (err) {
      setError(err.message);
    }
  };
  
  // Delete signature
  const deleteSignature = async (signatureId) => {
    if (!confirm('Bạn có chắc muốn xóa chữ ký này?')) return;
    
    const token = await getAccessToken();
    if (!token) return;
    
    try {
      const res = await fetch(`${API_BASE_URL}/e-signature-ext/user-signature/${signatureId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (res.ok) {
        setSuccess('Đã xóa chữ ký');
        loadSignatures();
      }
    } catch (err) {
      setError(err.message);
    }
  };
  
  return (
    <div className="signature-management" style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <h2 style={styles.title}>
          <i className="fas fa-signature" style={{ marginRight: '10px' }}></i>
          Quản lý Chữ ký
        </h2>
        <p style={styles.subtitle}>Tạo và quản lý chữ ký cá nhân của bạn</p>
      </div>
      
      {/* Messages */}
      {error && (
        <div style={styles.error}>
          <i className="fas fa-exclamation-circle"></i> {error}
        </div>
      )}
      {success && (
        <div style={styles.success}>
          <i className="fas fa-check-circle"></i> {success}
        </div>
      )}
      
      {/* Main content */}
      <div style={styles.content}>
        {/* Left: Create Signature */}
        <div style={styles.createSection}>
          <h3 style={styles.sectionTitle}>✍️ Tạo chữ ký mới</h3>
          
          {/* Signature Type */}
          <div style={styles.field}>
            <label style={styles.label}>Loại chữ ký</label>
            <div style={styles.typeButtons}>
              {[
                { value: 'drawn', label: '✏️ Vẽ tay', icon: 'fas fa-pen' },
                { value: 'uploaded', label: '📷 Upload ảnh', icon: 'fas fa-upload' },
                { value: 'typed', label: '⌨️ Gõ text', icon: 'fas fa-keyboard' }
              ].map(type => (
                <button
                  key={type.value}
                  onClick={() => setSignatureType(type.value)}
                  style={{
                    ...styles.typeBtn,
                    backgroundColor: signatureType === type.value ? '#6366f1' : '#f3f4f6',
                    color: signatureType === type.value ? 'white' : '#374151'
                  }}
                >
                  {type.label}
                </button>
              ))}
            </div>
          </div>
          
          {/* Drawing Canvas */}
          {signatureType === 'drawn' && (
            <div style={styles.field}>
              <label style={styles.label}>Vẽ chữ ký của bạn</label>
              <div style={styles.canvasWrapper}>
                <canvas
                  ref={canvasRef}
                  width={500}
                  height={150}
                  style={styles.canvas}
                  onMouseDown={startDrawing}
                  onMouseMove={draw}
                  onMouseUp={stopDrawing}
                  onMouseLeave={stopDrawing}
                  onTouchStart={startDrawing}
                  onTouchMove={draw}
                  onTouchEnd={stopDrawing}
                />
              </div>
              <button onClick={clearCanvas} style={styles.clearBtn}>
                <i className="fas fa-eraser"></i> Xóa canvas
              </button>
            </div>
          )}
          
          {/* Upload File */}
          {signatureType === 'uploaded' && (
            <div style={styles.field}>
              <label style={styles.label}>Chọn ảnh chữ ký</label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setUploadedFile(e.target.files[0])}
                style={styles.fileInput}
              />
              {uploadedFile && (
                <p style={styles.fileName}>📎 {uploadedFile.name}</p>
              )}
            </div>
          )}
          
          {/* Typed Text */}
          {signatureType === 'typed' && (
            <div style={styles.field}>
              <label style={styles.label}>Nhập tên để tạo chữ ký</label>
              <input
                type="text"
                value={typedText}
                onChange={(e) => setTypedText(e.target.value)}
                placeholder="Nguyễn Văn A"
                style={styles.typedInput}
              />
              {typedText && (
                <div style={styles.typedPreview}>{typedText}</div>
              )}
            </div>
          )}
          
          {/* Label */}
          <div style={styles.field}>
            <label style={styles.label}>Tên chữ ký (tùy chọn)</label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="My Signature"
              style={styles.input}
            />
          </div>
          
          {/* PIN */}
          <div style={styles.field}>
            <label style={styles.label}>Mã PIN (bảo mật)</label>
            <input
              type="password"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="Ít nhất 4 ký tự"
              maxLength={6}
              style={styles.pinInput}
            />
          </div>
          
          {/* Default checkbox */}
          <div style={styles.checkbox}>
            <input
              type="checkbox"
              id="isDefault"
              checked={isDefault}
              onChange={(e) => setIsDefault(e.target.checked)}
              style={{ marginRight: '8px', width: '18px', height: '18px' }}
            />
            <label htmlFor="isDefault" style={{ cursor: 'pointer' }}>
              Đặt làm chữ ký mặc định
            </label>
          </div>
          
          {/* Submit button */}
          <button
            onClick={createSignature}
            disabled={loading}
            style={{
              ...styles.submitBtn,
              opacity: loading ? 0.7 : 1
            }}
          >
            {loading ? (
              <>
                <i className="fas fa-spinner fa-spin"></i> Đang xử lý...
              </>
            ) : (
              <>
                <i className="fas fa-plus"></i> Tạo chữ ký
              </>
            )}
          </button>
        </div>
        
        {/* Right: Signatures List */}
        <div style={styles.listSection}>
          <div style={styles.listHeader}>
            <h3 style={styles.sectionTitle}>📋 Chữ ký của tôi</h3>
            <button onClick={loadSignatures} style={styles.refreshBtn}>
              <i className="fas fa-sync-alt"></i>
            </button>
          </div>
          
          {loading ? (
            <div style={styles.loading}>
              <i className="fas fa-spinner fa-spin"></i> Đang tải...
            </div>
          ) : signatures.length === 0 ? (
            <div style={styles.empty}>
              <i className="fas fa-signature" style={{ fontSize: '48px', marginBottom: '16px', opacity: 0.3 }}></i>
              <p>Chưa có chữ ký nào</p>
              <p style={{ fontSize: '12px', color: '#9ca3af' }}>Tạo chữ ký đầu tiên của bạn</p>
            </div>
          ) : (
            <div style={styles.signatureList}>
              {signatures.map(sig => (
                <div key={sig.id} style={styles.signatureItem}>
                  <div style={styles.signaturePreview}>
                    <img
                      src={sig.image_url}
                      alt="Signature"
                      style={styles.signatureImage}
                    />
                  </div>
                  <div style={styles.signatureInfo}>
                    <div style={styles.signatureName}>
                      {sig.metadata?.label || 'Chữ ký'}
                      {sig.is_default && (
                        <span style={styles.defaultBadge}>⭐ Mặc định</span>
                      )}
                    </div>
                    <div style={styles.signatureMeta}>
                      <span>{sig.signature_type}</span>
                      <span>•</span>
                      <span>{new Date(sig.created_at).toLocaleDateString('vi-VN')}</span>
                    </div>
                  </div>
                  <div style={styles.signatureActions}>
                    {!sig.is_default && (
                      <button
                        onClick={() => setDefaultSignature(sig.id)}
                        style={styles.actionBtn}
                        title="Đặt làm mặc định"
                      >
                        <i className="fas fa-star"></i>
                      </button>
                    )}
                    <button
                      onClick={() => deleteSignature(sig.id)}
                      style={{ ...styles.actionBtn, color: '#ef4444' }}
                      title="Xóa"
                    >
                      <i className="fas fa-trash"></i>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Styles
const styles = {
  container: {
    backgroundColor: '#f9fafb',
    minHeight: '100%',
    padding: '24px'
  },
  header: {
    marginBottom: '24px'
  },
  title: {
    fontSize: '24px',
    fontWeight: '700',
    color: '#1f2937',
    margin: '0 0 8px 0'
  },
  subtitle: {
    color: '#6b7280',
    fontSize: '14px',
    margin: 0
  },
  error: {
    backgroundColor: '#fef2f2',
    border: '1px solid #fecaca',
    color: '#dc2626',
    padding: '12px 16px',
    borderRadius: '8px',
    marginBottom: '16px',
    fontSize: '14px'
  },
  success: {
    backgroundColor: '#ecfdf5',
    border: '1px solid #a7f3d0',
    color: '#059669',
    padding: '12px 16px',
    borderRadius: '8px',
    marginBottom: '16px',
    fontSize: '14px'
  },
  content: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '24px'
  },
  createSection: {
    backgroundColor: 'white',
    borderRadius: '16px',
    padding: '24px',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
  },
  listSection: {
    backgroundColor: 'white',
    borderRadius: '16px',
    padding: '24px',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
  },
  sectionTitle: {
    fontSize: '18px',
    fontWeight: '600',
    color: '#374151',
    margin: '0 0 20px 0'
  },
  field: {
    marginBottom: '20px'
  },
  label: {
    display: 'block',
    fontSize: '14px',
    fontWeight: '500',
    color: '#374151',
    marginBottom: '8px'
  },
  typeButtons: {
    display: 'flex',
    gap: '8px'
  },
  typeBtn: {
    flex: 1,
    padding: '12px',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontWeight: '500',
    fontSize: '13px',
    transition: 'all 0.2s'
  },
  canvasWrapper: {
    border: '2px solid #e5e7eb',
    borderRadius: '12px',
    overflow: 'hidden',
    backgroundColor: 'white'
  },
  canvas: {
    width: '100%',
    height: '150px',
    cursor: 'crosshair',
    touchAction: 'none',
    display: 'block'
  },
  clearBtn: {
    marginTop: '8px',
    padding: '8px 16px',
    backgroundColor: '#f3f4f6',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '13px',
    color: '#6b7280'
  },
  fileInput: {
    width: '100%',
    padding: '12px',
    border: '2px dashed #d1d5db',
    borderRadius: '8px',
    backgroundColor: '#f9fafb'
  },
  fileName: {
    marginTop: '8px',
    fontSize: '13px',
    color: '#059669'
  },
  typedInput: {
    width: '100%',
    padding: '16px',
    border: '2px solid #e5e7eb',
    borderRadius: '8px',
    fontSize: '24px',
    fontFamily: '"Dancing Script", cursive, serif',
    fontStyle: 'italic',
    textAlign: 'center'
  },
  typedPreview: {
    marginTop: '12px',
    padding: '20px',
    backgroundColor: '#f9fafb',
    borderRadius: '8px',
    textAlign: 'center',
    fontSize: '36px',
    fontFamily: '"Dancing Script", cursive, serif',
    fontStyle: 'italic',
    color: '#1a1a2e'
  },
  input: {
    width: '100%',
    padding: '12px',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    fontSize: '14px'
  },
  pinInput: {
    width: '100%',
    padding: '14px',
    border: '2px solid #fbbf24',
    borderRadius: '8px',
    fontSize: '20px',
    textAlign: 'center',
    letterSpacing: '8px',
    fontFamily: 'monospace'
  },
  checkbox: {
    display: 'flex',
    alignItems: 'center',
    marginBottom: '20px',
    fontSize: '14px',
    color: '#374151'
  },
  submitBtn: {
    width: '100%',
    padding: '14px',
    background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
    color: 'white',
    border: 'none',
    borderRadius: '10px',
    cursor: 'pointer',
    fontWeight: '600',
    fontSize: '15px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px'
  },
  listHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px'
  },
  refreshBtn: {
    padding: '8px 12px',
    backgroundColor: '#f3f4f6',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    color: '#6b7280'
  },
  loading: {
    padding: '40px',
    textAlign: 'center',
    color: '#6b7280'
  },
  empty: {
    padding: '60px 20px',
    textAlign: 'center',
    color: '#9ca3af'
  },
  signatureList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px'
  },
  signatureItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    padding: '16px',
    backgroundColor: '#f9fafb',
    borderRadius: '12px',
    border: '1px solid #e5e7eb'
  },
  signaturePreview: {
    width: '80px',
    height: '50px',
    backgroundColor: 'white',
    borderRadius: '6px',
    overflow: 'hidden',
    border: '1px solid #e5e7eb',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  signatureImage: {
    maxWidth: '100%',
    maxHeight: '100%',
    objectFit: 'contain'
  },
  signatureInfo: {
    flex: 1
  },
  signatureName: {
    fontWeight: '500',
    fontSize: '14px',
    color: '#374151',
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  defaultBadge: {
    fontSize: '11px',
    backgroundColor: '#fef3c7',
    color: '#d97706',
    padding: '2px 8px',
    borderRadius: '10px'
  },
  signatureMeta: {
    fontSize: '12px',
    color: '#9ca3af',
    marginTop: '4px',
    display: 'flex',
    gap: '6px'
  },
  signatureActions: {
    display: 'flex',
    gap: '8px'
  },
  actionBtn: {
    padding: '8px',
    backgroundColor: 'transparent',
    border: '1px solid #e5e7eb',
    borderRadius: '6px',
    cursor: 'pointer',
    color: '#6b7280',
    fontSize: '14px'
  }
};

export default SignatureManagement;
