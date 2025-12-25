import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import { useAuth } from '../contexts/AuthContext';
import { documentAPI } from '../lib/api';
import '../styles/dashboard.css';

const DashboardLayout = ({ children }) => {
    const { userProfile, user, signOut, loading } = useAuth();
    const navigate = useNavigate();
    const [showDropdown, setShowDropdown] = useState(false);

    const [showNotificationDropdown, setShowNotificationDropdown] = useState(false);

    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [showSearchResults, setShowSearchResults] = useState(false);
    const [isSearching, setIsSearching] = useState(false);

    const [notifications, setNotifications] = useState([]);
    const [loadingNotifications, setLoadingNotifications] = useState(false);
    const notificationsRef = useRef([]); // Ref để lưu notifications hiện tại cho việc so sánh
    const dropdownRef = useRef(null);
    const notificationRef = useRef(null);


    const searchRef = useRef(null);
    const searchTimeoutRef = useRef(null);
    
    // Nếu đang loading hoặc chưa có profile, hiển thị loading
    if (loading || !userProfile) {
        return (
            <div style={{ 
                display: 'flex', 
                justifyContent: 'center', 
                alignItems: 'center', 
                height: '100vh',
                fontSize: '16px',
                color: 'var(--text-light)'
            }}>
                <div style={{ textAlign: 'center' }}>
                    <i className="fas fa-spinner fa-spin" style={{ fontSize: '24px', marginBottom: '10px', display: 'block' }}></i>
                    Đang tải...
                </div>
            </div>
        );
    }
    
    const displayName = userProfile?.full_name || user?.email || 'User';
    const userEmail = user?.email || '';
    const avatarUrl = userProfile?.avatar_url || null;
    const initials = displayName
        .split(' ')
        .map(n => n[0])
        .join('')
        .toUpperCase()
        .substring(0, 2);


    // Load notifications
    const loadNotifications = useCallback(async (silent = false) => {
        if (!user) return;
        
        if (!silent) {
            setLoadingNotifications(true);
        }
        try {
            const result = await documentAPI.getNotifications();
            console.log('[loadNotifications] Full API result:', result);
            console.log('[loadNotifications] User:', user?.id, user?.email);
            
            // Parse response - response structure: { success: true, data: { notifications: [...] } }
            let notifs = [];
            if (result && result.data) {
                notifs = result.data.notifications || [];
            }
            
            console.log('[loadNotifications] Parsed notifications:', notifs.length, 'notifications');
            if (notifs.length > 0) {
                console.log('[loadNotifications] First notification:', notifs[0]);
                console.log('[loadNotifications] All notifications:', notifs);
            } else {
                console.warn('[loadNotifications] No notifications found!');
                console.warn('[loadNotifications] Result structure:', result);
            }
            
            // So sánh với notifications hiện tại để chỉ update khi có thay đổi
            if (silent && notificationsRef.current.length > 0) {
                const currentNotifsMap = new Map(notificationsRef.current.map(n => [n.id, n]));
                const newNotifsMap = new Map(notifs.map(n => [n.id, n]));
                
                // Kiểm tra xem có thay đổi không:
                // 1. Số lượng thay đổi (có notification mới hoặc bị xóa)
                // 2. Có notification mới (id không tồn tại trong current)
                // 3. Có notification bị xóa (id không tồn tại trong notifs mới)
                // 4. Các trường quan trọng thay đổi (processing, notification)
                const hasNewNotifications = notifs.some(newNotif => !currentNotifsMap.has(newNotif.id));
                const hasDeletedNotifications = notificationsRef.current.some(oldNotif => !newNotifsMap.has(oldNotif.id));
                const hasChangedFields = notifs.some(newNotif => {
                    const oldNotif = currentNotifsMap.get(newNotif.id);
                    return oldNotif && (
                        oldNotif.processing !== newNotif.processing ||
                        oldNotif.notification !== newNotif.notification
                    );
                });
                
                const hasChanges = notifs.length !== notificationsRef.current.length || 
                    hasNewNotifications || 
                    hasDeletedNotifications || 
                    hasChangedFields;
                
                // Chỉ update state khi có thay đổi
                if (hasChanges) {
                    console.log('Notifications changed:', { 
                        hasNewNotifications, 
                        hasDeletedNotifications, 
                        hasChangedFields,
                        oldCount: notificationsRef.current.length,
                        newCount: notifs.length
                    });
                    setNotifications(notifs);
                    notificationsRef.current = notifs;
                } else {
                    console.log('[loadNotifications] No changes detected, skipping update');
                }
            } else {
                // Lần load đầu tiên hoặc không silent: luôn update
                console.log('[loadNotifications] Initial load or force update, setting notifications');
                setNotifications(notifs);
                notificationsRef.current = notifs;
            }
        } catch (error) {
            console.error('Error loading notifications:', error);
            if (!silent) {
                setNotifications([]);
                notificationsRef.current = [];
            }
        } finally {
            if (!silent) {
                setLoadingNotifications(false);
            }
        }
    }, [user]);

    // Load notifications khi component mount
    useEffect(() => {
        if (!user) {
            console.log('[useEffect] No user, clearing notifications');
            setNotifications([]);
            notificationsRef.current = [];
            return;
        }
        
        console.log('[useEffect] User found, loading notifications. User ID:', user.id);
        
        // Load lần đầu (có loading indicator) - force update
        loadNotifications(false);
        
        // Polling notifications mỗi 3 giây (silent - không loading)
        const interval = setInterval(() => {
            console.log('[Polling] Checking for new notifications...');
            loadNotifications(true); // Silent update - luôn load để kiểm tra thay đổi
        }, 15000);
        
        return () => {
            console.log('[useEffect] Cleaning up notification polling');
            clearInterval(interval);
        };
    }, [user, loadNotifications]);


    // Đóng dropdown khi click outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setShowDropdown(false);
            }

            if (notificationRef.current && !notificationRef.current.contains(event.target)) {
                setShowNotificationDropdown(false);
            }

            if (searchRef.current && !searchRef.current.contains(event.target)) {
                setShowSearchResults(false);
            }
        };


        if (showDropdown || showNotificationDropdown || showSearchResults) {

            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };

    }, [showDropdown, showNotificationDropdown, showSearchResults]);


    // Search documents với debounce
    const performSearch = useCallback(async (query) => {
        if (!query || query.trim().length === 0) {
            setSearchResults([]);
            setShowSearchResults(false);
            return;
        }

        setIsSearching(true);
        try {
            const result = await documentAPI.searchDocuments(query);

            const documents = (result.data?.documents || []).filter(doc => doc.status !== 'deleted');

            setSearchResults(documents);
            setShowSearchResults(documents.length > 0);
        } catch (error) {
            console.error('Search error:', error);
            setSearchResults([]);
            setShowSearchResults(false);
        } finally {
            setIsSearching(false);
        }
    }, []);

    // Debounce search
    useEffect(() => {
        if (searchTimeoutRef.current) {
            clearTimeout(searchTimeoutRef.current);
        }

        if (searchQuery.trim().length > 0) {
            searchTimeoutRef.current = setTimeout(() => {
                performSearch(searchQuery);
            }, 300); // 300ms debounce
        } else {
            setSearchResults([]);
            setShowSearchResults(false);
        }

        return () => {
            if (searchTimeoutRef.current) {
                clearTimeout(searchTimeoutRef.current);
            }
        };
    }, [searchQuery, performSearch]);

    // Handle search input change
    const handleSearchChange = (e) => {
        setSearchQuery(e.target.value);
    };

    // Handle click on search result
    const handleSearchResultClick = (document) => {
        if (document.storage_path) {
            const fileUrl = `https://rtdqjujwbaotbvuioawp.supabase.co/storage/v1/object/public/${document.storage_path}`;
            window.open(fileUrl, '_blank');
        }
        setShowSearchResults(false);
        setSearchQuery('');
    };


    // Handle notification click - mark all as read
    const handleNotificationClick = useCallback(async () => {
        if (showNotificationDropdown) {
            // Nếu đang mở, đóng lại
            setShowNotificationDropdown(false);
        } else {
            // Nếu đang đóng, mở ra và đánh dấu tất cả là đã đọc
            setShowNotificationDropdown(true);
            
            // Đánh dấu tất cả là đã đọc
            const unreadCount = notifications.filter(n => n.processing === 'sent').length;
            if (unreadCount > 0) {
                try {
                    await documentAPI.markAllNotificationsAsRead();
                    // Reload notifications để cập nhật (force reload)
                    await loadNotifications(false);
                } catch (error) {
                    console.error('Error marking notifications as read:', error);
                }
            }
        }
    }, [showNotificationDropdown, notifications, loadNotifications]);

    // Format time for notifications
    const formatNotificationTime = (dateString) => {
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

    const unreadCount = notifications.filter(n => n.processing === 'sent').length;


    const handleLogout = async () => {
        try {
            // Navigate về trang chủ TRƯỚC khi signOut để tránh redirect qua login
            navigate('/', { replace: true });
            // Sau đó mới signOut
            await signOut();
        } catch (error) {
            console.error('Logout error:', error);
            // Nếu có lỗi, vẫn đảm bảo navigate về trang chủ
            navigate('/', { replace: true });
        }
    };

    return (
        <div className="app-container">
            <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
            <main className="main-content">
                <header className="top-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px', flex: 1 }}>
                        <button 
                            className="mobile-menu-btn"
                            onClick={() => setSidebarOpen(!sidebarOpen)}
                            aria-label="Toggle menu"
                        >
                            <i className="fas fa-bars"></i>
                        </button>
                        <div className="search-box" ref={searchRef} style={{ position: 'relative' }}>
                            <i className="fas fa-search" style={{color: '#94a3b8'}}></i>
                            <input 
                                type="text" 
                                placeholder="Tìm kiếm tài liệu, hợp đồng..." 
                                value={searchQuery}
                                onChange={handleSearchChange}
                                onFocus={() => {
                                    if (searchResults.length > 0) {
                                        setShowSearchResults(true);
                                    }
                                }}
                            />
                            {isSearching && (
                                <i className="fas fa-spinner fa-spin" style={{
                                    position: 'absolute',
                                    right: '12px',
                                    color: '#94a3b8',
                                    fontSize: '14px'
                                }}></i>
                            )}
                            {showSearchResults && searchResults.length > 0 && (
                                <div style={{
                                    position: 'absolute',
                                    top: '100%',
                                    left: 0,
                                    right: 0,
                                    marginTop: '8px',
                                    backgroundColor: 'white',
                                    borderRadius: '8px',
                                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                                    border: '1px solid #e2e8f0',
                                    maxHeight: '400px',
                                    overflowY: 'auto',
                                    zIndex: 1000,
                                }}>
                                    {searchResults.map((doc) => (
                                        <div
                                            key={doc.id}
                                            onClick={() => handleSearchResultClick(doc)}
                                            style={{
                                                padding: '12px 16px',
                                                cursor: 'pointer',
                                                borderBottom: '1px solid #f1f5f9',
                                                transition: 'background 0.2s',
                                            }}
                                            onMouseEnter={(e) => {
                                                e.currentTarget.style.backgroundColor = '#f8fafc';
                                            }}
                                            onMouseLeave={(e) => {
                                                e.currentTarget.style.backgroundColor = 'white';
                                            }}
                                        >
                                            <div style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '12px',
                                            }}>
                                                <i className="fas fa-file" style={{
                                                    color: '#3b82f6',
                                                    fontSize: '18px',
                                                    flexShrink: 0,
                                                }}></i>
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <div style={{
                                                        fontWeight: 500,
                                                        fontSize: '14px',
                                                        color: '#1e293b',
                                                        marginBottom: '4px',
                                                        overflow: 'hidden',
                                                        textOverflow: 'ellipsis',
                                                        whiteSpace: 'nowrap',
                                                    }}>
                                                        {doc.title || 'Không có tiêu đề'}
                                                    </div>
                                                    {doc.description && (
                                                        <div style={{
                                                            fontSize: '12px',
                                                            color: '#64748b',
                                                            overflow: 'hidden',
                                                            textOverflow: 'ellipsis',
                                                            whiteSpace: 'nowrap',
                                                        }}>
                                                            {doc.description}
                                                        </div>
                                                    )}
                                                </div>
                                                <i className="fas fa-external-link-alt" style={{
                                                    color: '#94a3b8',
                                                    fontSize: '12px',
                                                    flexShrink: 0,
                                                }}></i>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="user-menu">
                        <div className="notification" ref={notificationRef} style={{ position: 'relative' }}>
                            <div 
                                onClick={handleNotificationClick}
                                style={{ 
                                    cursor: 'pointer', 
                                    position: 'relative',
                                    padding: '8px',
                                    borderRadius: '8px',
                                    transition: 'background 0.2s',
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.backgroundColor = '#f1f5f9';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.backgroundColor = 'transparent';
                                }}
                            >
                                <i className="fas fa-bell" style={{fontSize: '20px', color: '#64748b'}}></i>
                                {unreadCount > 0 && (
                                    <span style={{
                                        position: 'absolute',
                                        top: '0',
                                        right: '0',
                                        backgroundColor: '#ef4444',
                                        color: 'white',
                                        borderRadius: '10px',
                                        padding: '2px 6px',
                                        fontSize: '10px',
                                        fontWeight: 'bold',
                                        minWidth: '18px',
                                        textAlign: 'center',
                                        lineHeight: '14px',
                                    }}>
                                        {unreadCount > 99 ? '99+' : unreadCount}
                                    </span>
                                )}
                            </div>
                            {showNotificationDropdown && (
                                <div style={{
                                    position: 'absolute',
                                    top: 'calc(100% + 10px)',
                                    right: 0,
                                    width: '400px',
                                    maxHeight: '600px',
                                    backgroundColor: 'white',
                                    borderRadius: '12px',
                                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                                    border: '1px solid #e2e8f0',
                                    zIndex: 1000,
                                    overflow: 'hidden',
                                    display: 'flex',
                                    flexDirection: 'column',
                                }}>
                                    <div style={{
                                        padding: '16px',
                                        borderBottom: '1px solid #e2e8f0',
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        backgroundColor: '#f8fafc',
                                    }}>
                                        <h3 style={{
                                            margin: 0,
                                            fontSize: '16px',
                                            fontWeight: 600,
                                            color: '#1e293b',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '8px',
                                        }}>
                                            <i className="fas fa-bell" style={{ fontSize: '14px', color: '#64748b' }}></i>
                                            Thông báo
                                        </h3>
                                        {unreadCount > 0 && (
                                            <span style={{
                                                fontSize: '12px',
                                                color: '#3b82f6',
                                                fontWeight: 600,
                                                backgroundColor: '#dbeafe',
                                                padding: '4px 10px',
                                                borderRadius: '12px',
                                            }}>
                                                {unreadCount} chưa đọc
                                            </span>
                                        )}
                                    </div>
                                    <div style={{
                                        overflowY: 'auto',
                                        maxHeight: '500px',
                                        overflowX: 'hidden',
                                    }}>
                                        {loadingNotifications ? (
                                            <div style={{
                                                padding: '40px',
                                                textAlign: 'center',
                                                color: '#64748b',
                                            }}>
                                                <i className="fas fa-spinner fa-spin" style={{ fontSize: '20px' }}></i>
                                            </div>
                                        ) : notifications.length === 0 ? (
                                            <div style={{
                                                padding: '40px',
                                                textAlign: 'center',
                                                color: '#64748b',
                                            }}>
                                                <i className="fas fa-bell-slash" style={{ fontSize: '24px', marginBottom: '8px', opacity: 0.5 }}></i>
                                                <p style={{ margin: 0, fontSize: '14px' }}>Chưa có thông báo</p>
                                            </div>
                                        ) : (
                                            notifications.map((notif) => {
                                                const isUnread = notif.processing === 'sent';
                                                return (
                                                    <div
                                                        key={notif.id}
                                                        style={{
                                                            padding: '14px 16px',
                                                            borderBottom: '1px solid #f1f5f9',
                                                            backgroundColor: isUnread ? '#eff6ff' : 'white', // Màu nền đậm hơn cho chưa đọc
                                                            cursor: 'pointer',
                                                            transition: 'background 0.2s',
                                                            borderLeft: isUnread ? '3px solid #3b82f6' : '3px solid transparent',
                                                        }}
                                                        onMouseEnter={(e) => {
                                                            e.currentTarget.style.backgroundColor = isUnread ? '#dbeafe' : '#f8fafc';
                                                        }}
                                                        onMouseLeave={(e) => {
                                                            e.currentTarget.style.backgroundColor = isUnread ? '#eff6ff' : 'white';
                                                        }}
                                                    >
                                                        <div style={{
                                                            display: 'flex',
                                                            gap: '12px',
                                                            alignItems: 'flex-start',
                                                        }}>
                                                            <div style={{
                                                                width: '10px',
                                                                height: '10px',
                                                                borderRadius: '50%',
                                                                backgroundColor: isUnread ? '#3b82f6' : 'transparent',
                                                                marginTop: '6px',
                                                                flexShrink: 0,
                                                                boxShadow: isUnread ? '0 0 0 2px rgba(59, 130, 246, 0.2)' : 'none',
                                                            }}></div>
                                                            <div style={{ flex: 1, minWidth: 0, wordWrap: 'break-word', overflowWrap: 'break-word' }}>
                                                                <p style={{
                                                                    margin: 0,
                                                                    fontSize: '14px',
                                                                    color: isUnread ? '#1e40af' : '#1e293b', // Màu chữ đậm hơn cho chưa đọc
                                                                    lineHeight: '1.6',
                                                                    fontWeight: isUnread ? 600 : 400, // Font đậm hơn cho chưa đọc
                                                                    wordBreak: 'break-word',
                                                                    whiteSpace: 'normal',
                                                                    overflow: 'visible',
                                                                }}>
                                                                    {notif.notification || 'Thông báo'}
                                                                </p>
                                                                <p style={{
                                                                    margin: '6px 0 0 0',
                                                                    fontSize: '12px',
                                                                    color: isUnread ? '#475569' : '#64748b',
                                                                    fontWeight: isUnread ? 500 : 400,
                                                                    whiteSpace: 'nowrap',
                                                                }}>
                                                                    {formatNotificationTime(notif.created_at)}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="user-profile-container" ref={dropdownRef}>
                            <div 
                                className="user-profile" 
                                onClick={() => setShowDropdown(!showDropdown)}
                                style={{ cursor: 'pointer' }}
                            >
                                {avatarUrl ? (
                                    <img 
                                        src={avatarUrl} 
                                        alt={displayName}
                                        style={{
                                            width: '36px',
                                            height: '36px',
                                            borderRadius: '50%',
                                            objectFit: 'cover',
                                            marginRight: '10px'
                                        }}
                                        onError={(e) => {
                                            // Nếu ảnh lỗi, ẩn img và hiển thị initials
                                            e.target.style.display = 'none';
                                            const initialsDiv = e.target.nextElementSibling;
                                            if (initialsDiv) {
                                                initialsDiv.style.display = 'flex';
                                            }
                                        }}
                                    />
                                ) : null}
                                <div 
                                    className="avatar" 
                                    style={{ display: avatarUrl ? 'none' : 'flex' }}
                                >
                                    {initials}
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                                    <span style={{ fontWeight: 500, fontSize: '14px' }}>{displayName}</span>
                                    {userEmail && (
                                        <span style={{ fontSize: '12px', color: '#94a3b8' }}>{userEmail}</span>
                                    )}
                                </div>
                                <i className="fas fa-chevron-down" style={{fontSize: '12px', color: '#94a3b8'}}></i>
                            </div>
                            {showDropdown && (
                                <div className="user-dropdown">
                                    <div 
                                        className="dropdown-item" 
                                        onClick={() => {
                                            navigate('/profile');
                                            setShowDropdown(false);
                                        }}
                                        style={{ cursor: 'pointer' }}
                                    >
                                        <i className="fas fa-user" style={{ marginRight: '8px' }}></i>
                                        <span>Thông tin tài khoản</span>
                                    </div>
                                    <div className="dropdown-item">
                                        <i className="fas fa-cog" style={{ marginRight: '8px' }}></i>
                                        <span>Cài đặt</span>
                                    </div>
                                    <div className="dropdown-divider"></div>
                                    <div className="dropdown-item" onClick={handleLogout} style={{ color: '#ef4444', cursor: 'pointer' }}>
                                        <i className="fas fa-sign-out-alt" style={{ marginRight: '8px' }}></i>
                                        <span>Đăng xuất</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </header>
                {children}
            </main>
        </div>
    );
};

export default DashboardLayout;



