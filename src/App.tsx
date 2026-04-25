import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Loader2, 
  Search, 
  History as HistoryIcon, 
  BookOpen, 
  Sparkles, 
  ChevronRight, 
  Clock, 
  Trash2,
  FileText,
  Link as LinkIcon,
  MoreVertical,
  ExternalLink,
  Copy,
  Check,
  RotateCcw,
  Upload,
  File,
  X,
  Settings as SettingsIcon,
  User,
  Palette,
  Eye,
  LogOut,
  Moon,
  Sun,
  Type,
  Menu,
  PanelLeftClose,
  PanelLeft,
  ChevronLeft
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Markdown from 'react-markdown';
import { format } from 'date-fns';
import { jsPDF } from 'jspdf';
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx';
import { saveAs } from 'file-saver';
import { cn } from './lib/utils';
import mammoth from 'mammoth';
import * as XLSX from 'xlsx';

// Types
interface Analysis {
  id: string;
  title: string;
  content: string; // detailed markdown
  summary_short: string;
  summary_detailed: string;
  key_points: string[];
  keywords: string[];
  timestamp: number;
  mode: 'eli5' | 'deep-dive' | 'key-points';
  readingTime?: string;
  sourceType: 'text' | 'url' | 'file';
  excerpt: string;
  sentiment?: string;
}

export default function App() {
  const [history, setHistory] = useState<Analysis[]>([]);
  const [currentAnalysis, setCurrentAnalysis] = useState<Analysis | null>(null);
  const [view, setView] = useState<'input' | 'analysis' | 'settings'>('input');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [copied, setCopied] = useState(false);

  // Sidebar states
  type SidebarState = 'closed' | 'open';
  const [sidebarState, setSidebarState] = useState<SidebarState>('closed');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // Settings states
  const [profile, setProfile] = useState({ name: 'Guest Researcher', bio: 'Academic Enthusiast', avatar: '' });
  const [theme, setTheme] = useState({ darkMode: false, accentColor: '#141414', borderStrength: 'medium' });
  const [accessibility, setAccessibility] = useState({ fontSize: '14px', highContrast: false, liquidGlass: true });

  // Load state from localStorage
  useEffect(() => {
    const savedHistory = localStorage.getItem('litfocus_history');
    if (savedHistory) setHistory(JSON.parse(savedHistory));
    
    const savedProfile = localStorage.getItem('litfocus_profile');
    if (savedProfile) setProfile(JSON.parse(savedProfile));
    
    const savedTheme = localStorage.getItem('litfocus_theme');
    if (savedTheme) setTheme(JSON.parse(savedTheme));

    const savedAccessibility = localStorage.getItem('litfocus_accessibility');
    if (savedAccessibility) setAccessibility(JSON.parse(savedAccessibility));
  }, []);

  // Save states
  useEffect(() => localStorage.setItem('litfocus_history', JSON.stringify(history)), [history]);
  useEffect(() => localStorage.setItem('litfocus_profile', JSON.stringify(profile)), [profile]);
  useEffect(() => localStorage.setItem('litfocus_theme', JSON.stringify(theme)), [theme]);
  useEffect(() => localStorage.setItem('litfocus_accessibility', JSON.stringify(accessibility)), [accessibility]);

  // Input states
  const [inputText, setInputText] = useState('');
  const [sourceType, setSourceType] = useState<'text' | 'url' | 'file'>('text');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [analysisMode, setAnalysisMode] = useState<'eli5' | 'deep-dive' | 'key-points'>('eli5');
  const [isDraggingSidebar, setIsDraggingSidebar] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);

  useEffect(() => {
    let interval: any;
    if (isAnalyzing) {
      setAnalysisProgress(0);
      interval = setInterval(() => {
        setAnalysisProgress(prev => {
          if (prev >= 90) return prev;
          return prev + Math.random() * 10;
        });
      }, 800);
    } else {
      setAnalysisProgress(100);
    }
    return () => clearInterval(interval);
  }, [isAnalyzing]);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const exportToPDF = (analysis: Analysis) => {
    const doc = new jsPDF();
    let y = 20;
    doc.setFontSize(22);
    doc.text(analysis.title, 20, y);
    y += 15;
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Summary", 20, y);
    y += 8;
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    const summaryLines = doc.splitTextToSize(analysis.summary_short, 170);
    doc.text(summaryLines, 20, y);
    y += (summaryLines.length * 6) + 12;
    
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Key Findings", 20, y);
    y += 8;
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    analysis.key_points.forEach((point) => {
      const pointLines = doc.splitTextToSize(`• ${point}`, 170);
      if (y + (pointLines.length * 6) > 280) { doc.addPage(); y = 20; }
      doc.text(pointLines, 20, y);
      y += (pointLines.length * 6) + 2;
    });
    y += 10;
    
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Detailed Analysis", 20, y);
    y += 8;
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    const bodyContent = analysis.summary_detailed.replace(/[#*`]/g, '');
    const bodyLines = doc.splitTextToSize(bodyContent, 170);
    bodyLines.forEach((line: string) => {
      if (y > 280) { doc.addPage(); y = 20; }
      doc.text(line, 20, y);
      y += 6;
    });
    doc.save(`${analysis.title.replace(/\s+/g, '_')}_LitFocus.pdf`);
  };

  const exportToDOCX = async (analysis: Analysis) => {
    const doc = new Document({
      sections: [{
        children: [
          new Paragraph({ text: analysis.title, heading: HeadingLevel.HEADING_1 }),
          new Paragraph({ text: "\n" }),
          new Paragraph({ children: [new TextRun({ text: "Summary", bold: true, size: 28 })] }),
          new Paragraph({ text: analysis.summary_short }),
          new Paragraph({ text: "\n" }),
          new Paragraph({ children: [new TextRun({ text: "Key Points", bold: true, size: 28 })] }),
          ...analysis.key_points.map(p => new Paragraph({ text: p, bullet: { level: 0 } })),
          new Paragraph({ text: "\n" }),
          new Paragraph({ children: [new TextRun({ text: "Detailed Analysis", bold: true, size: 28 })] }),
          new Paragraph({ text: analysis.summary_detailed.replace(/[#*`]/g, '') }),
        ],
      }],
    });
    const blob = await Packer.toBlob(doc);
    saveAs(blob, `${analysis.title.replace(/\s+/g, '_')}_LitFocus.docx`);
  };

  const exportToTXT = (analysis: Analysis) => {
    const text = `${analysis.title}\n\nSUMMARY\n${analysis.summary_short}\n\nKEY POINTS\n${analysis.key_points.map(p => `• ${p}`).join('\n')}\n\nDETAILED ANALYSIS\n${analysis.summary_detailed.replace(/[#*`]/g, '')}`;
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    saveAs(blob, `${analysis.title.replace(/\s+/g, '_')}.txt`);
  };

  const exportToMD = (analysis: Analysis) => {
    const md = `# ${analysis.title}\n\n## Summary\n${analysis.summary_short}\n\n## Key Points\n${analysis.key_points.map(p => `* ${p}`).join('\n')}\n\n## Analysis\n${analysis.summary_detailed}`;
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    saveAs(blob, `${analysis.title.replace(/\s+/g, '_')}.md`);
  };

  const getBorderClass = (extra: string = '') => {
    return cn(
      theme.darkMode ? "border-stone-800" : "border-stone-200",
      theme.borderStrength === 'subtle' ? "border" : theme.borderStrength === 'medium' ? "border-2" : "border-[3.5px]",
      extra
    );
  };

  const handleAnalyze = async (droppedFile?: File) => {
    const fileToAnalyze = droppedFile || (sourceType === 'file' ? selectedFile : null);
    const activeSourceType = droppedFile ? 'file' : sourceType;

    if (activeSourceType !== 'file' && !inputText.trim()) return;
    if (activeSourceType === 'file' && !fileToAnalyze) return;
    
    setIsAnalyzing(true);
    const tempId = crypto.randomUUID();
    
    try {
      let textToAnalyze = inputText;
      
      if (activeSourceType === 'url') {
        const extractRes = await fetch('/api/extract', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: inputText })
        });
        if (!extractRes.ok) throw new Error("Failed to extract content from URL");
        const extractData = await extractRes.json();
        textToAnalyze = extractData.text;
      } else if (activeSourceType === 'file' && fileToAnalyze) {
        if (fileToAnalyze.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
          const arrayBuffer = await fileToAnalyze.arrayBuffer();
          const result = await mammoth.extractRawText({ arrayBuffer });
          textToAnalyze = result.value;
        } else if (fileToAnalyze.type === 'text/plain') {
          textToAnalyze = await fileToAnalyze.text();
        } else if (fileToAnalyze.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
          const arrayBuffer = await fileToAnalyze.arrayBuffer();
          const workbook = XLSX.read(arrayBuffer, { type: 'array' });
          let fullXlsxText = '';
          workbook.SheetNames.forEach(sheetName => {
            const worksheet = workbook.Sheets[sheetName];
            fullXlsxText += `[Sheet: ${sheetName}]\n${XLSX.utils.sheet_to_txt(worksheet)}\n\n`;
          });
          textToAnalyze = fullXlsxText;
        } else {
          textToAnalyze = await fileToAnalyze.text().catch(() => "Binary content");
        }
      }

      const analyzeRes = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: textToAnalyze, mode: analysisMode })
      });

      if (!analyzeRes.ok) {
        const errData = await analyzeRes.json();
        throw new Error(errData.error || 'Failed to analyze');
      }

      const data = await analyzeRes.json();

      const newAnalysis: Analysis = {
        id: tempId,
        title: data.title || (activeSourceType === 'url' ? 'URL Analysis' : (fileToAnalyze?.name || 'Text Analysis')),
        content: data.summary_detailed,
        summary_short: data.summary_short,
        summary_detailed: data.summary_detailed,
        key_points: data.key_points || [],
        keywords: data.keywords || [],
        sentiment: data.sentiment,
        readingTime: data.reading_time || '5 mins',
        timestamp: Date.now(),
        mode: analysisMode,
        sourceType: activeSourceType,
        excerpt: (textToAnalyze || inputText).substring(0, 200) + '...'
      };

      setHistory(prev => [newAnalysis, ...prev]);
      setCurrentAnalysis(newAnalysis);
      setView('analysis');
      setInputText('');
      setSelectedFile(null);
    } catch (error: any) {
      console.error('Analysis failed:', error);
      alert(error.message || 'Analysis failed. Please try again.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const deleteFromHistory = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setHistory(history.filter(item => item.id !== id));
    if (currentAnalysis?.id === id) {
      setView('input');
      setCurrentAnalysis(null);
    }
  };

  const [filteredHistory, setFilteredHistory] = useState<Analysis[]>([]);
  
  useEffect(() => {
    setFilteredHistory(history.filter(item => 
      item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.excerpt.toLowerCase().includes(searchTerm.toLowerCase())
    ));
  }, [history, searchTerm]);

  // Handle window resize for responsive sidebar
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' ? window.innerWidth < 1024 : false);
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 1024);
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        setSidebarState(prev => prev === 'open' ? 'closed' : 'open');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Close sidebar on navigation in mobile
  useEffect(() => {
    if (isMobile) setSidebarState('closed');
  }, [view, isMobile]);

  return (
    <div className={cn(
      "flex h-screen transition-colors duration-250 font-sans overflow-hidden relative",
      theme.darkMode ? "dark text-stone-200 glass-bg-dark" : "text-stone-900 glass-bg-light"
    )} style={{ fontSize: accessibility.fontSize }}>
      
      {/* Sidebar Overlay Backdrop */}
      <AnimatePresence>
        {sidebarState === 'open' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSidebarState('closed')}
            className="fixed inset-0 bg-black/[0.02] z-40"
          />
        )}
      </AnimatePresence>

      {/* Floating Sidebar */}
      <AnimatePresence>
        {sidebarState === 'open' && (
          <motion.aside
            initial={{ x: '-100%', opacity: 0 }}
            animate={{ x: '0%', opacity: 1 }}
            exit={{ x: '-100%', opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onDragEnter={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (e.dataTransfer.types.includes('Files')) {
                setIsDraggingSidebar(true);
              }
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsDraggingSidebar(false);
            }}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsDraggingSidebar(false);
              const file = e.dataTransfer.files?.[0];
              if (file) {
                if (file.size > 50 * 1024 * 1024) {
                  alert("File is too large. Max size is 50MB.");
                  return;
                }
                setSourceType('file');
                setSelectedFile(file);
                handleAnalyze(file);
              }
            }}
            className={cn(
              "fixed top-0 left-0 h-screen w-[280px] z-[1000] flex flex-col transition-all duration-300",
              accessibility.liquidGlass 
                ? "glass-sidebar" 
                : "bg-white dark:bg-[#1A1A1A] border-r border-stone-200 dark:border-stone-800"
            )}
          >

            {/* Drag Overlay */}
            <AnimatePresence>
              {isDraggingSidebar && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="absolute inset-0 z-[100] flex flex-col items-center justify-center bg-blue-500/10 backdrop-blur-[2px] border-2 border-dashed border-blue-500/50 rounded-2xl m-2 pointer-events-none"
                >
                  <div className="p-4 bg-white dark:bg-gray-800 rounded-full shadow-xl mb-4 border border-blue-100 dark:border-blue-900/50">
                    <Upload className="w-8 h-8 text-blue-500 animate-bounce" />
                  </div>
                  <div className="text-center px-4">
                    <p className="text-sm font-bold text-blue-600 dark:text-blue-400">Drop to Analyze</p>
                    <p className="text-[10px] opacity-60 mt-1">Automatic parsing triggered on drop</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            
            {/* Sidebar Header & Close Toggle */}
            <div className={cn(
              "p-4 flex items-center justify-between gap-2 overflow-hidden",
              isSidebarCollapsed && !isMobile ? "flex-col" : "flex-row"
            )}>
              <div 
                className="flex items-center gap-2 cursor-pointer transition-colors"
                onClick={() => setView('input')}
              >
                <div className="w-6 h-6 bg-[#141414] rounded flex-shrink-0 flex items-center justify-center">
                  <BookOpen className="w-4 h-4 text-white" />
                </div>
                {(!isSidebarCollapsed || isMobile) && (
                  <motion.span 
                    initial={{ opacity: 0 }} 
                    animate={{ opacity: 1 }}
                    className="font-semibold text-sm tracking-tight truncate"
                  >
                    LitFocus AI
                  </motion.span>
                )}
              </div>
              
              <button 
                onClick={() => setSidebarState('closed')}
                className={cn(
                  "p-1.5 rounded-md transition-colors",
                  theme.darkMode ? "hover:bg-white/10" : "hover:bg-black/5"
                )}
                title="Close sidebar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Profile Bar */}
            <div className={cn(
              "px-4 py-2 mb-4 flex items-center gap-3 overflow-hidden transition-all",
              isSidebarCollapsed && !isMobile ? "justify-center" : ""
            )}>
              <div 
                className="w-9 h-9 rounded-full bg-[#141414] text-white flex items-center justify-center text-sm font-bold flex-shrink-0 cursor-pointer"
                onClick={() => setView('settings')}
              >
                {profile.name[0]}
              </div>
              {(!isSidebarCollapsed || isMobile) && (
                <motion.div 
                  initial={{ opacity: 0 }} 
                  animate={{ opacity: 1 }}
                  className="flex-1 min-w-0"
                >
                  <p className={cn("text-sm font-bold truncate leading-tight", accessibility.highContrast && "high-contrast-text")}>{profile.name}</p>
                  <p className={cn("text-xs opacity-60 truncate leading-tight mt-0.5", accessibility.highContrast && "high-contrast-dim")}>{profile.bio}</p>
                </motion.div>
              )}
            </div>

            {/* Sidebar Actions */}
            <div className="px-3 mb-2">
              <button 
                onClick={() => { setView('input'); setCurrentAnalysis(null); }}
                className={cn(
                  "w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded-md transition-colors group",
                  theme.darkMode ? "hover:bg-[#2A2A2A]" : "hover:bg-[#EBEAE9]",
                  isSidebarCollapsed && !isMobile ? "justify-center" : ""
                )}
                title="New Analysis"
              >
                <Plus className="w-4 h-4 flex-shrink-0" />
                {(!isSidebarCollapsed || isMobile) && <span className="truncate">New Analysis</span>}
              </button>
            </div>

            {(!isSidebarCollapsed || isMobile) && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="px-3 mb-4"
              >
                <div className="relative group">
                  <Search className="absolute left-2 top-1.5 w-3.5 h-3.5 text-[#91918E]" />
                  <input 
                    type="text" 
                    placeholder="Search history..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-7 pr-2 py-1.5 text-xs bg-[#EBEAE9] bg-opacity-50 border-none rounded focus:ring-1 focus:ring-[#141414] focus:outline-none placeholder-[#91918E]"
                  />
                </div>
              </motion.div>
            )}

            {/* Processing Progress */}
            <AnimatePresence>
              {isAnalyzing && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="px-4 mb-4"
                >
                  <div className={cn(
                    "p-3 rounded-lg border flex flex-col gap-2",
                    theme.darkMode ? "bg-white/5 border-white/10" : "bg-black/5 border-black/10"
                  )}>
                    <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider">
                      <div className="flex items-center gap-1.5">
                        <Loader2 className="w-3 h-3 animate-spin text-blue-500" />
                        <span>Analyzing...</span>
                      </div>
                      <span className="opacity-60">{Math.round(analysisProgress)}%</span>
                    </div>
                    <div className="h-1.5 w-full bg-black/10 dark:bg-white/10 rounded-full overflow-hidden">
                      <motion.div 
                        className="h-full bg-blue-500"
                        animate={{ width: `${analysisProgress}%` }}
                        transition={{ type: "spring", damping: 20, stiffness: 100 }}
                      />
                    </div>
                    <p className="text-[9px] opacity-40 leading-tight italic">
                      AI is extracting context...
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* History List */}
            <div className="flex-1 overflow-y-auto px-1 space-y-0.5 custom-scrollbar">
              {(!isSidebarCollapsed || isMobile) && (
                <div className="px-3 py-2 text-[10px] font-bold text-[#91918E] uppercase tracking-wider">History</div>
              )}
              
              {filteredHistory.length === 0 ? (
                (!isSidebarCollapsed || isMobile) && (
                  <div className="px-5 py-4 text-center">
                    <HistoryIcon className="w-8 h-8 text-[#EBEAE9] mx-auto mb-2" />
                    <p className="text-[10px] text-[#91918E]">No history yet</p>
                  </div>
                )
              ) : (
                <AnimatePresence initial={false}>
                  {filteredHistory.map((item) => (
                    <motion.div
                      layout
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      key={item.id}
                      onClick={() => { setCurrentAnalysis(item); setView('analysis'); }}
                      className={cn(
                        "group flex items-center gap-2 px-3 py-1.5 text-xs rounded-lg cursor-pointer transition-all mx-1 mb-0.5",
                        currentAnalysis?.id === item.id 
                          ? "bg-blue-500/10 text-blue-600 font-medium" 
                          : "hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-600 dark:text-stone-400 opacity-80 hover:opacity-100",
                        isSidebarCollapsed && !isMobile ? "justify-center" : ""
                      )}
                      title={item.title}
                    >
                      <FileText className="w-3.5 h-3.5 flex-shrink-0 text-[#91918E]" />
                      {(!isSidebarCollapsed || isMobile) && <span className="truncate flex-1">{item.title}</span>}
                      {(!isSidebarCollapsed || isMobile) && (
                        <button 
                          onClick={(e) => deleteFromHistory(item.id, e)}
                          className="opacity-0 group-hover:opacity-100 p-1 hover:bg-[#D9D8D6] rounded transition-opacity"
                        >
                          <Trash2 className="w-3 h-3 text-[#91918E]" />
                        </button>
                      )}
                    </motion.div>
                  ))}
                </AnimatePresence>
              )}
            </div>

            {/* Footer Actions */}
            <div className="mt-auto p-2 space-y-0.5 border-t border-stone-200 dark:border-stone-800">
              <button 
                onClick={() => setView('settings')}
                className={cn(
                  "w-full flex items-center gap-2 px-3 py-1.5 text-xs rounded-lg transition-colors",
                  view === 'settings' ? (theme.darkMode ? "bg-stone-800" : "bg-stone-100") : "hover:bg-stone-50 dark:hover:bg-stone-800",
                  isSidebarCollapsed && !isMobile ? "justify-center" : ""
                )}
                title="Settings"
              >
                <SettingsIcon className="w-3.5 h-3.5 flex-shrink-0" />
                {(!isSidebarCollapsed || isMobile) && <span>Settings</span>}
              </button>
              {(!isSidebarCollapsed || isMobile) && (
                <div className="px-4 py-2 text-[10px] opacity-40">
                  © 2026 LitFocus AI
                </div>
              )}
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      <div className="flex h-full w-full relative z-10">
        {/* Main Content */}
        <main className={cn(
          "flex-1 flex flex-col h-full overflow-hidden transition-all duration-500"
        )}>
          {/* Header Mobile Toggle */}
          <header className={cn(
            "h-14 px-4 flex items-center justify-between border-b relative z-30"
          )}>
            <div className="flex items-center gap-3">
              <button 
                onClick={() => setSidebarState(sidebarState === 'open' ? 'closed' : 'open')}
                className={cn(
                  "p-2 rounded-lg transition-all duration-300",
                  sidebarState === 'open' ? "opacity-0 scale-0 w-0 p-0" : "opacity-100 scale-100",
                )}
              >
                <Menu className="w-5 h-5" />
              </button>
              <h2 className="text-sm font-semibold tracking-tight opacity-60">
                {view === 'input' ? 'New Analysis' : view === 'analysis' ? 'Analysis View' : 'Settings'}
              </h2>
            </div>
            
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setTheme({...theme, darkMode: !theme.darkMode})}
                className={cn(
                  "p-2 rounded-lg transition-colors",
                  theme.darkMode ? "text-yellow-400 hover:bg-white/10" : "text-gray-500 hover:bg-black/5"
                )}
              >
                {theme.darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>
            </div>
          </header>

          <div className="flex-1 overflow-y-auto custom-scrollbar">
            <AnimatePresence mode="wait">
          {view === 'input' ? (
            <motion.div 
              key="input"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="max-w-3xl mx-auto px-6 py-20"
            >
              <div className="mb-12">
                <span className={cn(
                  "inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider mb-4",
                  theme.darkMode ? "bg-[#333333] text-[#91918E]" : "bg-[#EBEAE9] text-[#91918E]"
                )}>
                  <Sparkles className="w-3 h-3" />
                  Premium AI Assistant
                </span>
                <h1 className={cn("text-4xl font-bold tracking-tight mb-4", accessibility.highContrast && "high-contrast-text")}>LitFocus AI</h1>
                <p className={cn("text-lg opacity-60", accessibility.highContrast && "high-contrast-dim")}>
                  Instantly extract insights from complex literature. Study smarter, not harder.
                </p>
              </div>

              <div className={cn(
                "border rounded-xl shadow-sm overflow-hidden mb-8 transition-all duration-700 relative",
                theme.darkMode ? "bg-stone-900 border-white/5" : "bg-white border-stone-200"
              )}>
                <div className="flex border-b border-inherit">
                  {(['text', 'url', 'file'] as const).map((type) => (
                    <button 
                      key={type}
                      onClick={() => setSourceType(type)}
                      className={cn(
                        "flex-1 py-3 text-sm font-medium transition-colors capitalize border-r last:border-r-0 border-inherit",
                        sourceType === type 
                          ? (theme.darkMode ? "bg-[#333333] text-white font-bold" : "bg-[#F7F6F3] text-[#37352F] font-bold") 
                          : "text-[#91918E] hover:text-[#37352F]"
                      )}
                    >
                      {type === 'text' ? 'Paste Text' : type === 'url' ? 'Insert URL' : 'Upload File'}
                    </button>
                  ))}
                </div>
                
                <div className="p-4">
                  {sourceType === 'text' && (
                    <textarea 
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                      placeholder="Paste your research paper, abstract, or literature here..."
                      className="w-full h-40 resize-none border-none focus:ring-0 text-sm placeholder-[#91918E] bg-transparent"
                    />
                  )}
                  {sourceType === 'url' && (
                    <div className={cn("flex items-center gap-2 p-2 rounded-md transition-colors", theme.darkMode ? "bg-[#191919]" : "bg-[#F7F6F3]")}>
                      <LinkIcon className="w-4 h-4 text-[#91918E]" />
                      <input 
                        type="url" 
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                        placeholder="https://scholar.google.com/..."
                        className="flex-1 bg-transparent border-none focus:ring-0 text-sm py-1.5"
                      />
                    </div>
                  )}
                  {sourceType === 'file' && (
                    <div className="space-y-4">
                      {selectedFile ? (
                        <div className={cn("flex items-center justify-between p-4 rounded-lg border transition-colors", theme.darkMode ? "bg-[#191919]" : "bg-[#F7F6F3]", getBorderClass())}>
                          <div className="flex items-center gap-3">
                            <div className={cn("p-2 rounded-md border transition-colors", theme.darkMode ? "bg-[#252525]" : "bg-white", getBorderClass())}>
                              <File className="w-5 h-5" />
                            </div>
                            <div>
                              <p className={cn("text-sm font-medium truncate max-w-[200px]", accessibility.highContrast && "high-contrast-text")}>{selectedFile.name}</p>
                              <p className={cn("text-[10px] opacity-60", accessibility.highContrast && "high-contrast-dim")}>{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
                            </div>
                          </div>
                          <button 
                            onClick={() => setSelectedFile(null)}
                            className={cn("p-1 rounded-full transition-colors", theme.darkMode ? "hover:bg-[#333333]" : "hover:bg-[#EBEAE9]")}
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <label className={cn(
                          "flex flex-col items-center justify-center w-full h-40 border-2 border-dashed rounded-lg cursor-pointer transition-colors group",
                          theme.darkMode ? "border-[#444444] hover:bg-[#202020]" : "border-[#D1D1D1] hover:bg-[#F7F6F3]"
                        )}>
                          <div className="flex flex-col items-center justify-center pt-5 pb-6">
                            <Upload className="w-8 h-8 text-[#91918E] mb-3 group-hover:text-inherit transition-colors" />
                            <p className="mb-2 text-sm font-medium">Click to upload or drag and drop</p>
                            <p className="text-xs opacity-60">PDF, TXT, DOCX, PPTX, XLSX, or Images (MAX 50MB)</p>
                          </div>
                          <input 
                            type="file" 
                            className="hidden" 
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file && file.size > 50 * 1024 * 1024) {
                                alert("File is too large. Max size is 50MB.");
                                e.target.value = '';
                                return;
                              }
                              setSelectedFile(file || null);
                            }}
                          />
                        </label>
                      )}
                      <textarea 
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                        placeholder="Optional: Add context or specific questions about this file..."
                        className="w-full h-20 resize-none bg-transparent border-none focus:ring-0 text-xs placeholder-[#91918E]"
                      />
                    </div>
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-3">
                  {(['eli5', 'deep-dive', 'key-points'] as const).map((mode) => (
                    <button
                      key={mode}
                      onClick={() => setAnalysisMode(mode)}
                      className={cn(
                        "px-4 py-2 rounded-full text-xs font-medium border transition-all",
                        analysisMode === mode 
                          ? (theme.darkMode ? "bg-stone-200 text-stone-900 border-stone-200" : "bg-stone-900 text-white border-stone-900") 
                          : (theme.darkMode ? "bg-stone-900 border-stone-800 text-stone-400 hover:border-stone-600" : "bg-white text-stone-600 border-stone-200 hover:border-stone-400")
                      )}
                    >
                      {mode === 'eli5' ? 'Explain Like I\'m Five' : mode === 'deep-dive' ? 'Technical Research Dive' : 'Key Point Extraction'}
                    </button>
                  ))}
                </div>

                <button 
                  onClick={() => handleAnalyze()}
                  disabled={isAnalyzing || (sourceType !== 'file' && !inputText.trim()) || (sourceType === 'file' && !selectedFile)}
                  className={cn(
                    "w-full py-3 rounded-lg font-medium transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg",
                    isAnalyzing || (sourceType !== 'file' && !inputText.trim()) || (sourceType === 'file' && !selectedFile)
                      ? "bg-stone-200 text-stone-400 dark:bg-stone-800 dark:text-stone-500"
                      : "bg-blue-600 text-white hover:bg-blue-700"
                  )}
                >
                  {isAnalyzing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-white" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      Start Analysis
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          ) : view === 'analysis' ? (
                currentAnalysis && (
              <motion.div 
                key="analysis"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="max-w-3xl mx-auto px-6 py-12"
              >
                <div className="flex items-center justify-between mb-8 group/header">
                  <div className="flex items-center gap-4">
                    <button 
                      onClick={() => setView('input')}
                      className={cn("p-1 rounded-md transition-colors", theme.darkMode ? "hover:bg-stone-800" : "hover:bg-stone-100")}
                    >
                      <ChevronRight className="w-5 h-5 rotate-180" />
                    </button>
                    <div>
                      <h1 className="text-[28px] font-bold tracking-tight leading-tight mb-1">{currentAnalysis.title}</h1>
                      <div className="flex items-center gap-3 text-xs opacity-60">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {currentAnalysis.readingTime || '3 min read'}
                        </span>
                        <span>•</span>
                        <span>{format(currentAnalysis.timestamp, 'MMM d, yyyy')}</span>
                        <span>•</span>
                        <span className="capitalize">{currentAnalysis.mode.replace('-', ' ')}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="relative group/export">
                      <button className={cn("p-2 rounded-md transition-colors flex items-center gap-2 px-4 shadow-sm border", theme.darkMode ? "bg-stone-800 border-stone-700 hover:bg-stone-700 text-stone-200" : "bg-white border-stone-200 hover:bg-stone-50 text-stone-600")}>
                        <FileText className="w-4 h-4" />
                        <span className="text-xs font-medium">Export</span>
                      </button>
                      <div className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-lg shadow-xl opacity-0 translate-y-2 pointer-events-none group-hover/export:opacity-100 group-hover/export:translate-y-0 group-hover/export:pointer-events-auto transition-all z-50 overflow-hidden">
                        {[
                          { name: 'PDF Document', icon: FileText, handler: () => exportToPDF(currentAnalysis) },
                          { name: 'Word (.docx)', icon: File, handler: () => exportToDOCX(currentAnalysis) },
                          { name: 'Markdown', icon: Sparkles, handler: () => exportToMD(currentAnalysis) },
                          { name: 'Plain Text', icon: Type, handler: () => exportToTXT(currentAnalysis) },
                        ].map((opt) => (
                          <button
                            key={opt.name}
                            onClick={opt.handler}
                            className="w-full flex items-center gap-3 px-4 py-2.5 text-xs text-left hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors"
                          >
                            <opt.icon className="w-3.5 h-3.5 opacity-60" />
                            {opt.name}
                          </button>
                        ))}
                      </div>
                    </div>

                    <button 
                      onClick={() => handleCopy(currentAnalysis.content)}
                      className={cn("p-2 rounded-md transition-colors flex items-center gap-2 px-3 border", theme.darkMode ? "hover:bg-stone-800 border-stone-800 text-stone-400" : "hover:bg-stone-50 border-stone-200 text-stone-500")}
                    >
                      {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-8">
                  {/* Executive Summary */}
                  <div className={cn(
                    "p-8 border rounded-2xl transition-all relative overflow-hidden",
                    theme.darkMode ? "bg-stone-900 border-stone-800" : "bg-white border-stone-200",
                    getBorderClass()
                  )}>
                    <h2 className="text-[13px] font-bold uppercase tracking-[0.1em] text-stone-400 mb-4">Summary</h2>
                    <p className="text-[18px] font-medium leading-[1.6] text-stone-800 dark:text-stone-100 mb-6 italic">
                      "{currentAnalysis.summary_short}"
                    </p>
                    <div className="flex flex-wrap gap-2 pt-4 border-t dark:border-stone-800">
                      {currentAnalysis.keywords.map(word => (
                        <span key={word} className="px-2 py-1 bg-stone-100 dark:bg-stone-800 text-stone-500 dark:text-stone-400 rounded text-[11px] font-medium">#{word}</span>
                      ))}
                    </div>
                  </div>

                  {/* Key Highlights */}
                  <div className="grid md:grid-cols-2 gap-6">
                    <div className={cn(
                      "p-8 border rounded-2xl transition-all",
                      theme.darkMode ? "bg-stone-900 border-stone-800" : "bg-white border-stone-200",
                      getBorderClass()
                    )}>
                      <h2 className="text-[13px] font-bold uppercase tracking-[0.1em] text-stone-400 mb-6">Key Insights</h2>
                      <ul className="space-y-4">
                        {currentAnalysis.key_points.map((point, idx) => (
                          <li key={idx} className="flex gap-4 text-[15px] leading-relaxed text-stone-600 dark:text-stone-300">
                            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-500/10 text-blue-500 flex items-center justify-center text-[11px] font-bold">
                              {idx + 1}
                            </span>
                            {point}
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className={cn(
                      "p-8 border rounded-2xl transition-all flex flex-col justify-center items-center text-center",
                      theme.darkMode ? "bg-stone-900 border-stone-800" : "bg-white border-stone-200",
                      getBorderClass()
                    )}>
                       <h2 className="text-[13px] font-bold uppercase tracking-[0.1em] text-stone-400 mb-4">Reading Sentiment</h2>
                       <div className="text-4xl mb-4">
                        {currentAnalysis.sentiment?.toLowerCase().includes('positive') ? '✨' : currentAnalysis.sentiment?.toLowerCase().includes('negative') ? '⚖️' : '📝'}
                       </div>
                       <p className="text-[15px] font-medium text-stone-500 capitalize">{currentAnalysis.sentiment || 'Neutral'}</p>
                    </div>
                  </div>

                  {/* Detailed Dive */}
                  <div className={cn(
                    "p-10 border rounded-2xl transition-all relative overflow-hidden",
                    theme.darkMode ? "bg-stone-900 border-stone-800 text-stone-200" : "bg-white border-stone-200 text-stone-900",
                    getBorderClass()
                  )}>
                    <h2 className="text-[13px] font-bold uppercase tracking-[0.1em] text-stone-400 mb-8 pb-4 border-b dark:border-stone-800">Detailed Research Dive</h2>
                    <div className={cn(
                      "prose prose-sm max-w-none prose-headings:font-bold prose-headings:tracking-tight prose-p:leading-[1.8] prose-p:text-[16px] prose-p:mb-5 prose-strong:font-bold markdown-body transition-colors",
                      theme.darkMode ? "prose-invert" : ""
                    )}>
                      <Markdown>{currentAnalysis.content}</Markdown>
                    </div>
                  </div>
                </div>
              </motion.div>
            )
          ) : (
            <motion.div 
              key="settings"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="max-w-2xl mx-auto px-6 py-16"
            >
              <h1 className="text-3xl font-bold tracking-tight mb-8">Settings</h1>

              {/* Profile Section */}
              <div className="mb-12">
                <div className="flex items-center gap-2 mb-6">
                  <User className="w-5 h-5 text-[#91918E]" />
                  <h2 className="text-xl font-bold tracking-tight">Profile</h2>
                </div>
                <div className={cn(
                  "border rounded-xl p-6 space-y-4 transition-all relative overflow-hidden",
                  theme.darkMode ? "bg-stone-900 border-stone-800" : "bg-white border-stone-200",
                  getBorderClass()
                )}>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-[#91918E] opacity-80">Research Name</label>
                    <input 
                      type="text" 
                      value={profile.name}
                      onChange={(e) => setProfile({...profile, name: e.target.value})}
                      className={cn(
                        "w-full bg-transparent border-b py-2 text-sm font-bold focus:outline-none transition-all", 
                        getBorderClass(), 
                        accessibility.highContrast && "high-contrast-text"
                      )}
                      placeholder="Your Name"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-[#91918E] opacity-80">Bio / Field of Study</label>
                    <textarea 
                      value={profile.bio}
                      onChange={(e) => setProfile({...profile, bio: e.target.value})}
                      className={cn(
                        "w-full bg-transparent border-b border-inherit py-2 text-xs leading-relaxed focus:outline-none resize-none",
                        accessibility.highContrast && "high-contrast-text"
                      )}
                      rows={2}
                      placeholder="What are you researching?"
                    />
                  </div>
                </div>
              </div>

              {/* Appearance Section */}
              <div className="mb-12">
                <div className="flex items-center gap-2 mb-6">
                  <Palette className="w-5 h-5 text-stone-500" />
                  <h2 className="text-xl font-bold tracking-tight">Appearance</h2>
                </div>
                <div className={cn(
                  "border rounded-xl p-6 space-y-6 transition-all relative overflow-hidden",
                  theme.darkMode ? "bg-stone-900 border-stone-800" : "bg-white border-stone-200"
                )}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">Dark Mode</p>
                      <p className="text-xs opacity-60">Reduce eye strain in low light</p>
                    </div>
                    <button 
                      onClick={() => setTheme({...theme, darkMode: !theme.darkMode})}
                      className={cn(
                        "w-12 h-6 rounded-full relative transition-all duration-300 flex items-center px-1 shrink-0",
                        theme.darkMode ? "bg-blue-600" : "bg-stone-200"
                      )}
                    >
                      <div className={cn(
                        "w-4 h-4 rounded-full transition-all duration-300 shadow-sm bg-white",
                        theme.darkMode ? "translate-x-6" : "translate-x-0"
                      )} />
                    </button>
                  </div>
                  
                  <div className="flex items-center justify-between pt-4 border-t border-stone-100 dark:border-stone-800">
                    <div>
                      <p className="text-sm font-medium">Liquid Glass Effect</p>
                      <p className="text-xs opacity-60">Translucent frosted glass sidebar</p>
                    </div>
                    <button 
                      onClick={() => setAccessibility({...accessibility, liquidGlass: !accessibility.liquidGlass})}
                      className={cn(
                        "w-12 h-6 rounded-full relative transition-all duration-300 flex items-center px-1 shrink-0",
                        accessibility.liquidGlass ? "bg-blue-600" : "bg-stone-200"
                      )}
                    >
                      <div className={cn(
                        "w-4 h-4 rounded-full transition-all duration-300 shadow-sm bg-white",
                        accessibility.liquidGlass ? "translate-x-6" : "translate-x-0"
                      )} />
                    </button>
                  </div>
                  <div className="space-y-3">
                    <p className="text-sm font-medium">Border Style</p>
                    <div className="grid grid-cols-3 gap-3">
                      {(['subtle', 'medium', 'heavy'] as const).map((strength) => (
                        <button
                          key={strength}
                          onClick={() => setTheme({...theme, borderStrength: strength})}
                          className={cn(
                            "py-3 text-xs rounded-lg border transition-all",
                            theme.borderStrength === strength 
                              ? "bg-blue-600 text-white border-blue-600"
                              : (theme.darkMode ? "bg-stone-900 border-stone-800 text-stone-400 hover:border-stone-600" : "bg-white border-stone-200 text-stone-500 hover:border-stone-400")
                          )}
                        >
                          {strength.charAt(0).toUpperCase() + strength.slice(1)}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Accessibility Section */}
              <div className="mb-12">
                <div className="flex items-center gap-2 mb-6">
                  <Eye className="w-5 h-5 text-stone-500" />
                  <h2 className="text-xl font-bold tracking-tight">Accessibility</h2>
                </div>
                <div className={cn(
                  "border rounded-xl p-6 space-y-6 transition-all relative overflow-hidden",
                  theme.darkMode ? "bg-stone-900 border-stone-800" : "bg-white border-stone-200"
                )}>
                   <div className="space-y-3">
                    <p className="text-sm font-medium flex items-center gap-2">
                       <Type className="w-4 h-4 opacity-60" />
                       Content Font Size
                    </p>
                    <div className="flex items-center gap-4">
                      <span className="text-xs opacity-60">Small</span>
                      <input 
                        type="range" 
                        min="12" 
                        max="20" 
                        step="1"
                        value={parseInt(accessibility.fontSize)}
                        onChange={(e) => setAccessibility({...accessibility, fontSize: `${e.target.value}px`})}
                        className="grow accent-blue-600"
                      />
                      <span className="text-sm">Large</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-4 border-t border-stone-200 dark:border-stone-800">
                    <div>
                      <p className="text-sm font-medium">High Contrast</p>
                      <p className="text-xs opacity-60">Force maximum legibility</p>
                    </div>
                    <button 
                      onClick={() => setAccessibility({...accessibility, highContrast: !accessibility.highContrast})}
                      className={cn(
                        "w-12 h-6 rounded-full relative transition-all duration-300 flex items-center px-1",
                        accessibility.highContrast ? "bg-blue-600" : "bg-stone-200"
                      )}
                    >
                      <div className={cn(
                        "w-4 h-4 rounded-full transition-all duration-300 shadow-sm bg-white",
                        accessibility.highContrast ? "translate-x-6" : "translate-x-0"
                      )} />
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </main>
      </div>
    </div>
  );
}
