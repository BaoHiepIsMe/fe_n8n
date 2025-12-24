import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { documentAPI } from '../lib/api';
import { useAuth } from './AuthContext';

const DocumentContext = createContext(null);

export const useDocuments = () => {
  const context = useContext(DocumentContext);
  if (!context) {
    throw new Error('useDocuments must be used within DocumentProvider');
  }
  return context;
};

export const DocumentProvider = ({ children }) => {
  const { user } = useAuth();
  const [documents, setDocuments] = useState([]);
  const [stats, setStats] = useState({
    newDocumentsThisWeek: 0,
    pendingApproval: 0,
    riskDocuments: 0,
    unprocessedDocuments: 0,
  });
  const [folderStats, setFolderStats] = useState(null);
  const [loadingDocuments, setLoadingDocuments] = useState(false);
  const [loadingStats, setLoadingStats] = useState(false);
  const [loadingFolderStats, setLoadingFolderStats] = useState(false);
  
  const documentsRef = useRef([]);
  const statsRef = useRef({});
  const folderStatsRef = useRef(null);
  const isInitializedRef = useRef(false);
  const pollingIntervalRef = useRef(null);

  // Load documents từ database (có thể silent - không hiển thị loading)
  const loadDocuments = useCallback(async (silent = false, force = false) => {
    if (!user) return;

    // Chỉ skip load khi không phải polling (silent = false) và đã có dữ liệu và không force
    // Khi silent = true (polling), luôn load để kiểm tra thay đổi
    if (!silent && !force && documentsRef.current.length > 0 && isInitializedRef.current) {
      return;
    }

    if (!silent) {
      setLoadingDocuments(true);
    }
    try {
      const result = await documentAPI.getUserDocuments();
      const docs = result.data?.documents || result.data?.data?.documents || result.documents || [];
      
      // So sánh với documents hiện tại để chỉ update khi có thay đổi
      if (silent && documentsRef.current.length > 0) {
        const currentDocsMap = new Map(documentsRef.current.map(doc => [doc.id, doc]));
        const newDocsMap = new Map(docs.map(doc => [doc.id, doc]));
        
        const hasNewDocuments = docs.some(newDoc => !currentDocsMap.has(newDoc.id));
        const hasDeletedDocuments = documentsRef.current.some(oldDoc => !newDocsMap.has(oldDoc.id));
        const hasChangedFields = docs.some(newDoc => {
          const oldDoc = currentDocsMap.get(newDoc.id);
          if (!oldDoc) return false;
          // So sánh các trường quan trọng có thể thay đổi
          return (
            oldDoc.processing !== newDoc.processing ||
            oldDoc.sensitivity_level !== newDoc.sensitivity_level ||
            oldDoc.title !== newDoc.title ||
            oldDoc.status !== newDoc.status ||
            oldDoc.update_at !== newDoc.update_at ||
            oldDoc.storage_path !== newDoc.storage_path
          );
        });
        
        const hasChanges = docs.length !== documentsRef.current.length || 
          hasNewDocuments || 
          hasDeletedDocuments || 
          hasChangedFields;
        
        // Chỉ update state khi có thay đổi
        if (hasChanges) {
          setDocuments(docs);
          documentsRef.current = docs;
        }
      } else {
        // Lần load đầu tiên hoặc không silent: luôn update
        setDocuments(docs);
        documentsRef.current = docs;
        isInitializedRef.current = true;
      }
    } catch (error) {
      console.error('Error loading documents:', error);
      if (!silent) {
        setDocuments([]);
        documentsRef.current = [];
      }
    } finally {
      if (!silent) {
        setLoadingDocuments(false);
      }
    }
  }, [user]);

  // Load dashboard stats (có thể silent - không hiển thị loading)
  const loadStats = useCallback(async (silent = false, force = false) => {
    if (!user) return;

    // Chỉ skip load khi không phải polling (silent = false) và đã có dữ liệu và không force
    // Khi silent = true (polling), luôn load để kiểm tra thay đổi
    if (!silent && !force && statsRef.current && Object.keys(statsRef.current).length > 0 && isInitializedRef.current) {
      return;
    }

    if (!silent) {
      setLoadingStats(true);
    }
    try {
      const result = await documentAPI.getDashboardStats();
      const statsData = result.data || result.data?.data || {};
      const newStats = {
        newDocumentsThisWeek: statsData.newDocumentsThisWeek || 0,
        pendingApproval: statsData.pendingApproval || 0,
        riskDocuments: statsData.riskDocuments || 0,
        unprocessedDocuments: statsData.unprocessedDocuments || 0,
      };

      // So sánh với stats hiện tại để chỉ update khi có thay đổi
      if (silent && statsRef.current && Object.keys(statsRef.current).length > 0) {
        const hasChanges = 
          statsRef.current.newDocumentsThisWeek !== newStats.newDocumentsThisWeek ||
          statsRef.current.pendingApproval !== newStats.pendingApproval ||
          statsRef.current.riskDocuments !== newStats.riskDocuments ||
          statsRef.current.unprocessedDocuments !== newStats.unprocessedDocuments;

        // Chỉ update state khi có thay đổi
        if (hasChanges) {
          setStats(newStats);
          statsRef.current = newStats;
        }
      } else {
        // Lần load đầu tiên hoặc không silent: luôn update
        setStats(newStats);
        statsRef.current = newStats;
      }
    } catch (error) {
      console.error('Error loading stats:', error);
      if (!silent) {
        setStats({
          newDocumentsThisWeek: 0,
          pendingApproval: 0,
          riskDocuments: 0,
          unprocessedDocuments: 0,
        });
        statsRef.current = {};
      }
    } finally {
      if (!silent) {
        setLoadingStats(false);
      }
    }
  }, [user]);

  // Load folder stats
  const loadFolderStats = useCallback(async (silent = false, force = false) => {
    if (!user) return;

    // Chỉ skip load khi không phải polling (silent = false) và đã có dữ liệu và không force
    // Khi silent = true (polling), luôn load để kiểm tra thay đổi
    if (!silent && !force && folderStatsRef.current && isInitializedRef.current) {
      return;
    }

    if (!silent) {
      setLoadingFolderStats(true);
    }
    try {
      const result = await documentAPI.getFolderStats();
      const stats = result.data || {};
      setFolderStats(stats);
      folderStatsRef.current = stats;
    } catch (error) {
      console.error('Error loading folder stats:', error);
      if (!silent) {
        setFolderStats(null);
        folderStatsRef.current = null;
      }
    } finally {
      if (!silent) {
        setLoadingFolderStats(false);
      }
    }
  }, [user]);

  // Refresh documents (force reload)
  const refreshDocuments = useCallback(() => {
    return loadDocuments(false, true);
  }, [loadDocuments]);

  // Refresh stats (force reload)
  const refreshStats = useCallback(() => {
    return loadStats(false, true);
  }, [loadStats]);

  // Refresh folder stats (force reload)
  const refreshFolderStats = useCallback(() => {
    return loadFolderStats(false, true);
  }, [loadFolderStats]);

  // Initialize: Load data lần đầu khi có user
  useEffect(() => {
    if (!user) {
      // Clear data khi logout
      setDocuments([]);
      setStats({
        newDocumentsThisWeek: 0,
        pendingApproval: 0,
        riskDocuments: 0,
        unprocessedDocuments: 0,
      });
      setFolderStats(null);
      documentsRef.current = [];
      statsRef.current = {};
      folderStatsRef.current = null;
      isInitializedRef.current = false;
      return;
    }

    // Load lần đầu (có loading indicator)
    const initialize = async () => {
      await Promise.all([
        loadDocuments(false, false),
        loadStats(false, false),
        loadFolderStats(false, false),
      ]);
    };
    initialize();

    // Setup polling: Tự động check changes mỗi 3 giây (silent - không loading)
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }
    pollingIntervalRef.current = setInterval(() => {
      loadDocuments(true, false); // Silent update cho documents - luôn load để kiểm tra thay đổi
      loadStats(true, false); // Silent update cho stats - luôn load để kiểm tra thay đổi
      loadFolderStats(true, false); // Silent update cho folder stats - luôn load để kiểm tra thay đổi
    }, 3000); // 3 giây - cập nhật nhanh hơn

    // Cleanup interval khi component unmount hoặc user thay đổi
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, [user, loadDocuments, loadStats, loadFolderStats]);

  const value = {
    documents,
    stats,
    folderStats,
    loadingDocuments,
    loadingStats,
    loadingFolderStats,
    loadDocuments,
    loadStats,
    loadFolderStats,
    refreshDocuments,
    refreshStats,
    refreshFolderStats,
  };

  return <DocumentContext.Provider value={value}>{children}</DocumentContext.Provider>;
};

