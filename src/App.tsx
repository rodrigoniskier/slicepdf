import { useCallback, useState, useEffect, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import { FileUp, BookOpen, RefreshCw, DownloadCloud, AlertCircle, FileText, Loader2, Github } from 'lucide-react';
import { saveAs } from 'file-saver';
import { usePdfProcessor } from './hooks/usePdfProcessor';
import { cn } from './lib/utils';

export default function App() {
  const { processFile, isProcessing, progress, statusText, resultBlob, error, reset } = usePdfProcessor();
  const [originalFileName, setOriginalFileName] = useState('');
  const [logs, setLogs] = useState<{Text: string, type: 'info'|'success'|'error'|'warn'}[]>([]);
  const terminalEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll terminal
  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs, isProcessing, progress]);

  useEffect(() => {
    if (statusText) {
      setLogs(prev => [...prev, { Text: statusText, type: 'info' }]);
    }
  }, [statusText]);

  useEffect(() => {
    if (error) {
      setLogs(prev => [...prev, { Text: error, type: 'error' }]);
    }
  }, [error]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      const file = acceptedFiles[0];
      setOriginalFileName(file.name);
      setLogs([{ Text: `[INPUT] Loading "${file.name}"`, type: 'info' }]);
      processFile(file);
    }
  }, [processFile]);

  const dropzoneOptions: any = {
    onDrop,
    accept: { 'application/pdf': ['.pdf'] } as any,
    maxFiles: 1,
    disabled: isProcessing || !!resultBlob || !!error
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone(dropzoneOptions);

  const handleDownload = () => {
    if (resultBlob) {
      const baseName = originalFileName.replace(/\.[^/.]+$/, "");
      saveAs(resultBlob, `${baseName}_capitulos.zip`);
    }
  };

  const handleReset = () => {
    setLogs([]);
    setOriginalFileName('');
    reset();
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans p-4 md:p-8 flex flex-col overflow-x-hidden">
      <div className="max-w-6xl mx-auto w-full flex-1 flex flex-col">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-end mb-6 gap-4">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-slate-800">SLICE<span className="text-indigo-600">PDF</span></h1>
            <p className="text-slate-500 font-medium uppercase text-xs tracking-widest">Intelligent Chapter Extraction & OCR</p>
          </div>
          <div className="flex gap-2 text-[10px] font-mono text-slate-400 bg-white border border-slate-200 px-3 py-1.5 rounded-full overflow-hidden shrink-0">
            <span>STABLE VERSION 2.4.0</span>
            <span className="opacity-30">|</span>
            <span>VERCEL DEPLOYED</span>
          </div>
        </header>

        <div className="flex-1 grid grid-cols-1 md:grid-cols-12 md:grid-rows-6 gap-4 min-h-[700px]">
          
          {/* Upload Area */}
          <div 
            {...getRootProps()}
            className={cn(
                "md:col-span-4 md:row-span-4 bg-white border-2 border-dashed rounded-3xl flex flex-col items-center justify-center p-8 text-center group transition-all",
                isDragActive ? "border-indigo-500 bg-indigo-50" : "border-slate-300 hover:border-indigo-400 hover:bg-indigo-50/30",
                (!isProcessing && !resultBlob && !error) ? "cursor-pointer" : "opacity-50 pointer-events-none"
            )}
          >
            <input {...getInputProps()} />
            <div className="w-16 h-16 bg-indigo-100 rounded-2xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110 shrink-0">
              <FileUp className="w-8 h-8 text-indigo-600" />
            </div>
            <h3 className="text-lg font-bold mb-2">Upload your PDF</h3>
            <p className="text-sm text-slate-500 mb-6">Supports scanned images and digital text</p>
            <div className="px-6 py-2 bg-slate-900 text-white rounded-xl text-sm font-semibold transition-transform group-hover:-translate-y-0.5">
              Choose File
            </div>
            <p className="mt-4 text-[10px] text-slate-400 uppercase tracking-widest line-clamp-1">Max file size: 250MB</p>
          </div>

          {/* Processing Logs / Terminal */}
          <div className="md:col-span-5 md:row-span-4 bg-slate-900 rounded-3xl p-6 shadow-xl flex flex-col overflow-hidden relative">
            <div className="flex justify-between items-center mb-4 shrink-0">
              <div className="flex gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-red-500"></div>
                <div className="w-2.5 h-2.5 rounded-full bg-yellow-500"></div>
                <div className="w-2.5 h-2.5 rounded-full bg-green-500"></div>
              </div>
              <span className="text-slate-500 text-[10px] font-mono tracking-tighter">ocr_engine_v3.log</span>
            </div>
            <div className="flex-1 font-mono text-[11px] sm:text-xs text-slate-300 space-y-1.5 opacity-90 overflow-y-auto custom-scrollbar flex flex-col pb-2">
              {logs.length === 0 && <p className="text-emerald-400">[SYSTEM] Initialization complete. Waiting for file...</p>}
              {logs.map((log, i) => (
                  <p key={i} className={cn(
                      log.type === 'error' ? 'text-red-400' :
                      log.type === 'success' ? 'text-green-400' :
                      'text-slate-300'
                  )}>
                      {log.type === 'error' ? '[ERROR] ' : '[TASK] '}
                      {log.Text}
                  </p>
              ))}
              {isProcessing && (
                  <div className="pt-2 flex items-center gap-2 mt-2">
                    <div className="w-1.5 h-4 bg-indigo-500 animate-pulse"></div>
                    <p className="text-indigo-300">Working...</p>
                  </div>
              )}
              {resultBlob && <p className="text-emerald-400 font-bold mt-2">[SUCCESS] Output generated.</p>}
              <div ref={terminalEndRef} />
            </div>
          </div>

          {/* Chapter Map / Export Area */}
          <div className="md:col-span-3 md:row-span-6 bg-white border border-slate-200 rounded-3xl p-6 flex flex-col">
            <h3 className="text-sm font-black uppercase tracking-widest text-slate-400 mb-4 shrink-0">Structure Map</h3>
            <div className="flex-1 space-y-3 overflow-y-auto mb-4 custom-scrollbar">
              {!isProcessing && !resultBlob && !error && (
                <div className="p-3 opacity-40 border border-dashed border-slate-200 rounded-xl flex items-center gap-3">
                  <div className="text-xs font-bold text-slate-300 w-4">--</div>
                  <p className="text-xs font-bold text-slate-300 italic">No structure available</p>
                </div>
              )}
              {isProcessing && (
                <div className="p-4 bg-indigo-50/50 border border-indigo-100 rounded-xl flex flex-col items-center justify-center gap-3 text-center h-full animate-pulse">
                  <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
                  <p className="text-xs font-bold text-indigo-500">Mapping Content...</p>
                </div>
              )}
              {resultBlob && (
                <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-xl flex flex-col items-center justify-center gap-2 text-center h-full">
                  <FileText className="w-12 h-12 text-emerald-500 mb-2" />
                  <p className="font-bold text-emerald-800">Document Sliced!</p>
                  <p className="text-xs text-emerald-600">Chapters identified and zipped.</p>
                </div>
              )}
              {error && (
                <div className="p-4 bg-red-50 border border-red-100 rounded-xl flex flex-col items-center justify-center gap-2 text-center h-full">
                  <AlertCircle className="w-10 h-10 text-red-500 mb-2" />
                  <p className="font-bold text-red-800">Process Failed</p>
                  <p className="text-xs text-red-600 line-clamp-3">{error}</p>
                </div>
              )}
            </div>

            <div className="space-y-3 shrink-0">
              {resultBlob ? (
                <button 
                  onClick={handleDownload}
                  className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold flex flex-col items-center justify-center gap-1 shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition"
                >
                  <div className="flex items-center gap-2">
                    <DownloadCloud size={16} />
                    <span className="text-sm">Download ZIP</span>
                  </div>
                  <span className="text-[10px] font-normal opacity-70 uppercase tracking-tighter">Ready in browser</span>
                </button>
              ) : (
                <button disabled className="w-full py-4 bg-slate-100 text-slate-400 rounded-2xl font-bold flex flex-col items-center justify-center gap-1 cursor-not-allowed">
                  <span className="text-sm">Download ZIP</span>
                  <span className="text-[10px] font-normal opacity-70 uppercase tracking-tighter">Awaiting input</span>
                </button>
              )}
              
              {(resultBlob || error) && (
                <button 
                  onClick={handleReset}
                  className="w-full py-2.5 bg-white border border-slate-200 hover:bg-slate-50 transition-colors text-slate-600 rounded-xl font-bold flex items-center justify-center gap-2 text-sm"
                >
                  <RefreshCw size={14} />
                  Start Over
                </button>
              )}
            </div>
          </div>

          {/* Configuration Settings */}
          <div className="md:col-span-4 md:row-span-2 bg-indigo-900 rounded-3xl p-5 lg:p-6 text-white flex justify-between">
            <div className="flex flex-col justify-between overflow-hidden">
              <span className="text-[10px] font-black uppercase tracking-widest opacity-60">Detection Strategy</span>
              <div className="space-y-1 mt-2">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full border-2 border-indigo-400 bg-indigo-400 shrink-0"></div>
                  <span className="text-sm font-bold truncate">Table of Contents</span>
                </div>
                <div className="flex items-center gap-2 opacity-50">
                  <div className="w-3 h-3 rounded-full border-2 border-indigo-400 shrink-0"></div>
                  <span className="text-sm font-medium truncate">Regex (Custom)</span>
                </div>
              </div>
            </div>
            <div className="w-px h-full bg-white/10 mx-2 lg:mx-4 shrink-0"></div>
            <div className="flex flex-col justify-between text-right overflow-hidden">
              <span className="text-[10px] font-black uppercase tracking-widest opacity-60">Split Output</span>
              <div className="space-y-0.5 mt-2">
                <p className="text-lg font-black truncate">PDF/A-1b</p>
                <p className="text-[10px] opacity-70 truncate">Archived ZIP</p>
              </div>
            </div>
          </div>

          {/* Summary Stat */}
          <div className="md:col-span-2 md:row-span-2 bg-white border border-slate-200 rounded-3xl p-5 lg:p-6 flex flex-col justify-between">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 truncate">Total Progress</span>
            <p className="text-4xl font-black text-slate-800">{Math.round(progress)}%</p>
            <div className="h-1 w-full bg-slate-100 rounded-full overflow-hidden mt-4 shrink-0">
              <div className="h-full bg-indigo-500 transition-all duration-300" style={{ width: `${progress}%` }}></div>
            </div>
          </div>

          {/* Repo Access */}
          <div className="md:col-span-3 md:row-span-2 bg-emerald-50 border border-emerald-100 rounded-3xl p-5 lg:p-6 flex items-center gap-3 lg:gap-4">
            <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm shrink-0">
              <Github className="w-6 h-6 text-slate-800" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-black uppercase text-emerald-800 tracking-tight truncate">GitHub Repository</p>
              <p className="text-[10px] text-emerald-600 font-mono truncate">v2.4.0-vercel</p>
              <div className="mt-1 text-[10px] underline text-emerald-800 font-bold uppercase cursor-pointer truncate">
                View Source
              </div>
            </div>
          </div>

        </div>

        <footer className="mt-8 flex flex-col md:flex-row justify-between items-center text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em] gap-4">
          <div className="flex gap-6">
            <span>© {new Date().getFullYear()} Chapter-Slice Inc.</span>
            <span className="cursor-pointer hover:text-slate-600 transition-colors">Terms of Service</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
            <span>Vercel Cloud Node: US-EAST-1</span>
          </div>
        </footer>
      </div>
    </div>
  );
}
