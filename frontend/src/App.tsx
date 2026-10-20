import React from 'react';
import { Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { BusinessProvider } from './context/BusinessContext';
import { ContentProvider } from './context/ContentContext';
import { CartProvider } from './context/CartContext';
import { CatalogProvider } from './context/CatalogContext';
import { Layout } from './components/Layout';
import { Home } from './pages/Home';
import { AppsHub } from './pages/AppsHub';
import { Store } from './pages/Store';
import { Consultations } from './pages/Consultations';
import { Account } from './pages/Account';
import { ResetPassword } from './pages/ResetPassword';
import { Placeholder } from './pages/Placeholder';
import { Cart } from './pages/Cart';
import { Receipt } from './pages/Receipt';
import { VerifyDownload } from './pages/VerifyDownload';
import { Plans } from './pages/Plans';
import { SubscriptionReturn } from './pages/SubscriptionReturn';
import { Bio } from './pages/Bio';
import { School } from './pages/School';
import { Legal } from './pages/Legal';
import { Capabilities } from './pages/Capabilities';
import { PRIVACY, TERMS } from './content/legal';

export default function App() {
  return (
    <BusinessProvider>
      <AuthProvider>
        <ContentProvider>
        <CartProvider>
        <CatalogProvider>
            <Routes>
              <Route path="capacidades" element={<Capabilities />} />
              <Route element={<Layout />}>
                <Route index element={<Home />} />
                <Route path="sobre-mi" element={<Bio />} />
                <Route path="escuela" element={<School />} />
                <Route path="apps" element={<AppsHub />} />
                <Route path="tienda" element={<Store />} />
                <Route path="asesorias" element={<Consultations />} />
                <Route path="carrito" element={<Cart />} />
                <Route path="pedido/:receipt" element={<Receipt />} />
                <Route path="verificar/:token" element={<VerifyDownload />} />
                <Route path="planes" element={<Plans />} />
                <Route path="cuenta" element={<Account />} />
                <Route path="cuenta/suscripcion" element={<SubscriptionReturn />} />
                <Route path="reset-password" element={<ResetPassword />} />
                <Route path="privacidad" element={<Legal title="Política de privacidad" contentKey="privacy" text={PRIVACY} />} />
                <Route path="terminos" element={<Legal title="Términos y condiciones" contentKey="terms" text={TERMS} />} />
                <Route path="*" element={<Placeholder title="Página no encontrada" text="El enlace que seguiste no existe." />} />
              </Route>
            </Routes>
        </CatalogProvider>
        </CartProvider>
        </ContentProvider>
      </AuthProvider>
    </BusinessProvider>
  );
}
