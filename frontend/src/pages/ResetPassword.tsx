import React from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthModal } from '../components/AuthModal';

// Destino del enlace del correo de recuperación (FRONTEND_URL/reset-password).
export const ResetPassword: React.FC = () => {
  const navigate = useNavigate();
  return <AuthModal isOpen initialMode="reset" onClose={() => navigate('/')} />;
};
