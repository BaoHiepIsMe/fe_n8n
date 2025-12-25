/**
 * Signature Management Page
 * Trang quản lý chữ ký cá nhân
 */

import React from 'react';
import SignatureManagement from '../components/SignatureManagement';
import '../styles/dashboard.css';

const SignatureManagementPage = () => {
  return (
    <div className="dashboard-body">
      <SignatureManagement />
    </div>
  );
};

export default SignatureManagementPage;
