/**
 * SignDocumentPage Component
 * 
 * Trang để người nhận email ký tài liệu
 * URL: /sign?requestId=xxx&signerId=yyy
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import * as pdfjsLib from 'pdfjs-dist';
import { supabase } from '../lib/supabase';
import '../styles/dashboard.css';

// Set worker source
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://api.docsops.me/api/v1';

const SignDocumentPage = () => {
  const [searchParams] = useSearchParams();
  const requestId = searchParams.get('requestId');
  const signerId = searchParams.get('signerId');

  // State
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [request, setRequest] = useState(null);
  const [document, setDocument] = useState(null);
  const [pdfDoc, setPdfDoc] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);

  // Signature state
  const [signatures, setSignatures] = useState([]);
  const [selectedSignature, setSelectedSignature] = useState(null);
  const [signaturePosition, setSignaturePosition] = useState({ x: 350, y: 350 });
  const [signatureSize, setSignatureSize] = useState({ width: 150, height: 75 });
  const [pin, setPin] = useState('');
  const [isSigning, setIsSigning] = useState(false);
  const [signSuccess, setSignSuccess] = useState(false);
  const [signedPdfUrl, setSignedPdfUrl] = useState(null);

  // Drag & Resize state
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [isResizing, setIsResizing] = useState(false);
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0 });
  const [initialSignatureSize, setInitialSignatureSize] = useState({ width: 0, height: 0 });
  const [pdfScale, setPdfScale] = useState(1);

  // User auth
  const [user, setUser] = useState(null);
  const [needsAuth, setNeedsAuth] = useState(false);

  // Refs
  const canvasRef = useRef(null);
  const containerRef = useRef(null);

  // Logic checks
  // const isCreator = user && request?.creator_id === user.id;
  // const mySignerRecord = user && request?.signers?.find(s => s.signer_id === user.id || s.signer_email === user.email);
  const isCompleted = request?.status === 'signed';

  const urlEmail = searchParams.get('email');
  const urlSenderEmail = searchParams.get('senderEmail');

  // Load request details
  useEffect(() => {
    if (!requestId) {
      setError('Không tìm thấy yêu cầu ký. Vui lòng kiểm tra link.');
      setLoading(false);
      return;
    }
    loadRequestDetails();
  }, [requestId, signerId]);

  // Check auth
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setUser(session.user);
        loadUserSignatures(session.access_token);
      }
    };
    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        setUser(session.user);
        setNeedsAuth(false);
        loadUserSignatures(session.access_token);
      } else {
        setUser(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Auto-render PDF when loading finishes
  useEffect(() => {
    if (pdfDoc && !loading) {
      setTimeout(() => {
        renderPage(pdfDoc, currentPage);
      }, 100);
    }
  }, [pdfDoc, loading, currentPage]);

  const loadRequestDetails = async () => {
    setLoading(true);
    try {
      // Sử dụng internal API endpoint (không cần user auth, dùng API key)
      const res = await fetch(`${API_BASE_URL}/e-signature/internal/signature-requests/${requestId}`, {
        headers: {
          'X-API-Key': import.meta.env.VITE_API_KEY || 'esign-secure-api-key-2024'
        }
      });

      const result = await res.json();
      console.log('API Response Data:', result.data); // DEBUG LOG

      if (!res.ok || !result.success) {
        throw new Error(result.message || 'Không thể tải thông tin yêu cầu');
      }

      setRequest(result.data);
      setDocument(result.data.document);

      // Load PDF
      if (result.data.document?.storage_path) {
        await loadPdf(result.data.document.storage_path);
      }
    } catch (err) {
      console.error('Load request error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadPdf = async (storagePath) => {
    try {
      // Get PDF URL from Supabase storage
      const { data } = supabase.storage.from('documents').getPublicUrl(storagePath);

      if (data?.publicUrl) {
        const loadingTask = pdfjsLib.getDocument(data.publicUrl);
        const pdf = await loadingTask.promise;
        setPdfDoc(pdf);
        setTotalPages(pdf.numPages);
        // renderPage(pdf, 1); -> Removed: Canvas not ready yet
      }
    } catch (err) {
      console.error('Load PDF error:', err);
      setError('Không thể tải tài liệu PDF');
    }
  };

  const renderPage = async (pdf, pageNum) => {
    if (!pdf || !canvasRef.current || !containerRef.current) return;

    try {
      const page = await pdf.getPage(pageNum);
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      const container = containerRef.current;

      const containerWidth = container.clientWidth - 32;
      const containerHeight = 700; // Hoặc calculate dynamic height nếu muốn

      const originalViewport = page.getViewport({ scale: 1 });
      const scaleX = containerWidth / originalViewport.width;
      // const scaleY = containerHeight / originalViewport.height; 
      // Không cần scaleY vì PDF thường scroll vertical

      const fitScale = Math.min(scaleX, 1.5); // Max scale 1.5
      setPdfScale(fitScale);

      const viewport = page.getViewport({ scale: fitScale });
      canvas.width = viewport.width;
      canvas.height = viewport.height;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      await page.render({
        canvasContext: ctx,
        viewport: viewport
      }).promise;
    } catch (err) {
      console.error('Render error:', err);
    }
  };

  // Drag handling
  const handleDragStart = (e) => {
    e.preventDefault();
    e.stopPropagation(); // Stop propagation to prevent canvas drag
    setIsDragging(true);

    const clientX = e.clientX || e.touches?.[0]?.clientX;
    const clientY = e.clientY || e.touches?.[0]?.clientY;

    setDragStart({
      x: clientX - signaturePosition.x,
      y: clientY - signaturePosition.y
    });
  };

  // Resize handling
  const handleResizeStart = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);

    const clientX = e.clientX || e.touches?.[0]?.clientX;
    const clientY = e.clientY || e.touches?.[0]?.clientY;

    setResizeStart({ x: clientX, y: clientY });
    setInitialSignatureSize({ ...signatureSize });
  };

  // Global Move/Up handlers (attach to window/document)
  useEffect(() => {
    const handleMove = (e) => {
      if (!isDragging && !isResizing) return;

      const clientX = e.clientX || e.touches?.[0]?.clientX;
      const clientY = e.clientY || e.touches?.[0]?.clientY;

      if (isDragging) {
        const canvas = canvasRef.current;
        const container = containerRef.current;
        if (!canvas || !container) return;

        const canvasRect = canvas.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();

        const canvasOffsetX = canvasRect.left - containerRect.left;
        const canvasOffsetY = canvasRect.top - containerRect.top;

        let newX = clientX - dragStart.x;
        let newY = clientY - dragStart.y;

        // Constrain
        const minX = canvasOffsetX;
        const minY = canvasOffsetY;
        const maxX = canvasOffsetX + canvasRect.width - signatureSize.width;
        const maxY = canvasOffsetY + canvasRect.height - signatureSize.height;

        newX = Math.max(minX, Math.min(newX, maxX));
        newY = Math.max(minY, Math.min(newY, maxY));

        setSignaturePosition({ x: newX, y: newY });
      } else if (isResizing) {
        // Calculate new size
        const deltaX = clientX - resizeStart.x;
        const deltaY = clientY - resizeStart.y;

        // Giữ tỷ lệ aspect ratio
        const aspectRatio = initialSignatureSize.width / initialSignatureSize.height;

        let newWidth = initialSignatureSize.width + deltaX;
        let newHeight = newWidth / aspectRatio;

        // Limits
        if (newWidth < 50) {
          newWidth = 50;
          newHeight = 50 / aspectRatio;
        }
        if (newWidth > 400) {
          newWidth = 400;
          newHeight = 400 / aspectRatio;
        }

        setSignatureSize({ width: newWidth, height: newHeight });
      }
    };

    const handleUp = () => {
      setIsDragging(false);
      setIsResizing(false);
    };

    if (isDragging || isResizing) {
      window.addEventListener('mousemove', handleMove);
      window.addEventListener('mouseup', handleUp);
      window.addEventListener('touchmove', handleMove);
      window.addEventListener('touchend', handleUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend', handleUp);
    };
  }, [isDragging, isResizing, dragStart, resizeStart, initialSignatureSize, signatureSize]);

  const loadUserSignatures = async (token) => {
    try {
      const res = await fetch(`${API_BASE_URL}/e-signature-ext/user-signature/my-signatures`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const result = await res.json();
      if (res.ok && result.data && result.data.length > 0) {
        setSignatures(result.data);
        const defaultSig = result.data.find(s => s.is_default);
        setSelectedSignature(defaultSig || result.data[0]);
      }
    } catch (err) {
      console.error('Load signatures error:', err);
    }
  };

  const handleLogin = async (email, password) => {
    setError(null);
    setSuccessMessage('');
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      setUser(data.user);
      setNeedsAuth(false);
    } catch (err) {
      setError(err.message);
    }
  };

  // State for success message
  const [successMessage, setSuccessMessage] = useState('');

  const handleRegister = async (email, password) => {
    setError(null);
    setSuccessMessage('');
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: window.location.href // Redirect back to this page after email confirmation
        }
      });

      if (error) throw error;

      if (data.user && data.session) {
        // Nếu auto-confirm được bật, user đã đăng nhập ngay
        setUser(data.user);
        setNeedsAuth(false);
        setSuccessMessage('Đăng ký thành công! Đang đăng nhập...');
      } else if (data.user) {
        // Nếu cần xác nhận email
        setSuccessMessage('Đăng ký thành công! Vui lòng kiểm tra email để xác nhận tài khoản.');
      }
    } catch (err) {
      setError(err.message);
    }
  };

  const handleSignDocument = async () => {
    if (!user) {
      setNeedsAuth(true);
      return;
    }

    if (!selectedSignature) {
      setError('Vui lòng chọn chữ ký');
      return;
    }

    if (!pin || pin.length < 4) {
      setError('Vui lòng nhập mã PIN (ít nhất 4 ký tự)');
      return;
    }

    setIsSigning(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();

      // Tính toán tọa độ chuẩn hóa trên PDF gốc
      const canvas = canvasRef.current;
      const container = containerRef.current;
      let pdfX = 0;
      let pdfY = 0;
      let pdfWidth = signatureSize.width;
      let pdfHeight = signatureSize.height;

      if (canvas && container) {
        const canvasRect = canvas.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();

        const canvasOffsetX = canvasRect.left - containerRect.left;
        const canvasOffsetY = canvasRect.top - containerRect.top;

        const relativeX = signaturePosition.x - canvasOffsetX;
        const relativeY = signaturePosition.y - canvasOffsetY;

        pdfX = relativeX / pdfScale;
        pdfY = relativeY / pdfScale;
        pdfWidth = signatureSize.width / pdfScale;
        pdfHeight = signatureSize.height / pdfScale;
      }

      // Sign the document
      const res = await fetch(`${API_BASE_URL}/e-signature/documents/${document.id}/sign`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          signatureId: selectedSignature.id,
          pin: pin,
          requestId: requestId,
          signerId: signerId,
          position: {
            page: currentPage,
            x: Math.round(pdfX),
            y: Math.round(pdfY),
            width: Math.round(pdfWidth),
            height: Math.round(pdfHeight)
          }
        })
      });

      const result = await res.json();

      if (!res.ok) {
        throw new Error(result.message || 'Không thể ký tài liệu');
      }

      // Lưu URL file đã ký để hiển thị nút download
      let finalSignedUrl = null;
      if (result.data) {
        if (result.data.signedPdfUrl) {
          finalSignedUrl = result.data.signedPdfUrl;
          setSignedPdfUrl(result.data.signedPdfUrl);
        } else if (result.data.document && result.data.document.url) {
          finalSignedUrl = result.data.document.url;
          setSignedPdfUrl(result.data.document.url);
        }
      }

      // Update state request to ensure UI has latest info
      // Gửi thông báo cho người gửi (creator) - Đã chuyển sang Backend
      // Để đảm bảo bảo mật và reliability.

      // Update local state is handled below or by re-fetching if needed

      // Fallback: Nếu chưa có URL, fetch lại thông tin mới nhất từ server
      if (!finalSignedUrl) {
        try {
          console.log('Fetching latest document info...');
          const refreshRes = await fetch(`${API_BASE_URL}/e-signature/internal/signature-requests/${requestId}`, {
            headers: {
              'X-API-Key': import.meta.env.VITE_API_KEY || 'esign-secure-api-key-2024'
            }
          });
          const refreshData = await refreshRes.json();

          if (refreshData.success && refreshData.data.document && refreshData.data.document.storage_path) {
            const { data: urlData } = supabase.storage
              .from('documents')
              .getPublicUrl(refreshData.data.document.storage_path);

            if (urlData?.publicUrl) {
              console.log('Updated signed URL:', urlData.publicUrl);
              setSignedPdfUrl(urlData.publicUrl);
            }
          }
        } catch (refreshErr) {
          console.error('Failed to refresh document info:', refreshErr);
        }
      }

      setSignSuccess(true);
    } catch (err) {
      console.error('Sign error:', err);
      setError(err.message);
    } finally {
      setIsSigning(false);
    }
  };

  // Render success state
  if (signSuccess) {
    return (
      <div style={styles.container}>
        <div style={styles.successCard}>
          <div style={styles.successIcon}>
            <i className="fas fa-check-circle" style={{ fontSize: '64px', color: '#10b981' }}></i>
          </div>
          <h1 style={styles.successTitle}>Ký tài liệu thành công!</h1>
          <p style={styles.successText}>
            Bạn đã ký thành công tài liệu "{document?.title}".
          </p>
          <p style={styles.successText}>
            Người gửi sẽ nhận được thông báo về việc bạn đã ký.
          </p>

          {!signedPdfUrl ? (
            <p style={{ marginTop: '20px', color: '#6366f1' }}>
              <i className="fas fa-spinner fa-spin"></i> Đang chuẩn bị file đã ký...
            </p>
          ) : (
            <div style={{ textAlign: 'center' }}>
              <p style={{ margin: '15px 0 5px', fontSize: '14px', color: '#666' }}>
                File này chứa chữ ký của tất cả các bên.
              </p>
              <a
                href={signedPdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-block',
                  marginTop: '10px',
                  padding: '12px 24px',
                  backgroundColor: '#10b981',
                  color: 'white',
                  textDecoration: 'none',
                  borderRadius: '8px',
                  fontWeight: '500',
                  fontSize: '16px',
                  boxShadow: '0 4px 6px rgba(16, 185, 129, 0.2)',
                  cursor: 'pointer'
                }}
              >
                <i className="fas fa-download" style={{ marginRight: '8px' }}></i>
                Tải tài liệu đã ký về máy
              </a>
            </div>
          )}

          <div style={{ marginTop: '20px' }}>
            <button
              onClick={() => window.close()}
              style={styles.closeBtn}
            >
              Đóng trang này
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Render loading state
  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loadingCard}>
          <i className="fas fa-spinner fa-spin" style={{ fontSize: '48px', color: '#6366f1' }}></i>
          <p style={{ marginTop: '16px', color: '#6b7280' }}>Đang tải tài liệu...</p>
        </div>
      </div>
    );
  }

  // Render error state
  if (error && !request) {
    return (
      <div style={styles.container}>
        <div style={styles.errorCard}>
          <i className="fas fa-exclamation-triangle" style={{ fontSize: '48px', color: '#ef4444' }}></i>
          <h2 style={{ marginTop: '16px', color: '#ef4444' }}>Lỗi</h2>
          <p style={{ color: '#6b7280' }}>{error}</p>
        </div>
      </div>
    );
  }

  // Render login/register form if needed
  if (needsAuth && !user) {
    return (
      <div style={styles.container}>
        <div style={styles.authCard}>
          <h2 style={styles.authTitle}>Đăng nhập hoặc Đăng ký</h2>
          <p style={styles.authText}>
            Để ký tài liệu "{document?.title}"
          </p>
          <AuthForm
            onLogin={handleLogin}
            onRegister={handleRegister}
            error={error}
            successMessage={successMessage}
            initialEmail={urlEmail}
          />
        </div>
      </div>
    );
  }

  return (
    <div style={styles.pageContainer}>
      {/* Header */}
      <header style={styles.header}>
        <div style={styles.headerContent}>
          <h1 style={styles.logo}>
            <i className="fas fa-file-signature" style={{ marginRight: '10px' }}></i>
            DocsOps E-Signature
          </h1>
          {user && (
            <div style={styles.userInfo}>
              <span>{user.email}</span>
            </div>
          )}
        </div>
      </header>

      {/* Main content */}
      <main style={styles.main}>
        {/* Document info */}
        <div style={styles.docInfo}>
          <h2 style={styles.docTitle}>
            <i className="fas fa-file-pdf" style={{ color: '#ef4444', marginRight: '10px' }}></i>
            {document?.title || 'Tài liệu cần ký'}
          </h2>
          {request?.message && (
            <p style={styles.docMessage}>
              <i className="fas fa-comment" style={{ marginRight: '8px' }}></i>
              {request.message}
            </p>
          )}
          {request?.expires_at && (
            <p style={styles.docExpiry}>
              <i className="fas fa-clock" style={{ marginRight: '8px' }}></i>
              Hạn chót: {new Date(request.expires_at).toLocaleDateString('vi-VN')}
            </p>
          )}

          <div style={{ ...styles.docMessage, backgroundColor: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0', marginTop: '10px' }}>
            <i className="fas fa-user-circle" style={{ marginRight: '8px' }}></i>
            Tạo bởi: <strong>{request?.creator?.email || 'Không tìm thấy email người tạo'}</strong>
          </div>
        </div>

        <div style={styles.contentGrid}>
          {/* PDF Preview */}
          <div style={styles.previewSection}>
            <div style={styles.previewHeader}>
              <span>📄 Xem trước tài liệu - Kéo thả chữ ký để chọn vị trí</span>
              <span>Trang {currentPage}/{totalPages}</span>
            </div>

            <div style={styles.canvasContainer} ref={containerRef}>
              <canvas ref={canvasRef} style={styles.canvas}></canvas>

              {/* Signature overlay */}
              {selectedSignature && (
                <div
                  onMouseDown={handleDragStart}
                  onTouchStart={handleDragStart}
                  style={{
                    position: 'absolute',
                    left: signaturePosition.x,
                    top: signaturePosition.y,
                    width: signatureSize.width,
                    height: signatureSize.height,
                    border: isDragging ? '2px dashed #6366f1' : '2px solid #6366f1',
                    backgroundColor: 'rgba(255, 255, 255, 0.)', // Transparent but draggable
                    cursor: 'move',
                    zIndex: 10,
                    userSelect: 'none'
                  }}
                >
                  <img
                    src={selectedSignature.image_url}
                    alt="Signature"
                    style={{ width: '100%', height: '100%', objectFit: 'contain', pointerEvents: 'none' }}
                  />

                  {/* Resize handle */}
                  <div
                    onMouseDown={handleResizeStart}
                    onTouchStart={handleResizeStart}
                    style={{
                      position: 'absolute',
                      right: -6,
                      bottom: -6,
                      width: 12,
                      height: 12,
                      backgroundColor: 'white',
                      border: '2px solid #6366f1',
                      borderRadius: '50%',
                      cursor: 'nwse-resize',
                      zIndex: 11
                    }}
                  />
                </div>
              )}
            </div>

            {/* Page navigation */}
            <div style={styles.pageNav}>
              <button
                onClick={() => { setCurrentPage(p => Math.max(1, p - 1)); if (pdfDoc) renderPage(pdfDoc, currentPage - 1); }}
                disabled={currentPage <= 1}
                style={styles.navBtn}
              >
                ← Trang trước
              </button>
              <span>Trang {currentPage} / {totalPages}</span>
              <button
                onClick={() => { setCurrentPage(p => Math.min(totalPages, p + 1)); if (pdfDoc) renderPage(pdfDoc, currentPage + 1); }}
                disabled={currentPage >= totalPages}
                style={styles.navBtn}
              >
                Trang sau →
              </button>
            </div>
          </div>

          {/* Signing panel */}
          <div style={styles.signPanel}>
            <h3 style={styles.panelTitle}>✍️ Ký tài liệu</h3>

            {error && (
              <div style={styles.errorMessage}>
                <i className="fas fa-exclamation-circle"></i> {error}
              </div>
            )}

            {/* Select signature */}
            <div style={styles.section}>
              <label style={styles.label}>Chọn chữ ký của bạn</label>
              {signatures.length > 0 ? (
                <div style={styles.signatureList}>
                  {signatures.map(sig => (
                    <div
                      key={sig.id}
                      onClick={() => setSelectedSignature(sig)}
                      style={{
                        ...styles.signatureItem,
                        borderColor: selectedSignature?.id === sig.id ? '#6366f1' : '#e5e7eb'
                      }}
                    >
                      <img src={sig.image_url} alt="Signature" style={{ height: '40px' }} />
                      {sig.is_default && <span style={styles.defaultBadge}>Mặc định</span>}
                    </div>
                  ))}
                </div>
              ) : (
                <p style={styles.noSignatures}>
                  Bạn chưa có chữ ký. <a href="/signatures" target="_blank">Tạo chữ ký mới</a>
                </p>
              )}
            </div>

            {/* PIN input */}
            <div style={styles.section}>
              <label style={styles.label}>Mã PIN xác thực</label>
              <input
                type="password"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="Nhập mã PIN"
                maxLength={6}
                style={styles.pinInput}
              />
            </div>

            {/* Sign button */}
            <button
              onClick={handleSignDocument}
              disabled={isSigning || !selectedSignature}
              style={{
                ...styles.signBtn,
                opacity: isSigning || !selectedSignature ? 0.6 : 1
              }}
            >
              {isSigning ? (
                <>
                  <i className="fas fa-spinner fa-spin"></i> Đang ký...
                </>
              ) : (
                <>
                  <i className="fas fa-signature"></i> Ký tài liệu
                </>
              )}
            </button>

            <p style={styles.legalNote}>
              Bằng cách ký tài liệu này, bạn đồng ý rằng chữ ký điện tử có giá trị pháp lý tương đương với chữ ký tay.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
};


// Simple Auth form (Login + Register) - chỉ cần email và mật khẩu
const AuthForm = ({ onLogin, onRegister, error, successMessage, initialEmail }) => {
  const [email, setEmail] = useState(initialEmail || '');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isRegister, setIsRegister] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    if (isRegister) {
      await onRegister(email, password);
    } else {
      await onLogin(email, password);
    }
    setLoading(false);
  };

  return (
    <form onSubmit={handleSubmit} style={styles.loginForm}>
      {error && (
        <div style={styles.errorMessage}>{error}</div>
      )}

      {successMessage && (
        <div style={styles.successMessage}>{successMessage}</div>
      )}

      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email"
        required
        style={styles.input}
      />

      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Mật khẩu (tối thiểu 6 ký tự)"
        required
        minLength={6}
        style={styles.input}
      />

      <button type="submit" disabled={loading} style={styles.loginBtn}>
        {loading ? 'Đang xử lý...' : (isRegister ? 'Đăng ký' : 'Đăng nhập')}
      </button>

      <p style={{ textAlign: 'center', marginTop: '16px', fontSize: '14px', color: '#6b7280' }}>
        {isRegister ? 'Đã có tài khoản? ' : 'Chưa có tài khoản? '}
        <button
          type="button"
          onClick={() => setIsRegister(!isRegister)}
          style={{ background: 'none', border: 'none', color: '#6366f1', cursor: 'pointer', fontWeight: '600' }}
        >
          {isRegister ? 'Đăng nhập' : 'Đăng ký ngay'}
        </button>
      </p>
    </form>
  );
};

// Styles
const styles = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f3f4f6',
    padding: '20px'
  },
  pageContainer: {
    minHeight: '100vh',
    backgroundColor: '#f3f4f6'
  },
  header: {
    background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
    color: 'white',
    padding: '16px 24px'
  },
  headerContent: {
    maxWidth: '1400px',
    margin: '0 auto',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  logo: {
    margin: 0,
    fontSize: '20px',
    fontWeight: '600'
  },
  userInfo: {
    fontSize: '14px',
    opacity: 0.9
  },
  main: {
    maxWidth: '1400px',
    margin: '0 auto',
    padding: '24px'
  },
  docInfo: {
    backgroundColor: 'white',
    padding: '24px',
    borderRadius: '12px',
    marginBottom: '24px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
  },
  docTitle: {
    margin: '0 0 12px 0',
    fontSize: '24px',
    fontWeight: '600',
    color: '#1f2937'
  },
  docMessage: {
    margin: '8px 0',
    color: '#6b7280',
    fontSize: '14px'
  },
  docExpiry: {
    margin: '8px 0',
    color: '#f59e0b',
    fontSize: '14px'
  },
  contentGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 400px',
    gap: '24px'
  },
  previewSection: {
    backgroundColor: 'white',
    borderRadius: '12px',
    overflow: 'hidden',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
  },
  previewHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '12px 16px',
    backgroundColor: '#e5e7eb',
    fontSize: '14px',
    fontWeight: '500'
  },
  canvasContainer: {
    position: 'relative',
    padding: '16px',
    backgroundColor: '#374151',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '600px'
  },
  canvas: {
    backgroundColor: 'white',
    boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
  },
  pageNav: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '16px',
    padding: '12px',
    backgroundColor: '#e5e7eb'
  },
  navBtn: {
    padding: '8px 16px',
    backgroundColor: 'white',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '13px'
  },
  signPanel: {
    backgroundColor: 'white',
    borderRadius: '12px',
    padding: '24px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    height: 'fit-content'
  },
  panelTitle: {
    margin: '0 0 20px 0',
    fontSize: '18px',
    fontWeight: '600',
    color: '#1f2937'
  },
  section: {
    marginBottom: '20px'
  },
  label: {
    display: 'block',
    fontSize: '14px',
    fontWeight: '500',
    color: '#374151',
    marginBottom: '8px'
  },
  signatureList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px'
  },
  signatureItem: {
    padding: '12px',
    border: '2px solid #e5e7eb',
    borderRadius: '8px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    transition: 'border-color 0.2s'
  },
  defaultBadge: {
    fontSize: '11px',
    backgroundColor: '#fef3c7',
    color: '#d97706',
    padding: '2px 8px',
    borderRadius: '10px'
  },
  noSignatures: {
    fontSize: '14px',
    color: '#6b7280',
    textAlign: 'center',
    padding: '20px'
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
  signBtn: {
    width: '100%',
    padding: '16px',
    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
    color: 'white',
    border: 'none',
    borderRadius: '10px',
    cursor: 'pointer',
    fontWeight: '600',
    fontSize: '16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '10px'
  },
  legalNote: {
    marginTop: '16px',
    fontSize: '12px',
    color: '#9ca3af',
    textAlign: 'center'
  },
  loadingCard: {
    backgroundColor: 'white',
    padding: '60px',
    borderRadius: '16px',
    textAlign: 'center',
    boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
  },
  errorCard: {
    backgroundColor: 'white',
    padding: '60px',
    borderRadius: '16px',
    textAlign: 'center',
    boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
  },
  successCard: {
    backgroundColor: 'white',
    padding: '60px',
    borderRadius: '16px',
    textAlign: 'center',
    boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
    maxWidth: '500px'
  },
  successIcon: {
    marginBottom: '24px'
  },
  successTitle: {
    margin: '0 0 16px 0',
    fontSize: '24px',
    fontWeight: '600',
    color: '#10b981'
  },
  successText: {
    margin: '8px 0',
    color: '#6b7280',
    fontSize: '14px'
  },
  closeBtn: {
    marginTop: '24px',
    padding: '12px 24px',
    backgroundColor: '#f3f4f6',
    color: '#374151',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '14px'
  },
  authCard: {
    backgroundColor: 'white',
    padding: '40px',
    borderRadius: '16px',
    textAlign: 'center',
    boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
    maxWidth: '400px',
    width: '100%'
  },
  authTitle: {
    margin: '0 0 8px 0',
    fontSize: '20px',
    fontWeight: '600',
    color: '#1f2937'
  },
  authText: {
    margin: '0 0 24px 0',
    color: '#6b7280',
    fontSize: '14px'
  },
  loginForm: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px'
  },
  input: {
    padding: '12px',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    fontSize: '14px'
  },
  loginBtn: {
    padding: '14px',
    background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontWeight: '500',
    fontSize: '14px'
  },
  errorMessage: {
    backgroundColor: '#fef2f2',
    border: '1px solid #fecaca',
    color: '#dc2626',
    padding: '12px',
    borderRadius: '8px',
    fontSize: '14px',
    marginBottom: '16px',
    textAlign: 'left'
  },
  successMessage: {
    backgroundColor: '#f0fdf4',
    border: '1px solid #bbf7d0',
    color: '#16a34a',
    padding: '12px',
    borderRadius: '8px',
    fontSize: '14px',
    marginBottom: '16px',
    textAlign: 'left'
  },
  authTabs: {
    display: 'flex',
    marginBottom: '20px'
  },
  authTab: {
    flex: 1,
    padding: '12px',
    background: 'none',
    border: 'none',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s'
  }
};

export default SignDocumentPage;
