import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { CheckCircle, Download, Loader2, XCircle } from 'lucide-react';
import { downloadFileUrl, verifyDownload, type DownloadInfo } from '../api/store';

// Destino del QR impreso en cada PDF y del enlace del correo.
export const VerifyDownload: React.FC = () => {
  const { token = '' } = useParams();
  const [info, setInfo] = useState<DownloadInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [clicked, setClicked] = useState(false);

  useEffect(() => {
    verifyDownload(token).then(setInfo).catch(e => setError(e.message));
  }, [token]);

  return (
    <section className="max-w-xl mx-auto px-4 py-16 space-y-6 text-center">
      {!info && !error && <Loader2 className="animate-spin text-gold mx-auto" />}
      {error && (<><XCircle className="mx-auto text-red-300" size={40} /><p className="text-red-200">{error}</p></>)}
      {info && (
        <>
          {info.paid ? <CheckCircle className="mx-auto text-gold" size={40} /> : <XCircle className="mx-auto text-red-300" size={40} />}
          <h1 className="text-3xl">{info.paid ? 'Compra verificada' : 'Pago no confirmado'}</h1>
          <p className="text-mist">
            <span className="text-bone">{info.product}</span><br />
            Adquirido por {info.customer_name} · {new Date(info.purchased_at).toLocaleDateString('es-ES')}
          </p>
          {info.available && !clicked && (
            <a href={downloadFileUrl(token)} onClick={() => setClicked(true)}
              className="inline-flex items-center gap-2 bg-gold text-ink px-6 py-3 rounded-full font-semibold hover:bg-gold-light">
              <Download size={18} /> Descargar PDF
            </a>
          )}
          {(clicked || info.downloaded_at) && (
            <p className="text-sm text-mist">
              Esta copia ya se descargó{info.downloaded_at && ` el ${new Date(info.downloaded_at).toLocaleDateString('es-ES')}`}. Si necesitas otra, escríbenos.
            </p>
          )}
        </>
      )}
    </section>
  );
};
