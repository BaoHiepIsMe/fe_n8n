/**
 * InsertSignatureModal Component
 * 
 * Modal để chèn chữ ký vào tài liệu PDF với các tính năng:
 * - Upload PDF và preview
 * - AI Detection để tìm vị trí ký tự động
 * - Chọn chữ ký từ danh sách của user
 * - Drag & Drop để điều chỉnh vị trí
 * - Insert và lưu tài liệu đã ký
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import * as pdfjsLib from 'pdfjs-dist';

// Set worker source
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';
const N8N_URL = import.meta.env.VITE_N8N_URL || 'https://n8n.docsops.me';

const InsertSignatureModal = ({ isOpen, onClose, onSuccess }) => {
  // State for PDF
  const [pdfDoc, setPdfDoc] = useState(null);
  const [pdfData, setPdfData] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [currentScale, setCurrentScale] = useState(1.0);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [currentDocumentId, setCurrentDocumentId] = useState(null);
  
  // State for signature
  const [signatures, setSignatures] = useState([]);
  const [selectedSignature, setSelectedSignature] = useState(null);
  const [signaturePosition, setSignaturePosition] = useState({ x: 350, y: 700 });
  const [signatureSize, setSignatureSize] = useState({ width: 120, height: 60 });
  const [positionPreset, setPositionPreset] = useState('bottom-right');
  
  // State for AI Detection
  const [aiDetectedPositions, setAiDetectedPositions] = useState([]);
  const [isDetecting, setIsDetecting] = useState(false);
  
  // State for drag
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  
  // State for UI
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [step, setStep] = useState(1); // 1: Upload, 2: AI Detect, 3: Select Signature, 4: Send Request
  const [pin, setPin] = useState('');
  const [uploadStatus, setUploadStatus] = useState('idle'); // idle, uploading, success, error
  const [uploadMessage, setUploadMessage] = useState('');
  
  // State for sending signature request
  const [signedDocumentResult, setSignedDocumentResult] = useState(null);
  const [signatories, setSignatories] = useState([{ email: '', name: '', order: 1 }]);
  const [requestMessage, setRequestMessage] = useState('Vui lòng ký vào tài liệu này.');
  const [deadline, setDeadline] = useState('');
  const [sendingRequest, setSendingRequest] = useState(false);
  
  // Refs
  const canvasRef = useRef(null);
  const overlayRef = useRef(null);
  const containerRef = useRef(null);
  
  // Get access token
  const getAccessToken = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token;
  };

  // Handle PDF upload
  const handlePdfUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setError('File phải có đuôi .pdf');
      return;
    }
    
    if (file.size > 10 * 1024 * 1024) {
      setError('File quá lớn (tối đa 10MB)');
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const arrayBuffer = await file.arrayBuffer();
      const header = new Uint8Array(arrayBuffer.slice(0, 5));
      const headerString = String.fromCharCode(...header);
      
      if (headerString !== '%PDF-') {
        throw new Error('File không phải PDF hợp lệ');
      }
      
      const pdfDataArray = new Uint8Array(arrayBuffer);
      setPdfData(pdfDataArray);
      setUploadedFile(file);
      
      // Load PDF for preview
      const loadingTask = pdfjsLib.getDocument({ data: pdfDataArray });
      const pdf = await loadingTask.promise;
      
      setPdfDoc(pdf);
      setTotalPages(pdf.numPages);
      setCurrentPage(1);
      
      // Render first page
      await renderPage(pdf, 1);
      
      // Upload to storage and create document record
      setUploadStatus('uploading');
      setUploadMessage('Đang upload file lên server...');
      
      const uploadSuccess = await uploadToStorageAndCreateRecord(file);
      
      if (uploadSuccess) {
        setUploadStatus('success');
        setUploadMessage('✅ File đã được upload thành công! Bạn có thể sử dụng AI Detection.');
        setStep(2);
      } else {
        setUploadStatus('error');
        setUploadMessage('⚠️ Không thể upload file lên server. Vui lòng thử lại.');
      }
    } catch (err) {
      console.error('PDF Load Error:', err);
      setError(err.message || 'Không thể tải PDF');
      setUploadStatus('error');
      setUploadMessage('');
    } finally {
      setLoading(false);
    }
  };
  
  // Upload to storage and create document record
  const uploadToStorageAndCreateRecord = async (file) => {
    const token = await getAccessToken();
    if (!token) {
      setUploadMessage('⚠️ Bạn cần đăng nhập để upload file');
      return false;
    }
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setUploadMessage('⚠️ Không tìm thấy thông tin người dùng');
        return false;
      }
      
      setUploadMessage('📤 Đang upload file lên storage...');
      
      // Upload to storage
      const formData = new FormData();
      formData.append('files', file);
      
      const uploadRes = await fetch(`${API_BASE_URL}/documents/upload-to-queue`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });
      
      const uploadResult = await uploadRes.json();
      if (!uploadRes.ok) {
        throw new Error(uploadResult.message || 'Upload to storage failed');
      }
      
      const uploadedDoc = uploadResult.data.uploaded[0];
      setUploadMessage('📝 Đang tạo document record...');
      
      // Create document record
      const createRes = await fetch(`${API_BASE_URL}/e-signature-ext/internal/create-test-request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': import.meta.env.VITE_API_KEY || 'your-api-key'
        },
        body: JSON.stringify({
          fileName: uploadedDoc.name,
          filePath: uploadedDoc.file_path,
          fileType: uploadedDoc.mime_type,
          fileSize: uploadedDoc.size,
          userId: user.id,
          title: file.name
        })
      });
      
      const createResult = await createRes.json();
      if (createRes.ok && createResult.data) {
        setCurrentDocumentId(createResult.data.document.id);
        console.log('Document created with ID:', createResult.data.document.id);
        return true;
      } else {
        throw new Error(createResult.message || 'Failed to create document record');
      }
    } catch (err) {
      console.error('Upload error:', err);
      setUploadMessage(`⚠️ Lỗi: ${err.message}`);
      return false;
    }
  };
  
  const [pdfScale, setPdfScale] = useState(1);

  // Render PDF page - auto fit vào container
  const renderPage = async (pdf, pageNum) => {
    if (!pdf || !canvasRef.current || !containerRef.current) return;
    
    try {
      const page = await pdf.getPage(pageNum);
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      const container = containerRef.current;
      
      // Lấy kích thước container (trừ padding)
      const containerWidth = container.clientWidth - 32; // padding 16px mỗi bên
      const containerHeight = container.clientHeight - 32;
      
      // Lấy kích thước gốc của page (scale 1)
      const originalViewport = page.getViewport({ scale: 1 });
      
      // Tính scale để fit vào container (giữ tỷ lệ A4)
      const scaleX = containerWidth / originalViewport.width;
      const scaleY = containerHeight / originalViewport.height;
      const fitScale = Math.min(scaleX, scaleY, 2.2); // max 2.2 để preview lớn hơn
      
      setPdfScale(fitScale); // Lưu scale factor
      
      // Áp dụng scale
      const viewport = page.getViewport({ scale: fitScale });
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      await page.render({
        canvasContext: ctx,
        viewport: viewport
      }).promise;
      
      console.log(`Rendered page ${pageNum} at scale ${fitScale.toFixed(2)}`);
    } catch (err) {
      console.error('Render error:', err);
    }
  };
  
  // AI Detection
  const detectSignaturePositions = async () => {
    if (!currentDocumentId) {
      setError('Vui lòng upload PDF trước');
      return;
    }
    
    setIsDetecting(true);
    setError(null);
    
    try {
      const res = await fetch(`${N8N_URL}/webhook/e-signature/ai-detect-positions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId: currentDocumentId })
      });
      
      const result = await res.json();
      
      if (result.success) {
        const positions = result.detectedPositions || [];
        setAiDetectedPositions(positions);
        
        // Nếu chưa có chữ ký nào được chọn, tự động load
        if (!selectedSignature) {
          await loadSignatures();
        }
        
        // Auto apply first position và hiển thị chữ ký lên preview
        if (positions.length > 0) {
          const firstPos = positions[0];
          
          // Set position
          setSignaturePosition({ x: firstPos.x || 350, y: firstPos.y || 700 });
          setSignatureSize({ width: firstPos.width || 120, height: firstPos.height || 60 });
          setPositionPreset('custom');
          
          // Navigate to the page where signature is needed
          const targetPage = firstPos.page || 1;
          if (targetPage !== currentPage) {
            setCurrentPage(targetPage);
            if (pdfDoc) {
              await renderPage(pdfDoc, targetPage);
            }
          }
          
          console.log(`AI phát hiện ${positions.length} vị trí. Áp dụng vị trí đầu tiên: Trang ${targetPage}, X=${firstPos.x}, Y=${firstPos.y}`);
        }
        
        setStep(3); // Chuyển sang bước chọn chữ ký và preview
      } else {
        throw new Error(result.message || 'AI detection failed');
      }
    } catch (err) {
      console.error('AI Detection error:', err);
      setError(err.message);
    } finally {
      setIsDetecting(false);
    }
  };
  
  // Apply detected position
  const applyPosition = (pos) => {
    setSignaturePosition({ x: pos.x || 350, y: pos.y || 700 });
    setSignatureSize({ width: pos.width || 120, height: pos.height || 60 });
    setPositionPreset('custom');
    
    if (pos.page && pos.page !== currentPage) {
      setCurrentPage(pos.page);
      if (pdfDoc) renderPage(pdfDoc, pos.page);
    }
  };
  
  // Load user signatures - trả về signature được chọn
  const loadSignatures = async () => {
    const token = await getAccessToken();
    if (!token) return null;
    
    try {
      const res = await fetch(`${API_BASE_URL}/e-signature-ext/user-signature/my-signatures`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      const result = await res.json();
      if (res.ok && result.data && result.data.length > 0) {
        setSignatures(result.data);
        
        // Auto select default signature
        const defaultSig = result.data.find(s => s.is_default);
        const selectedSig = defaultSig || result.data[0];
        
        setSelectedSignature(selectedSig);
        console.log('Đã chọn chữ ký mặc định:', selectedSig?.metadata?.label || 'Chữ ký');
        
        return selectedSig;
      }
      return null;
    } catch (err) {
      console.error('Load signatures error:', err);
      return null;
    }
  };
  
  // Calculate position based on preset
  const calculatePresetPosition = (preset, canvasWidth, canvasHeight) => {
    const padding = 50;
    const { width, height } = signatureSize;
    
    switch (preset) {
      case 'bottom-right':
        return { x: canvasWidth - width - padding, y: canvasHeight - height - padding };
      case 'bottom-left':
        return { x: padding, y: canvasHeight - height - padding };
      case 'top-right':
        return { x: canvasWidth - width - padding, y: padding };
      case 'top-left':
        return { x: padding, y: padding };
      case 'center':
        return { x: (canvasWidth - width) / 2, y: (canvasHeight - height) / 2 };
      default:
        return signaturePosition;
    }
  };
  
  // Handle drag start
  const handleDragStart = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    
    const clientX = e.clientX || e.touches?.[0]?.clientX;
    const clientY = e.clientY || e.touches?.[0]?.clientY;
    
    // Lưu offset chính xác từ điểm click đến vị trí hiện tại của signature
    setDragStart({ 
      x: clientX - signaturePosition.x, 
      y: clientY - signaturePosition.y 
    });
  };
  
  // Handle drag move
  const handleDragMove = useCallback((e) => {
    if (!isDragging) return;
    
    const clientX = e.clientX || e.touches?.[0]?.clientX;
    const clientY = e.clientY || e.touches?.[0]?.clientY;
    
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    
    // Lấy vị trí của canvas trong container
    const canvasRect = canvas.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    
    // Tính offset của canvas so với container (do padding)
    const canvasOffsetX = canvasRect.left - containerRect.left;
    const canvasOffsetY = canvasRect.top - containerRect.top;
    
    // Tính vị trí mới dựa trên vị trí mouse và offset ban đầu
    let newX = clientX - dragStart.x;
    let newY = clientY - dragStart.y;
    
    // Kích thước thực của canvas (hiển thị, không phải resolution)
    const displayWidth = canvasRect.width;
    const displayHeight = canvasRect.height;
    
    // Constrain trong phạm vi canvas
    // Min là vị trí góc trái trên của canvas
    // Max là góc phải dưới trừ đi kích thước signature
    const minX = canvasOffsetX;
    const minY = canvasOffsetY;
    const maxX = canvasOffsetX + displayWidth - signatureSize.width;
    const maxY = canvasOffsetY + displayHeight - signatureSize.height;
    
    newX = Math.max(minX, Math.min(newX, maxX));
    newY = Math.max(minY, Math.min(newY, maxY));
    
    setSignaturePosition({ x: newX, y: newY });
  }, [isDragging, dragStart, signatureSize]);
  
  // Handle drag end
  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
  }, []);
  
  // Insert signature into PDF
  const insertSignature = async () => {
    if (!selectedSignature) {
      setError('Vui lòng chọn chữ ký');
      return;
    }
    
    if (!pin || pin.length < 4) {
      setError('Vui lòng nhập mã PIN (ít nhất 4 ký tự)');
      return;
    }
    
    if (!uploadedFile) {
      setError('Không tìm thấy file PDF');
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const token = await getAccessToken();
      
      // Tính toán tọa độ chuẩn hóa trên PDF gốc
      const canvas = canvasRef.current;
      const container = containerRef.current;
      let pdfX = 0;
      let pdfY = 0;
      
      if (canvas && container) {
        const canvasRect = canvas.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        
        // Offset của canvas so với container
        const canvasOffsetX = canvasRect.left - containerRect.left;
        const canvasOffsetY = canvasRect.top - containerRect.top;
        
        // Tọa độ relative to canvas (pixel trên màn hình)
        const relativeX = signaturePosition.x - canvasOffsetX;
        const relativeY = signaturePosition.y - canvasOffsetY;
        
        // Chuyển đổi sang tọa độ gốc của PDF (chia cho scale)
        pdfX = relativeX / pdfScale;
        pdfY = relativeY / pdfScale;
        
        console.log('Coords calculation:', {
          signaturePos: signaturePosition,
          canvasOffset: { x: canvasOffsetX, y: canvasOffsetY },
          relative: { x: relativeX, y: relativeY },
          scale: pdfScale,
          result: { x: pdfX, y: pdfY }
        });
      }
      
      const formData = new FormData();
      formData.append('pdfFile', uploadedFile);
      formData.append('signatureId', selectedSignature.id);
      formData.append('pageNumber', currentPage);
      formData.append('position', 'custom');
      formData.append('x', Math.round(pdfX));
      formData.append('y', Math.round(pdfY));
      formData.append('width', Math.round(signatureSize.width / pdfScale)); // Scale cả kích thước chữ ký
      formData.append('height', Math.round(signatureSize.height / pdfScale));
      formData.append('pin', pin);
      
      const res = await fetch(`${API_BASE_URL}/e-signature-ext/user-signature/insert-signature-to-pdf`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });
      
      const result = await res.json();
      
      if (!res.ok) {
        throw new Error(result.message || 'Không thể chèn chữ ký');
      }
      
      // Lưu kết quả và chuyển sang bước gửi yêu cầu
      setSignedDocumentResult(result);
      setStep(4); // Chuyển sang bước gửi yêu cầu ký
      
    } catch (err) {
      console.error('Insert signature error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  
  // Add signatory
  const addSignatory = () => {
    setSignatories([...signatories, { email: '', name: '', order: signatories.length + 1 }]);
  };
  
  // Remove signatory
  const removeSignatory = (index) => {
    if (signatories.length > 1) {
      const newSignatories = signatories.filter((_, i) => i !== index);
      // Reorder
      setSignatories(newSignatories.map((s, i) => ({ ...s, order: i + 1 })));
    }
  };
  
  // Update signatory
  const updateSignatory = (index, field, value) => {
    const newSignatories = [...signatories];
    newSignatories[index] = { ...newSignatories[index], [field]: value };
    setSignatories(newSignatories);
  };
  
  // Send signature request to others
  const sendSignatureRequest = async () => {
    // Validate signatories
    const validSignatories = signatories.filter(s => s.email && s.email.includes('@'));
    if (validSignatories.length === 0) {
      setError('Vui lòng nhập ít nhất một email người ký hợp lệ');
      return;
    }
    
    setSendingRequest(true);
    setError(null);
    
    try {
      const token = await getAccessToken();
      
      console.log('Signed Result:', signedDocumentResult);
      const documentId = signedDocumentResult?.data?.document?.id || currentDocumentId;
      console.log('Using Document ID for Request:', documentId);
      
      if (!documentId) {
        throw new Error('Missing Document ID');
      }
      
      // Bước 1: Tạo signature request trong database
      const createRes = await fetch(`${API_BASE_URL}/e-signature/signature-requests`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          documentId: documentId,
          signers: validSignatories.map(s => ({
            signerEmail: s.email,
            signerName: s.name || s.email.split('@')[0],
            orderIndex: s.order
          })),
          message: requestMessage,
          expiresAt: deadline ? new Date(deadline).toISOString() : null
        })
      });
      
      const createResult = await createRes.json();
      
      if (!createRes.ok || !createResult.success) {
        throw new Error(createResult.message || 'Không thể tạo yêu cầu ký');
      }
      
      const requestId = createResult.data?.id;
      
      // Bước 2: Trigger n8n workflow 1 để gửi email
      const sendRes = await fetch(`${N8N_URL}/webhook/e-signature/send-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId: requestId
        })
      });
      
      const sendResult = await sendRes.json();
      
      if (sendResult.success || sendRes.ok) {
        // Success - thông báo và đóng modal
        if (onSuccess) {
          onSuccess({
            ...signedDocumentResult,
            signatureRequestSent: true,
            signatories: validSignatories,
            requestId: requestId
          });
        }
        onClose();
      } else {
        throw new Error(sendResult.message || 'Không thể gửi email yêu cầu ký');
      }
    } catch (err) {
      console.error('Send request error:', err);
      setError(err.message);
    } finally {
      setSendingRequest(false);
    }
  };
  
  // Skip sending request - just close
  const skipSendRequest = () => {
    if (onSuccess) {
      onSuccess(signedDocumentResult);
    }
    onClose();
  };
  
  // Effects
  useEffect(() => {
    if (isOpen) {
      loadSignatures();
    }
  }, [isOpen]);
  
  useEffect(() => {
    if (pdfDoc) {
      renderPage(pdfDoc, currentPage);
    }
  }, [pdfDoc, currentPage, currentScale]);
  
  useEffect(() => {
    if (positionPreset !== 'custom' && canvasRef.current) {
      const pos = calculatePresetPosition(positionPreset, canvasRef.current.width, canvasRef.current.height);
      setSignaturePosition(pos);
    }
  }, [positionPreset]);
  
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleDragMove);
      document.addEventListener('mouseup', handleDragEnd);
      document.addEventListener('touchmove', handleDragMove);
      document.addEventListener('touchend', handleDragEnd);
    }
    
    return () => {
      document.removeEventListener('mousemove', handleDragMove);
      document.removeEventListener('mouseup', handleDragEnd);
      document.removeEventListener('touchmove', handleDragMove);
      document.removeEventListener('touchend', handleDragEnd);
    };
  }, [isDragging, handleDragMove, handleDragEnd]);
  
  // Reset on close
  const handleClose = () => {
    setPdfDoc(null);
    setPdfData(null);
    setUploadedFile(null);
    setCurrentDocumentId(null);
    setSelectedSignature(null);
    setAiDetectedPositions([]);
    setStep(1);
    setPin('');
    setError(null);
    setUploadStatus('idle');
    setUploadMessage('');
    setSignedDocumentResult(null);
    setSignatories([{ email: '', name: '', order: 1 }]);
    setRequestMessage('Vui lòng ký vào tài liệu này.');
    setDeadline('');
    onClose();
  };
  
  if (!isOpen) return null;
  
  return (
    <div className="modal-overlay" style={styles.overlay}>
      <div className="modal-content" style={styles.modal}>
        {/* Header */}
        <div style={styles.header}>
          <h2 style={styles.title}>
            <i className="fas fa-pen-nib" style={{ marginRight: '10px' }}></i>
            Tạo luồng chữ ký mới
          </h2>
          <button onClick={handleClose} style={styles.closeBtn}>×</button>
        </div>
        
        {/* Steps indicator */}
        <div style={styles.steps}>
          {['Upload PDF', 'AI Detect', 'Ký tài liệu', 'Gửi yêu cầu'].map((s, i) => (
            <div 
              key={i} 
              style={{
                ...styles.step,
                backgroundColor: step > i + 1 ? '#10b981' : step === i + 1 ? '#6366f1' : '#e5e7eb',
                color: step >= i + 1 ? 'white' : '#6b7280'
              }}
            >
              {i + 1}. {s}
            </div>
          ))}
        </div>
        
        {/* Error display */}
        {error && (
          <div style={styles.error}>
            <i className="fas fa-exclamation-circle"></i> {error}
          </div>
        )}
        
        {/* Content */}
        <div style={styles.content}>
          {/* Step 1: Upload PDF */}
          {step === 1 && (
            <div style={styles.uploadSection}>
              <div style={styles.uploadBox}>
                <i className="fas fa-cloud-upload-alt" style={{ fontSize: '48px', color: '#6366f1', marginBottom: '16px' }}></i>
                <p style={{ marginBottom: '16px', color: '#6b7280' }}>Chọn file PDF để ký</p>
                <input 
                  type="file" 
                  accept=".pdf" 
                  onChange={handlePdfUpload}
                  style={{ display: 'none' }}
                  id="pdf-upload"
                />
                <label htmlFor="pdf-upload" style={styles.uploadBtn}>
                  <i className="fas fa-file-pdf"></i> Chọn file PDF
                </label>
                <p style={{ fontSize: '12px', color: '#9ca3af', marginTop: '12px' }}>Tối đa 10MB</p>
              </div>
            </div>
          )}
          
          {/* Step 2+: PDF Preview + Controls */}
          {step >= 2 && (
            <div style={styles.mainContent}>
              {/* Left: PDF Preview */}
              <div style={styles.previewPanel}>
                <div style={styles.previewHeader}>
                  <span>📄 {uploadedFile?.name}</span>
                  <span>Trang {currentPage}/{totalPages}</span>
                </div>
                
                <div style={styles.canvasContainer} ref={containerRef}>
                  <canvas ref={canvasRef} style={styles.canvas}></canvas>
                  
                  {/* Signature overlay */}
                  {selectedSignature && (
                    <div 
                      ref={overlayRef}
                      style={{
                        ...styles.signatureOverlay,
                        left: signaturePosition.x,
                        top: signaturePosition.y,
                        width: signatureSize.width,
                        height: signatureSize.height,
                        cursor: isDragging ? 'grabbing' : 'grab'
                      }}
                      onMouseDown={handleDragStart}
                      onTouchStart={handleDragStart}
                    >
                      <img 
                        src={selectedSignature.image_url} 
                        alt="Signature" 
                        style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                      />
                      <div style={styles.dragHint}>Kéo để di chuyển</div>
                    </div>
                  )}
                </div>
                
                {/* Page navigation */}
                <div style={styles.pageNav}>
                  <button 
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage <= 1}
                    style={styles.navBtn}
                  >
                    ← Trang trước
                  </button>
                  <span>Trang {currentPage} / {totalPages}</span>
                  <button 
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage >= totalPages}
                    style={styles.navBtn}
                  >
                    Trang sau →
                  </button>
                </div>
              </div>
              
              {/* Right: Controls */}
              <div style={styles.controlPanel}>
                {/* Upload Status Message */}
                {step === 2 && uploadMessage && (
                  <div style={{
                    ...styles.section,
                    backgroundColor: uploadStatus === 'success' ? '#ecfdf5' : 
                                     uploadStatus === 'error' ? '#fef2f2' : 
                                     uploadStatus === 'uploading' ? '#eff6ff' : '#f9fafb',
                    borderColor: uploadStatus === 'success' ? '#10b981' : 
                                 uploadStatus === 'error' ? '#ef4444' : 
                                 uploadStatus === 'uploading' ? '#3b82f6' : '#e5e7eb'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {uploadStatus === 'uploading' && <i className="fas fa-spinner fa-spin" style={{ color: '#3b82f6' }}></i>}
                      {uploadStatus === 'success' && <i className="fas fa-check-circle" style={{ color: '#10b981' }}></i>}
                      {uploadStatus === 'error' && <i className="fas fa-exclamation-circle" style={{ color: '#ef4444' }}></i>}
                      <span style={{ 
                        fontSize: '14px', 
                        fontWeight: '500',
                        color: uploadStatus === 'success' ? '#059669' : 
                               uploadStatus === 'error' ? '#dc2626' : 
                               uploadStatus === 'uploading' ? '#2563eb' : '#374151'
                      }}>
                        {uploadMessage}
                      </span>
                    </div>
                    {currentDocumentId && (
                      <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '8px' }}>
                        Document ID: {currentDocumentId.substring(0, 8)}...
                      </p>
                    )}
                  </div>
                )}

                {/* AI Detection */}
                {step === 2 && (
                  <div style={styles.section}>
                    <h3 style={styles.sectionTitle}>🤖 AI Phát hiện vị trí</h3>
                    <p style={{ fontSize: '14px', color: '#6b7280', marginBottom: '16px' }}>
                      AI sẽ phân tích PDF và tìm các vị trí cần chữ ký
                    </p>
                    <button 
                      onClick={detectSignaturePositions}
                      disabled={isDetecting || uploadStatus !== 'success' || !currentDocumentId}
                      style={{
                        ...styles.primaryBtn,
                        opacity: (uploadStatus !== 'success' || !currentDocumentId) ? 0.5 : 1,
                        cursor: (uploadStatus !== 'success' || !currentDocumentId) ? 'not-allowed' : 'pointer'
                      }}
                    >
                      {isDetecting ? (
                        <>
                          <i className="fas fa-spinner fa-spin"></i> Đang phân tích...
                        </>
                      ) : uploadStatus !== 'success' ? (
                        <>
                          <i className="fas fa-clock"></i> Đang chờ upload hoàn tất...
                        </>
                      ) : (
                        <>
                          <i className="fas fa-magic"></i> AI Detect Signature Positions
                        </>
                      )}
                    </button>
                    
                    {uploadStatus !== 'success' && (
                      <p style={{ fontSize: '12px', color: '#f59e0b', marginTop: '8px', textAlign: 'center' }}>
                        ⚠️ Vui lòng đợi file được upload lên database trước khi sử dụng AI
                      </p>
                    )}
                    
                    <button 
                      onClick={() => setStep(3)}
                      style={{ ...styles.secondaryBtn, marginTop: '12px' }}
                      disabled={uploadStatus !== 'success'}
                    >
                      Bỏ qua AI, chọn thủ công →
                    </button>
                  </div>
                )}
                
                {/* AI Detected Positions */}
                {step >= 3 && aiDetectedPositions.length > 0 && (
                  <div style={styles.section}>
                    <h3 style={styles.sectionTitle}>📍 Vị trí AI phát hiện</h3>
                    <div style={styles.positionsList}>
                      {aiDetectedPositions.map((pos, idx) => (
                        <div 
                          key={idx}
                          onClick={() => applyPosition(pos)}
                          style={styles.positionItem}
                        >
                          <span>Trang {pos.page || 1}</span>
                          <span style={{ fontSize: '12px', color: '#6b7280' }}>{pos.reason}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Signature Selection */}
                {step >= 3 && (
                  <div style={styles.section}>
                    <h3 style={styles.sectionTitle}>✍️ Chọn chữ ký</h3>
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
                          <img src={sig.image_url} alt="Signature" style={{ height: '40px', objectFit: 'contain' }} />
                          <span style={{ fontSize: '12px' }}>{sig.metadata?.label || 'Chữ ký'}</span>
                          {sig.is_default && <span style={styles.defaultBadge}>Mặc định</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Position controls */}
                {step >= 3 && selectedSignature && (
                  <div style={styles.section}>
                    <h3 style={styles.sectionTitle}>📍 Vị trí</h3>
                    <select 
                      value={positionPreset}
                      onChange={e => setPositionPreset(e.target.value)}
                      style={styles.select}
                    >
                      <option value="bottom-right">Góc dưới phải</option>
                      <option value="bottom-left">Góc dưới trái</option>
                      <option value="top-right">Góc trên phải</option>
                      <option value="top-left">Góc trên trái</option>
                      <option value="center">Giữa trang</option>
                      <option value="custom">Tùy chỉnh (kéo thả)</option>
                    </select>
                    
                    <div style={styles.sizeInputs}>
                      <div>
                        <label style={styles.label}>Rộng (px)</label>
                        <input 
                          type="number" 
                          value={signatureSize.width}
                          onChange={e => setSignatureSize(s => ({ ...s, width: parseInt(e.target.value) || 150 }))}
                          style={styles.input}
                        />
                      </div>
                      <div>
                        <label style={styles.label}>Cao (px)</label>
                        <input 
                          type="number" 
                          value={signatureSize.height}
                          onChange={e => setSignatureSize(s => ({ ...s, height: parseInt(e.target.value) || 75 }))}
                          style={styles.input}
                        />
                      </div>
                    </div>
                  </div>
                )}
                
                {/* PIN input */}
                {step >= 3 && selectedSignature && (
                  <div style={styles.section}>
                    <h3 style={styles.sectionTitle}>🔐 Xác thực</h3>
                    <input 
                      type="password"
                      placeholder="Nhập mã PIN"
                      value={pin}
                      onChange={e => setPin(e.target.value)}
                      maxLength={6}
                      style={styles.pinInput}
                    />
                    <p style={{ fontSize: '12px', color: '#9ca3af', marginTop: '8px' }}>
                      Nhập mã PIN để xác nhận ký tài liệu
                    </p>
                  </div>
                )}
                
                {/* Action buttons for step 3 */}
                {step === 3 && (
                  <div style={styles.actions}>
                    <button 
                      onClick={handleClose}
                      style={styles.cancelBtn}
                    >
                      Hủy
                    </button>
                    <button 
                      onClick={insertSignature}
                      disabled={!selectedSignature || !pin || loading}
                      style={{
                        ...styles.submitBtn,
                        opacity: !selectedSignature || !pin || loading ? 0.5 : 1
                      }}
                    >
                      {loading ? (
                        <>
                          <i className="fas fa-spinner fa-spin"></i> Đang xử lý...
                        </>
                      ) : (
                        <>
                          <i className="fas fa-check"></i> Ký & Tiếp tục
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
          
          {/* Step 4: Send Signature Request */}
          {step === 4 && (
            <div style={styles.sendRequestContainer}>
              {/* Success message */}
              <div style={styles.successBanner}>
                <i className="fas fa-check-circle" style={{ fontSize: '48px', marginBottom: '16px' }}></i>
                <h3 style={{ margin: '0 0 8px 0', fontSize: '20px' }}>Ký tài liệu thành công!</h3>
                <p style={{ margin: 0, opacity: 0.9 }}>Bạn có thể gửi yêu cầu ký cho người khác hoặc kết thúc.</p>
              </div>
              
              <div style={styles.sendRequestContent}>
                <h3 style={styles.sectionTitle}>📧 Gửi yêu cầu ký cho người khác</h3>
                
                {/* Signatories list */}
                <div style={styles.signatoriesSection}>
                  <label style={styles.label}>Người ký</label>
                  {signatories.map((sig, index) => (
                    <div key={index} style={styles.signatoryRow}>
                      <span style={styles.signatoryOrder}>{index + 1}</span>
                      <input
                        type="email"
                        placeholder="Email *"
                        value={sig.email}
                        onChange={(e) => updateSignatory(index, 'email', e.target.value)}
                        style={{ ...styles.input, flex: 2 }}
                      />
                      <input
                        type="text"
                        placeholder="Tên (tùy chọn)"
                        value={sig.name}
                        onChange={(e) => updateSignatory(index, 'name', e.target.value)}
                        style={{ ...styles.input, flex: 1 }}
                      />
                      {signatories.length > 1 && (
                        <button
                          onClick={() => removeSignatory(index)}
                          style={styles.removeSignatoryBtn}
                        >
                          <i className="fas fa-times"></i>
                        </button>
                      )}
                    </div>
                  ))}
                  <button onClick={addSignatory} style={styles.addSignatoryBtn}>
                    <i className="fas fa-plus"></i> Thêm người ký
                  </button>
                </div>
                
                {/* Message */}
                <div style={styles.field}>
                  <label style={styles.label}>Lời nhắn (tùy chọn)</label>
                  <textarea
                    value={requestMessage}
                    onChange={(e) => setRequestMessage(e.target.value)}
                    placeholder="Nhập lời nhắn cho người ký..."
                    style={styles.textarea}
                    rows={3}
                  />
                </div>
                
                {/* Deadline */}
                <div style={styles.field}>
                  <label style={styles.label}>Hạn chót (tùy chọn)</label>
                  <input
                    type="date"
                    value={deadline}
                    onChange={(e) => setDeadline(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    style={styles.input}
                  />
                </div>
                
                {/* Action buttons */}
                <div style={styles.actions}>
                  <button 
                    onClick={skipSendRequest}
                    style={styles.skipBtn}
                  >
                    Bỏ qua, kết thúc
                  </button>
                  <button 
                    onClick={sendSignatureRequest}
                    disabled={sendingRequest}
                    style={{
                      ...styles.sendRequestBtn,
                      opacity: sendingRequest ? 0.7 : 1
                    }}
                  >
                    {sendingRequest ? (
                      <>
                        <i className="fas fa-spinner fa-spin"></i> Đang gửi...
                      </>
                    ) : (
                      <>
                        <i className="fas fa-paper-plane"></i> Gửi yêu cầu ký
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
        
        {/* Loading overlay */}
        {loading && (
          <div style={styles.loadingOverlay}>
            <div style={styles.spinner}></div>
            <p>Đang xử lý...</p>
          </div>
        )}
      </div>
    </div>
  );
};

// Styles
const styles = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    zIndex: 9999,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backdropFilter: 'blur(4px)',
    padding: '20px'
  },
  modal: {
    backgroundColor: 'white',
    borderRadius: '16px',
    width: '100%',
    maxWidth: '1200px',
    maxHeight: '90vh',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '20px 24px',
    borderBottom: '1px solid #e5e7eb',
    background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
    color: 'white'
  },
  title: {
    margin: 0,
    fontSize: '20px',
    fontWeight: '600'
  },
  closeBtn: {
    background: 'rgba(255,255,255,0.2)',
    border: 'none',
    fontSize: '28px',
    cursor: 'pointer',
    color: 'white',
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  steps: {
    display: 'flex',
    gap: '8px',
    padding: '16px 24px',
    backgroundColor: '#f9fafb',
    borderBottom: '1px solid #e5e7eb'
  },
  step: {
    padding: '8px 16px',
    borderRadius: '20px',
    fontSize: '13px',
    fontWeight: '500',
    transition: 'all 0.2s'
  },
  error: {
    margin: '16px 24px 0',
    padding: '12px 16px',
    backgroundColor: '#fef2f2',
    border: '1px solid #fecaca',
    borderRadius: '8px',
    color: '#dc2626',
    fontSize: '14px'
  },
  content: {
    flex: 1,
    overflow: 'auto',
    padding: '24px'
  },
  uploadSection: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '400px'
  },
  uploadBox: {
    textAlign: 'center',
    padding: '48px',
    border: '2px dashed #d1d5db',
    borderRadius: '16px',
    backgroundColor: '#f9fafb'
  },
  uploadBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    padding: '12px 24px',
    background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
    color: 'white',
    borderRadius: '8px',
    cursor: 'pointer',
    fontWeight: '500',
    fontSize: '14px'
  },
  mainContent: {
    display: 'grid',
    gridTemplateColumns: '1fr 350px',
    gap: '24px'
  },
  previewPanel: {
    backgroundColor: '#f9fafb',
    borderRadius: '12px',
    overflow: 'hidden'
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
    height: '800px', // Chiều cao lớn hơn để preview A4 rõ ràng
    overflow: 'hidden' // Không scroll
  },
  canvas: {
    backgroundColor: 'white',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
  },
  signatureOverlay: {
    position: 'absolute',
    border: '2px solid #6366f1',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    padding: '4px',
    borderRadius: '4px',
    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
    zIndex: 10,
    touchAction: 'none'
  },
  dragHint: {
    position: 'absolute',
    top: '-24px',
    left: '50%',
    transform: 'translateX(-50%)',
    backgroundColor: '#6366f1',
    color: 'white',
    fontSize: '10px',
    padding: '2px 8px',
    borderRadius: '4px',
    whiteSpace: 'nowrap'
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
    padding: '6px 12px',
    backgroundColor: '#f3f4f6',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '13px'
  },
  controlPanel: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px'
  },
  section: {
    backgroundColor: '#f9fafb',
    padding: '16px',
    borderRadius: '12px',
    border: '1px solid #e5e7eb'
  },
  sectionTitle: {
    margin: '0 0 12px',
    fontSize: '15px',
    fontWeight: '600',
    color: '#374151'
  },
  primaryBtn: {
    width: '100%',
    padding: '12px',
    background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontWeight: '500',
    fontSize: '14px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px'
  },
  secondaryBtn: {
    width: '100%',
    padding: '10px',
    backgroundColor: 'transparent',
    color: '#6366f1',
    border: '1px solid #6366f1',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '13px'
  },
  positionsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    maxHeight: '120px',
    overflow: 'auto'
  },
  positionItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '10px 12px',
    backgroundColor: '#e0e7ff',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '14px',
    transition: 'all 0.2s'
  },
  signatureList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    maxHeight: '150px',
    overflow: 'auto'
  },
  signatureItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '10px 12px',
    border: '2px solid #e5e7eb',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'all 0.2s',
    backgroundColor: 'white'
  },
  defaultBadge: {
    fontSize: '10px',
    backgroundColor: '#10b981',
    color: 'white',
    padding: '2px 6px',
    borderRadius: '4px',
    marginLeft: 'auto'
  },
  select: {
    width: '100%',
    padding: '10px 12px',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    fontSize: '14px',
    marginBottom: '12px'
  },
  sizeInputs: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '12px'
  },
  label: {
    display: 'block',
    fontSize: '12px',
    color: '#6b7280',
    marginBottom: '4px'
  },
  input: {
    width: '100%',
    padding: '8px 10px',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    fontSize: '14px'
  },
  pinInput: {
    width: '100%',
    padding: '12px',
    border: '2px solid #fbbf24',
    borderRadius: '8px',
    fontSize: '18px',
    textAlign: 'center',
    letterSpacing: '4px',
    fontFamily: 'monospace'
  },
  actions: {
    display: 'flex',
    gap: '12px',
    marginTop: '8px'
  },
  cancelBtn: {
    flex: 1,
    padding: '12px',
    backgroundColor: '#f3f4f6',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '14px'
  },
  submitBtn: {
    flex: 2,
    padding: '12px',
    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontWeight: '500',
    fontSize: '14px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px'
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100
  },
  spinner: {
    width: '48px',
    height: '48px',
    border: '4px solid #e5e7eb',
    borderTop: '4px solid #6366f1',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
    marginBottom: '16px'
  },
  // Step 4 styles
  sendRequestContainer: {
    padding: '0'
  },
  successBanner: {
    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
    color: 'white',
    padding: '32px',
    textAlign: 'center'
  },
  sendRequestContent: {
    padding: '24px',
    maxHeight: '500px',
    overflowY: 'auto'
  },
  signatoriesSection: {
    marginBottom: '20px'
  },
  signatoryRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '12px'
  },
  signatoryOrder: {
    width: '28px',
    height: '28px',
    backgroundColor: '#6366f1',
    color: 'white',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '12px',
    fontWeight: '600',
    flexShrink: 0
  },
  removeSignatoryBtn: {
    padding: '8px',
    backgroundColor: '#fee2e2',
    color: '#ef4444',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    flexShrink: 0
  },
  addSignatoryBtn: {
    width: '100%',
    padding: '10px',
    backgroundColor: '#f3f4f6',
    color: '#6b7280',
    border: '2px dashed #d1d5db',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '13px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    marginTop: '8px'
  },
  field: {
    marginBottom: '16px'
  },
  textarea: {
    width: '100%',
    padding: '12px',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    fontSize: '14px',
    resize: 'vertical',
    fontFamily: 'inherit'
  },
  skipBtn: {
    flex: 1,
    padding: '14px 20px',
    backgroundColor: '#f3f4f6',
    color: '#6b7280',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontWeight: '500',
    fontSize: '14px'
  },
  sendRequestBtn: {
    flex: 2,
    padding: '14px 20px',
    background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontWeight: '500',
    fontSize: '14px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px'
  }
};

export default InsertSignatureModal;
