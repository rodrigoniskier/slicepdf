import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import Tesseract from 'tesseract.js';
import { PDFDocument } from 'pdf-lib';
import JSZip from 'jszip';

// Setting up the PDF.js worker locally instead of relying on CDN
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerSrc;

export interface ChapterInfo {
  title: string;
  startPage: number; // 0-based index
  endPage?: number;  // 0-based index
}

type ProgressCallback = (message: string, current: number, total?: number) => void;

/**
 * Explore PDF outline recursively to find chapter structures.
 */
async function exploreOutline(pdf: pdfjsLib.PDFDocumentProxy, outline: any[], progressList: ChapterInfo[] = []) {
  if (!outline) return progressList;

  for (const item of outline) {
    // Only capture things that look like chapters or top-level entries, bypassing very nested small headings
    let destRef = item.dest;
    if (typeof destRef === 'string') {
      destRef = await pdf.getDestination(destRef);
    }

    if (Array.isArray(destRef) && destRef.length > 0) {
      try {
        const pageIndex = await pdf.getPageIndex(destRef[0]);
        // Simple heuristic: If it has 'Chapter', 'Capítulo', or is an uppercase title
        progressList.push({
          title: item.title,
          startPage: pageIndex,
        });
      } catch (err) {
        console.warn('Failed to resolve page index for outline item:', item.title);
      }
    }

    if (item.items && item.items.length > 0) {
      // Explore nested items if needed, but we might want just top level
      await exploreOutline(pdf, item.items, progressList);
    }
  }

  return progressList;
}

export async function processPdf(
  fileBuffer: ArrayBuffer,
  onProgress: ProgressCallback
): Promise<Blob> {
  onProgress('Carregando PDF...', 0);
  
  // 1. Load document with pdfjs-dist
  const loadingTask = pdfjsLib.getDocument({ data: fileBuffer.slice(0) });
  const pdfDoc = await loadingTask.promise;
  const numPages = pdfDoc.numPages;

  onProgress('Lendo sumário (TOC)...', 5);
  
  // 2. Try Outline
  let chapters: ChapterInfo[] = [];
  try {
    const outline = await pdfDoc.getOutline();
    if (outline && outline.length > 0) {
      const allChapters = await exploreOutline(pdfDoc, outline);
      // Filter outline entries to only realistic ones and sort by page
      chapters = allChapters
        .sort((a, b) => a.startPage - b.startPage)
        .filter((c, i, arr) => i === 0 || c.startPage > arr[i - 1].startPage); // Remove duplicates on same page
    }
  } catch (err) {
    console.warn('Falha ao ler Outline:', err);
  }

  // 3. Fallback to Regex & OCR
  if (chapters.length < 2) {
    chapters = []; // Reset if TOC was totally useless
    onProgress('Buscando marcadores de capítulo no texto das páginas...', 10);
    
    // Regex for "Capítulo X", "Chapter X"
    const chapterRegex = /^\s*(?:cap[íi]tulo|chapter)[\s-]+([\d]+|[ivxlc]+)/i;

    for (let i = 0; i < numPages; i++) {
      onProgress(`Analisando página ${i + 1} de ${numPages}...`, 10 + Math.floor((i / numPages) * 40), numPages);
      
      const page = await pdfDoc.getPage(i + 1);
      const textContent = await page.getTextContent();
      let pageText = textContent.items.map((it: any) => ('str' in it ? it.str : '')).join(' ');

      // If text is extremely short, it might be a scanned image
      if (pageText.trim().length < 20) {
        onProgress(`Aplicando OCR na página ${i + 1}...`, 10 + Math.floor((i / numPages) * 40));
        
        const viewport = page.getViewport({ scale: 1.5 });
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (ctx) {
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          await page.render({ canvasContext: ctx, viewport } as any).promise;
          const dataURL = canvas.toDataURL('image/jpeg');
          
          try {
            const { data: { text } } = await Tesseract.recognize(dataURL, 'por+eng');
            pageText = text;
          } catch (e) {
            console.error('Erro no OCR na página', i+1, e);
          }
        }
      }

      // Find first line or check whole string for Chapter Match
      const lines = pageText.split('\n').map(l => l.trim()).filter(Boolean);
      for (const line of lines) {
        if (chapterRegex.test(line)) {
          console.log(`Capítulo encontrado na página ${i + 1}: ${line}`);
          chapters.push({
            title: line.substring(0, 50).replace(/[/\\?%*:|"<>]/g, '-'), // safe filename
            startPage: i,
          });
          break; // Stop looking after finding a match in this page
        }
      }
    }
  }

  onProgress('Ajustando índices das páginas...', 60);

  // Fallback: if no chapters found at all, treat whole book as 1 chapter
  if (chapters.length === 0) {
    chapters.push({ title: 'Completo', startPage: 0 });
  }

  // Remove duplicates and sort
  chapters = chapters.sort((a, b) => a.startPage - b.startPage);
  for (let i = 0; i < chapters.length; i++) {
    chapters[i].endPage = (i + 1 < chapters.length) ? chapters[i + 1].startPage : numPages;
  }
  // Filter out any zero-length chapters
  chapters = chapters.filter(c => c.endPage && c.endPage > c.startPage);

  onProgress('Separando documento PDF em arquivos...', 70);

  // 4. Split PDF using pdf-lib
  const originalPdf = await PDFDocument.load(fileBuffer);
  const zip = new JSZip();

  for (let i = 0; i < chapters.length; i++) {
    const chapter = chapters[i];
    onProgress(`Processando ${chapter.title}...`, 70 + Math.floor((i / chapters.length) * 20), chapters.length);
    
    const subDoc = await PDFDocument.create();
    const pageIndices = [];
    for (let p = chapter.startPage; p < chapter.endPage!; p++) {
      pageIndices.push(p);
    }
    
    // Error protection: ensure indices are within bound
    const validIndices = pageIndices.filter(p => p < originalPdf.getPageCount());
    if (validIndices.length > 0) {
      const copiedPages = await subDoc.copyPages(originalPdf, validIndices);
      copiedPages.forEach((p) => subDoc.addPage(p));
      const pdfBytes = await subDoc.save();
      
      const fileName = `${String(i + 1).padStart(2, '0')} - ${chapter.title.trim() || 'Capítulo'}.pdf`;
      zip.file(fileName, pdfBytes);
    }
  }

  onProgress('Compactando arquivo final (ZIP)...', 95);
  
  // 5. Generate ZIP
  const zipBlob = await zip.generateAsync({ type: 'blob' });
  onProgress('Concluído!', 100);
  
  return zipBlob;
}
