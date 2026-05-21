import { useState } from 'react';
import { processPdf } from '../lib/pdfProcessor';

export function usePdfProcessor() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState('');
  const [resultBlob, setResultBlob] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);

  const processFile = async (file: File) => {
    setIsProcessing(true);
    setProgress(0);
    setStatusText('Iniciando...');
    setResultBlob(null);
    setError(null);

    try {
      const buffer = await file.arrayBuffer();
      const zipBlob = await processPdf(buffer, (msg, prog) => {
        setStatusText(msg);
        setProgress(prog);
      });
      setResultBlob(zipBlob);
      setStatusText('Processamento concluído com sucesso!');
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Erro desconhecido ao processar o PDF.');
      setStatusText('Processamento falhou.');
    } finally {
      setIsProcessing(false);
    }
  };

  const reset = () => {
    setResultBlob(null);
    setError(null);
    setStatusText('');
    setProgress(0);
  }

  return { processFile, isProcessing, progress, statusText, resultBlob, error, reset };
}
