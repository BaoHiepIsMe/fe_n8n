// /**
//  * API Client for Backend Communication
//  * 
//  * Base URL: http://localhost:3000/api/v1
//  */

// const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';

// /**
//  * Make API request với error handling
//  */
// async function apiRequest(endpoint, options = {}) {
//   const url = `${API_BASE_URL}${endpoint}`;
  
//   const config = {
//     ...options,
//     headers: {
//       'Content-Type': 'application/json',
//       ...options.headers,
//     },
//   };

//   // Nếu có access token, thêm vào header
//   // QUAN TRỌNG: Refresh token trước khi dùng để đảm bảo token còn hợp lệ
//   const { supabase } = await import('./supabase');
//   let { data: { session }, error: sessionError } = await supabase.auth.getSession();
  
//   // Nếu không có session hoặc có lỗi, thử refresh
//   if (!session || sessionError) {
//     console.log('⚠️ No session or session error, attempting to refresh...');
//     const { data: { session: refreshedSession } } = await supabase.auth.refreshSession();
//     if (refreshedSession) {
//       session = refreshedSession;
//       console.log('✅ Session refreshed successfully');
//     }
//   }
  
//   if (session?.access_token) {
//     config.headers.Authorization = `Bearer ${session.access_token}`;
//     console.log('✅ Access token added to request header');
//   } else {
//     console.warn('⚠️ No access token available for API request');
//   }

//   try {
//     const response = await fetch(url, config);
    
//     // Kiểm tra content-type trước khi parse JSON
//     const contentType = response.headers.get('content-type');
//     if (!contentType || !contentType.includes('application/json')) {
//       const text = await response.text();
//       console.error('⚠️ Response không phải JSON:', text.substring(0, 200));
//       throw new Error(`Server không trả về JSON. Status: ${response.status}`);
//     }

//     const text = await response.text();
//     if (!text) {
//       throw new Error('Response rỗng');
//     }

//     let result;
//     try {
//       result = JSON.parse(text);
//     } catch (parseError) {
//       console.error('⚠️ Lỗi parse JSON:', parseError);
//       console.error('⚠️ Response text:', text.substring(0, 500));
//       throw new Error('Lỗi parse JSON từ server');
//     }

//     if (!response.ok) {
//       throw new Error(result.message || result.error || `Request failed: ${response.status}`);
//     }

//     return result;
//   } catch (error) {
//     if (!options.silent) {
//       console.error('❌ API Request Error:', error);
//     }
//     throw error;
//   }
// }

// /**
//  * Auth API
//  */
// export const authAPI = {
//   /**
//    * Đăng ký tài khoản mới
//    */
//   register: async (email, password, full_name, company_name) => {
//     console.log('📡 Đang gọi API đăng ký:', `${API_BASE_URL}/auth/register`);
//     const result = await apiRequest('/auth/register', {
//       method: 'POST',
//       body: JSON.stringify({ email, password, full_name, company_name }),
//     });
//     console.log('✅ Đăng ký thành công');
//     return result;
//   },

//   /**
//    * Đăng nhập
//    */
//   login: async (email, password) => {
//     console.log('📡 Đang gọi API đăng nhập:', `${API_BASE_URL}/auth/login`);
//     const response = await fetch(`${API_BASE_URL}/auth/login`, {
//       method: 'POST',
//       headers: {
//         'Content-Type': 'application/json',
//       },
//       body: JSON.stringify({ email, password }),
//     });

//     console.log('📡 Response status:', response.status, response.statusText);

//     // Kiểm tra content-type
//     const contentType = response.headers.get('content-type');
//     if (!contentType || !contentType.includes('application/json')) {
//       const text = await response.text();
//       console.error('⚠️ Response không phải JSON:', text.substring(0, 200));
//       throw new Error(`Server không trả về JSON. Status: ${response.status}`);
//     }

//     const text = await response.text();
//     console.log('📡 Response text (first 500 chars):', text.substring(0, 500));

//     if (!text) {
//       throw new Error('Response rỗng');
//     }

//     let result;
//     try {
//       result = JSON.parse(text);
//       console.log('✅ Parse JSON thành công');
//     } catch (parseError) {
//       console.error('⚠️ Lỗi parse JSON:', parseError);
//       console.error('⚠️ Response text:', text.substring(0, 500));
//       throw new Error('Lỗi parse JSON từ server');
//     }

//     if (!response.ok) {
//       throw new Error(result.message || result.error || `Đăng nhập thất bại (${response.status})`);
//     }

//     return result;
//   },

//   /**
//    * Đăng xuất
//    */
//   logout: async () => {
//     return await apiRequest('/auth/logout', {
//       method: 'POST',
//     });
//   },

//   /**
//    * Lấy thông tin user hiện tại
//    */
//   getMe: async () => {
//     return await apiRequest('/auth/me');
//   },

//   /**
//    * Cập nhật thông tin profile
//    * @param {Object} data - Dữ liệu cập nhật (full_name, company_name)
//    */
//   updateProfile: async (data) => {
//     return await apiRequest('/auth/profile', {
//       method: 'PUT',
//       body: JSON.stringify(data),
//     });
//   },

//   /**
//    * Upload avatar
//    * @param {File} file - File ảnh
//    */
//   uploadAvatar: async (file) => {
//     // Convert file to base64
//     return new Promise((resolve, reject) => {
//       const reader = new FileReader();
//       reader.onload = async () => {
//         try {
//           const base64 = reader.result;
//           const result = await apiRequest('/auth/upload-avatar', {
//             method: 'POST',
//             headers: {
//               'Content-Type': 'application/json',
//             },
//             body: JSON.stringify({ avatar: base64 }),
//           });
//           resolve(result);
//         } catch (error) {
//           reject(error);
//         }
//       };
//       reader.onerror = reject;
//       reader.readAsDataURL(file);
//     });
//   },
// };

// /**
//  * Department Config API
//  */
// export const departmentConfigAPI = {
//   /**
//    * Get department configs for current user
//    */
//   getDepartmentConfigs: async () => {
//     return await apiRequest('/department-configs');
//   },

//   /**
//    * Update or create department configs
//    * @param {Array} departments - Array of { department_name, category_key, notification_email }
//    */
//   updateDepartmentConfigs: async (departments) => {
//     return await apiRequest('/department-configs', {
//       method: 'POST',
//       body: JSON.stringify({ departments }),
//     });
//   },
// };

// /**
//  * Document API
//  */
// export const documentAPI = {
//   /**
//    * Get user's documents from database
//    */
//   getUserDocuments: async () => {
//     return await apiRequest('/documents/list');
//   },

//   /**
//    * Get dashboard statistics
//    */
//   getDashboardStats: async () => {
//     return await apiRequest('/documents/stats');
//   },

//   /**
//    * Search documents by title or description
//    * @param {string} query - Search query
//    */
//   searchDocuments: async (query) => {
//     if (!query || query.trim().length === 0) {
//       return { data: { documents: [] } };
//     }
//     return await apiRequest(`/documents/search?q=${encodeURIComponent(query.trim())}`);
//   },

//   /**
//    * Get documents by category
//    * @param {string} category - Category key (hop-dong-phap-ly, tai-chinh-ke-toan, etc.)
//    */
//   getDocumentsByCategory: async (category) => {
//     return await apiRequest(`/documents/by-category?category=${encodeURIComponent(category)}`);
//   },

//   /**
//    * Get folder statistics (count by category)
//    */
//   getFolderStats: async () => {
//     return await apiRequest('/documents/folder-stats');
//   },

//   /**
//    * Delete document (soft delete - update status to deleted)
//    * @param {string} documentId - Document ID
//    */
//   deleteDocument: async (documentId) => {
//     return await apiRequest(`/documents/${documentId}`, {
//       method: 'DELETE',
//     });
//   },

//   /**
//    * Upload documents to polling queue
//    * @param {File[]} files - Array of files to upload
//    */
//   uploadToQueue: async (files) => {
//     if (!files || files.length === 0) {
//       throw new Error('Vui lòng chọn ít nhất một file');
//     }

//     // Tạo FormData để gửi files
//     const formData = new FormData();
//     files.forEach((file) => {
//       formData.append('files', file);
//     });

//     // Lấy session để có access token
//     const { supabase } = await import('./supabase');
//     const { data: { session }, error: sessionError } = await supabase.auth.getSession();

//     if (!session?.access_token) {
//       throw new Error('Bạn cần đăng nhập để upload file');
//     }

//     const url = `${API_BASE_URL}/documents/upload-to-queue`;
    
//     try {
//       const response = await fetch(url, {
//         method: 'POST',
//         headers: {
//           Authorization: `Bearer ${session.access_token}`,
//           // KHÔNG set Content-Type khi dùng FormData, browser sẽ tự set với boundary
//         },
//         body: formData,
//       });

//       const contentType = response.headers.get('content-type');
//       if (!contentType || !contentType.includes('application/json')) {
//         const text = await response.text();
//         throw new Error(`Server không trả về JSON. Status: ${response.status}`);
//       }

//       const result = await response.json();

//       if (!response.ok) {
//         throw new Error(result.message || result.error || `Upload failed: ${response.status}`);
//       }

//       return result;
//     } catch (error) {
//       console.error('Document upload error:', error);
//       throw error;
//     }
//   },

//   /**
//    * Upload file to n8n webhook và đợi response
//    * @param {File} file - File to upload
//    * @param {string} userId - User ID to send with the file
//    * @returns {Promise<{status: number, message: string, data: {phong_ban: string, ten_file: string, link_truy_cap: string}}>}
//    */
//   uploadToN8n: async (file, userId) => {
//     if (!file) {
//       throw new Error('Vui lòng chọn file');
//     }

//     if (!userId) {
//       throw new Error('User ID is required');
//     }

//     // Tạo FormData để gửi file và user ID
//     const formData = new FormData();
//     formData.append('data', file); // Sử dụng 'data' như trong code HTML của bạn
//     formData.append('id', userId);

//     const webhookUrl = `${import.meta.env.VITE_N8N_URL || 'https://n8n.docsops.me'}/webhook/upload-file`;
    
//     try {
//       // Gửi request và đợi response từ n8n (như code HTML của bạn)
//       const response = await fetch(webhookUrl, {
//         method: 'POST',
//         body: formData,
//         // KHÔNG set Content-Type khi dùng FormData, browser sẽ tự set với boundary
//       });

//       if (!response.ok) {
//         const text = await response.text().catch(() => '');
//         console.error('Upload request failed:', response.status, text);
//         throw new Error(`Không thể gửi file: ${response.status} - ${text.substring(0, 100)}`);
//       }

//       // Đọc response JSON từ n8n (như code HTML của bạn)
//       const responseData = await response.json();
      
//       if (responseData.status !== 200) {
//         throw new Error(responseData.message || 'Upload failed');
//       }

//       return responseData;
//     } catch (error) {
//       console.error('N8n upload error:', error);
//       throw error;
//     }
//   },

//   /**
//    * Get user notifications
//    */
//   getNotifications: async () => {
//     try {
//       // Pass silent: true to avoid console error spam when N8N is offline
//       return await apiRequest('/documents/notifications', { silent: true });
//     } catch (error) {
//       console.warn('Failed to fetch notifications:', error.message);
//       return { success: true, data: { notifications: [] } };
//     }
//   },

//   /**
//    * Mark all notifications as read
//    */
//   markAllNotificationsAsRead: async () => {
//     return await apiRequest('/documents/notifications/mark-all-read', {
//       method: 'PUT',
//     });
//   },

// };

// export default apiRequest;




import { supabase } from './supabase';

// --- CẤU HÌNH BACKEND 1 (Main App - Port 3000) ---
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || 'https://api.docsops.me/api/v1';

// --- CẤU HÌNH BACKEND 2 (Audit Service - Port 5000) ---
// const AUDIT_API_BASE_URL = import.meta.env.VITE_BASE_API_URL || '/audit-api';
const AUDIT_API_BASE_URL =  'https://api.docsops.me/api/v2';

/**
 * Make API request cho Backend 1
 */
async function apiRequest(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  
  const config = {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  };

  let { data: { session }, error: sessionError } = await supabase.auth.getSession();
  
  if (!session || sessionError) {
    const { data: { session: refreshedSession } } = await supabase.auth.refreshSession();
    if (refreshedSession) session = refreshedSession;
  }
  
  if (session?.access_token) {
    config.headers.Authorization = `Bearer ${session.access_token}`;
  }

  try {
    const response = await fetch(url, config);
    const contentType = response.headers.get('content-type');
    
    if (!contentType || !contentType.includes('application/json')) {
      const text = await response.text();
      console.warn('⚠️ BE1 Response không phải JSON:', text.substring(0, 200));
    }

    const text = await response.text();
    if (!text && response.ok) return {}; 
    if (!text) throw new Error('Response rỗng');

    let result;
    try {
      result = JSON.parse(text);
    } catch (parseError) {
      throw new Error('Lỗi parse JSON từ server BE1');
    }

    if (!response.ok) {
      throw new Error(result.message || result.error || `Request failed: ${response.status}`);
    }

    return result;
  } catch (error) {
    if (!options.silent) console.error('❌ BE1 API Request Error:' + url);
    throw error;
  }
}

/**
 * Make API request cho Backend 2 (Audit Service)
 */
async function auditApiRequest(endpoint, options = {}) {
    const url = `${AUDIT_API_BASE_URL}${endpoint}`;
    
    const config = {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    };
  
    try {
      const response = await fetch(url, config);
      const result = await response.json();
  
      if (!response.ok) {
        throw new Error(result.message || result.error || `BE2 Request failed: ${response.status}`);
      }
  
      return result;
    } catch (error) {
      console.error('❌ BE2 (Audit) API Request Error:'+url, error);
      throw error;
    }
}

export const authAPI = {
  register: async (email, password, full_name, company_name) => {
    return await apiRequest('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, full_name, company_name }),
    });
  },

  login: async (email, password) => {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.message || data.error || 'Đăng nhập thất bại');
    return data;
  },

  logout: async () => {
    return await apiRequest('/auth/logout', { method: 'POST' });
  },

  getMe: async () => {
    return await apiRequest('/auth/me');
  },

  // Lấy Profile & Trạng thái Block (Gọi BE2)
  getProfile: async (userId) => {
    return await auditApiRequest(`/users/${userId}/status`);
  },

  updateProfile: async (data) => {
    return await apiRequest('/auth/profile', { method: 'PUT', body: JSON.stringify(data) });
  },

  uploadAvatar: async (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const base64 = reader.result;
          const result = await apiRequest('/auth/upload-avatar', {
            method: 'POST',
            body: JSON.stringify({ avatar: base64 }),
          });
          resolve(result);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  },
};

export const auditAPI = {
    getLatestResult: async () => {
        return await auditApiRequest('/audit/latest-result');
    },
    getLogs: async () => {
        return await auditApiRequest('/audit');
    },
    blockUser: async (email) => {
        return await auditApiRequest('/admin/block-user', {
            method: 'POST',
            body: JSON.stringify({ email, status: 1 })
        });
    }
};

export const departmentConfigAPI = {
  getDepartmentConfigs: async () => {
    return await apiRequest('/department-configs');
  },
  updateDepartmentConfigs: async (departments) => {
    return await apiRequest('/department-configs', {
      method: 'POST',
      body: JSON.stringify({ departments }),
    });
  },
};

export const documentAPI = {
  getUserDocuments: async () => {
    return await apiRequest('/documents/list');
  },

  getDashboardStats: async () => {
    return await apiRequest('/documents/stats');
  },

  searchDocuments: async (query) => {
    if (!query || query.trim().length === 0) return { data: { documents: [] } };
    return await apiRequest(`/documents/search?q=${encodeURIComponent(query.trim())}`);
  },

  getDocumentsByCategory: async (category) => {
    return await apiRequest(`/documents/by-category?category=${encodeURIComponent(category)}`);
  },

  getFolderStats: async () => {
    return await apiRequest('/documents/folder-stats');
  },

  deleteDocument: async (documentId) => {
    return await apiRequest(`/documents/${documentId}`, { method: 'DELETE' });
  },

  uploadToQueue: async (files) => {
    if (!files || files.length === 0) throw new Error('Vui lòng chọn ít nhất một file');
    const formData = new FormData();
    files.forEach((file) => formData.append('files', file));
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error('Bạn cần đăng nhập');

    const response = await fetch(`${API_BASE_URL}/documents/upload-to-queue`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: formData,
    });
    
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || 'Upload failed');
    return result;
  },

  /**
   * --- LOGIC QUAN TRỌNG: KIỂM TRA BLOCK TRƯỚC KHI UPLOAD ---
   */
  uploadToN8n: async (file, userId) => {
    if (!file) throw new Error('Vui lòng chọn file');
    if (!userId) throw new Error('User ID is required');

    // 1. GỌI SANG BE2 ĐỂ CHECK BLOCK
    try {
        const userStatus = await auditApiRequest(`/users/${userId}/status`);
        // Nếu user bị block (is_blocked === 1) -> Ném lỗi ngay lập tức
        if (userStatus && userStatus.is_blocked === 1) {
            throw new Error('⛔ TÀI KHOẢN ĐÃ BỊ CHẶN. KHÔNG THỂ UPLOAD FILE.');
        }
    } catch (checkError) {
        // Nếu lỗi do mạng hoặc server BE2 chết thì vẫn cho phép upload (tuỳ logic của bạn)
        // Hoặc nếu muốn chặt chẽ thì throw luôn. Ở đây tôi throw luôn thông báo lỗi block.
        if (checkError.message.includes('CHẶN')) {
            throw checkError; 
        }
        console.warn('Không thể kiểm tra trạng thái block, tiếp tục upload...', checkError);
    }

    // 2. NẾU KHÔNG BỊ BLOCK THÌ TIẾP TỤC LOGIC CŨ (GỬI SANG N8N)
    const formData = new FormData();
    formData.append('data', file);
    formData.append('id', userId);

    const webhookUrl = `${import.meta.env.VITE_N8N_URL || 'https://n8n.docsops.me'}/webhook/upload-file`;
    
    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Không thể gửi file: ${response.status}`);
      }

      const responseData = await response.json();
      if (responseData.status !== 200) {
        throw new Error(responseData.message || 'Upload failed');
      }
      return responseData;
    } catch (error) {
      console.error('N8n upload error:', error);
      throw error;
    }
  },

  getNotifications: async () => {
    try {
      return await apiRequest('/documents/notifications', { silent: true });
    } catch (error) {
      return { success: true, data: { notifications: [] } };
    }
  },

  markAllNotificationsAsRead: async () => {
    return await apiRequest('/documents/notifications/mark-all-read', { method: 'PUT' });
  },
};

export default apiRequest;