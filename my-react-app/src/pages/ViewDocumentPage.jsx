import React, { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import * as pdfjsLib from "pdfjs-dist";
import { supabase } from "../lib/supabase";
import "../styles/dashboard.css";

// Set worker source
pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";


const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://api.docsops.me/api/v1';


const ViewDocumentPage = () => {
  const { requestId } = useParams();

  // State
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [request, setRequest] = useState(null);
  const [document, setDocument] = useState(null);
  const [pdfDoc, setPdfDoc] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [pdfScale, setPdfScale] = useState(1);

  const [fileUrl, setFileUrl] = useState(null);


  // Refs
  const canvasRef = useRef(null);
  const containerRef = useRef(null);

  // Logic checks
  const isCompleted = request?.status === "signed";

  // Load request details
  useEffect(() => {
    if (!requestId) {
      setError("Mã yêu cầu không hợp lệ.");
      setLoading(false);
      return;
    }
    loadRequestDetails();
  }, [requestId]);

  const loadRequestDetails = async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `${API_BASE_URL}/e-signature/internal/signature-requests/${requestId}`,
        {
          headers: {
            "X-API-Key":
              import.meta.env.VITE_API_KEY || "esign-secure-api-key-2024",
          },
        }

      );


      const result = await res.json();

      if (!res.ok || !result.success) {
        throw new Error(result.message || "Không thể tải thông tin yêu cầu");
      }

      setRequest(result.data);
      setDocument(result.data.document);

      // Load PDF
      if (result.data.document?.storage_path) {
        await loadPdf(result.data.document.storage_path);
      }
    } catch (err) {
      console.error("Load request error:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadPdf = async (storagePath) => {
    try {

      const { data } = supabase.storage.from('documents').getPublicUrl(storagePath);


      if (data?.publicUrl) {
        setFileUrl(data.publicUrl);
        const loadingTask = pdfjsLib.getDocument(data.publicUrl);
        const pdf = await loadingTask.promise;
        setPdfDoc(pdf);
        setTotalPages(pdf.numPages);
        renderPage(pdf, 1);
      }
    } catch (err) {
      console.error("Load PDF error:", err);
      setError("Không thể tải tài liệu PDF");
    }
  };

  const renderPage = async (pdf, pageNum) => {
    if (!pdf || !canvasRef.current || !containerRef.current) return;

    try {
      const page = await pdf.getPage(pageNum);
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      const container = containerRef.current;

      const containerWidth = container.clientWidth - 32;

      const originalViewport = page.getViewport({ scale: 1 });
      const scaleX = containerWidth / originalViewport.width;

      const fitScale = Math.min(scaleX, 1.5); // Max scale 1.5
      setPdfScale(fitScale);

      const viewport = page.getViewport({ scale: fitScale });
      canvas.width = viewport.width;
      canvas.height = viewport.height;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      await page.render({
        canvasContext: ctx,
        viewport: viewport,
      }).promise;
    } catch (err) {
      console.error("Render error:", err);
    }
  };

  // Render loading state
  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loadingCard}>
          <i
            className="fas fa-spinner fa-spin"
            style={{ fontSize: "48px", color: "#6366f1" }}
          ></i>
          <p style={{ marginTop: "16px", color: "#6b7280" }}>
            Đang tải tài liệu...
          </p>
        </div>
      </div>
    );
  }

  // Render error state
  if (error && !request) {
    return (
      <div style={styles.container}>
        <div style={styles.errorCard}>
          <i
            className="fas fa-exclamation-triangle"
            style={{ fontSize: "48px", color: "#ef4444" }}
          ></i>
          <h2 style={{ marginTop: "16px", color: "#ef4444" }}>Lỗi</h2>
          <p style={{ color: "#6b7280" }}>{error}</p>
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
            <i className="fas fa-file-alt" style={{ marginRight: "10px" }}></i>
            DocsOps Viewer
          </h1>
        </div>
      </header>

      {/* Main content */}
      <main style={styles.main}>
        {/* Document info */}
        <div style={styles.docInfo}>
          <h2 style={styles.docTitle}>
            <i
              className="fas fa-file-pdf"
              style={{ color: "#ef4444", marginRight: "10px" }}
            ></i>
            {document?.title || "Chi tiết tài liệu"}
          </h2>
          {request?.message && (
            <p style={styles.docMessage}>
              <i className="fas fa-comment" style={{ marginRight: "8px" }}></i>
              {request.message}
            </p>
          )}
          {request?.expires_at && (
            <p style={styles.docExpiry}>
              <i className="fas fa-clock" style={{ marginRight: "8px" }}></i>
              Hạn chót:{" "}
              {new Date(request.expires_at).toLocaleDateString("vi-VN")}
            </p>
          )}

          <div
            style={{
              ...styles.docMessage,
              backgroundColor: "#f0fdf4",
              color: "#166534",
              border: "1px solid #bbf7d0",
              marginTop: "10px",
            }}
          >
            <i
              className="fas fa-user-circle"
              style={{ marginRight: "8px" }}
            ></i>
            Tạo bởi:{" "}
            <strong>
              {request?.creator?.email || "Không tìm thấy email người tạo"}
            </strong>
          </div>
        </div>

        <div style={styles.contentGrid}>
          {/* PDF Preview */}
          <div style={styles.previewSection}>
            <div style={styles.previewHeader}>
              <span>📄 Xem tài liệu</span>
              <span>
                Trang {currentPage}/{totalPages}
              </span>
            </div>

            <div style={styles.canvasContainer} ref={containerRef}>
              <canvas ref={canvasRef} style={styles.canvas}></canvas>
            </div>

            {/* Page navigation */}
            <div style={styles.pageNav}>
              <button
                onClick={() => {
                  setCurrentPage((p) => Math.max(1, p - 1));
                  if (pdfDoc) renderPage(pdfDoc, currentPage - 1);
                }}
                disabled={currentPage <= 1}
                style={styles.navBtn}
              >
                ← Trang trước
              </button>
              <span>
                Trang {currentPage} / {totalPages}
              </span>
              <button
                onClick={() => {
                  setCurrentPage((p) => Math.min(totalPages, p + 1));
                  if (pdfDoc) renderPage(pdfDoc, currentPage + 1);
                }}
                disabled={currentPage >= totalPages}
                style={styles.navBtn}
              >
                Trang sau →
              </button>
            </div>
          </div>

          {/* Info Panel */}
          <div style={styles.signPanel}>
            <div style={{ padding: "20px" }}>
              <h3 style={styles.panelTitle}>ℹ️ Thông tin tài liệu</h3>
              <div
                style={{
                  marginBottom: "20px",
                  fontSize: "14px",
                  lineHeight: "1.6",
                }}
              >
                <p>
                  <strong>Trạng thái:</strong>{" "}
                  {isCompleted ? (
                    <span style={{ color: "green", fontWeight: "bold" }}>
                      Đã hoàn thành
                    </span>
                  ) : (
                    <span style={{ color: "#d97706", fontWeight: "bold" }}>
                      Đang chờ xử lý
                    </span>
                  )}
                </p>
                <p>
                  <strong>Người tạo:</strong> {request?.creator?.email}
                </p>
                <p>
                  <strong>Ngày tạo:</strong>{" "}
                  {new Date(request?.created_at).toLocaleDateString("vi-VN")}
                </p>
              </div>

              <div style={{ marginTop: "20px" }}>
                <a
                  href={request?.signed_pdf_url || fileUrl || request?.document?.url}
                  target="_blank"
                  rel="noreferrer"
                  download
                  style={{
                    width: "100%",
                    padding: "12px 20px",
                    backgroundColor: "#4f46e5",
                    color: "white",
                    border: "none",
                    borderRadius: "8px",
                    fontSize: "14px",
                    fontWeight: "600",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "10px",
                    textDecoration: "none",
                  }}
                >
                  <i className="fas fa-download"></i> Tải tài liệu{" "}
                  {isCompleted ? "đã ký" : "gốc"}
                </a>
              </div>

              <div
                style={{
                  marginTop: "20px",
                  paddingTop: "20px",
                  borderTop: "1px solid #e5e7eb",
                }}
              >
                <h4 style={{ fontSize: "14px", marginBottom: "10px" }}>
                  Danh sách người ký:
                </h4>
                {request?.signers?.map((signer, idx) => (
                  <div
                    key={idx}
                    style={{
                      marginBottom: "8px",
                      fontSize: "13px",
                      display: "flex",
                      justifyContent: "space-between",
                    }}
                  >
                    <span>
                      {signer.signer_email} ({signer.signer_name || "N/A"})
                    </span>
                    <span
                      style={{
                        color: signer.status === "signed" ? "green" : "orange",
                        fontWeight: "500",
                      }}
                    >
                      {signer.status === "signed" ? "Đã ký" : "Chờ ký"}
                    </span>
                  </div>
                ))}
              </div>

            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

// Styles
const styles = {
  container: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f3f4f6",
    padding: "20px",
  },
  pageContainer: {
    minHeight: "100vh",
    backgroundColor: "#f3f4f6",
  },
  header: {
    background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
    color: "white",
    padding: "16px 24px",
  },
  headerContent: {
    maxWidth: "1400px",
    margin: "0 auto",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  logo: {
    margin: 0,
    fontSize: "20px",
    fontWeight: "600",
  },
  main: {
    maxWidth: "1400px",
    margin: "0 auto",
    padding: "24px",
  },
  docInfo: {
    backgroundColor: "white",
    padding: "24px",
    borderRadius: "12px",
    marginBottom: "24px",
    boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
  },
  docTitle: {
    margin: "0 0 12px 0",
    fontSize: "24px",
    fontWeight: "600",
    color: "#1f2937",
  },
  docMessage: {
    margin: "8px 0",
    color: "#6b7280",
    fontSize: "14px",
  },
  docExpiry: {
    margin: "8px 0",
    color: "#f59e0b",
    fontSize: "14px",
  },
  contentGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 400px",
    gap: "24px",
  },
  previewSection: {
    backgroundColor: "white",
    borderRadius: "12px",
    overflow: "hidden",
    boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
  },
  previewHeader: {
    display: "flex",
    justifyContent: "space-between",
    padding: "12px 16px",
    backgroundColor: "#e5e7eb",
    fontSize: "14px",
    fontWeight: "500",
  },
  canvasContainer: {
    position: "relative",
    padding: "16px",
    backgroundColor: "#374151",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    minHeight: "600px",
  },
  canvas: {
    backgroundColor: "white",
    boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
  },
  pageNav: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "16px",
    padding: "12px",
    backgroundColor: "#e5e7eb",
  },
  navBtn: {
    padding: "8px 16px",
    backgroundColor: "white",
    border: "1px solid #d1d5db",
    borderRadius: "6px",
    cursor: "pointer",
    fontSize: "13px",
  },
  signPanel: {
    backgroundColor: "white",
    borderRadius: "12px",
    padding: "24px",
    boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
    height: "fit-content",
  },
  panelTitle: {
    margin: "0 0 20px 0",
    fontSize: "18px",
    fontWeight: "600",
    color: "#1f2937",
  },
  loadingCard: {
    backgroundColor: "white",
    padding: "60px",
    borderRadius: "16px",
    textAlign: "center",
    boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
  },
  errorCard: {
    backgroundColor: "white",
    padding: "60px",
    borderRadius: "16px",
    textAlign: "center",
    boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
  },
};

export default ViewDocumentPage;
