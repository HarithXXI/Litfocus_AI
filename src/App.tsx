import React, { useState, useEffect } from 'react';
import { 
  Plus, 
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
  Type
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Markdown from 'react-markdown';
import { format } from 'date-fns';
import { cn } from './lib/utils';
import { analyzePaperStream } from './services/geminiService';

// Types
interface Analysis {
  id: string;
  title: string;
  content: string;
  timestamp: number;
  mode: 'eli5' | 'deep-dive' | 'key-points';
  readingTime?: string;
  sourceType: 'text' | 'url' | 'file';
  excerpt: string;
}

export default function App() {
  const [history, setHistory] = useState<Analysis[]>([]);
  const [currentAnalysis, setCurrentAnalysis] = useState<Analysis | null>(null);
  const [view, setView] = useState<'input' | 'analysis' | 'settings'>('input');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [copied, setCopied] = useState(false);

  // Settings states
  const [profile, setProfile] = useState({ name: 'Guest Researcher', bio: 'Academic Enthusiast', avatar: '' });
  const [theme, setTheme] = useState({ darkMode: false, accentColor: '#141414', borderStrength: 'medium' });
  const [accessibility, setAccessibility] = useState({ fontSize: '14px', highContrast: false, liquidGlass: false });

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

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getBorderClass = (extra: string = '') => {
    const strength = `border-${theme.borderStrength}`;
    return cn(strength, extra);
  };

  const handleAnalyze = async () => {
    if (sourceType !== 'file' && !inputText.trim()) return;
    if (sourceType === 'file' && !selectedFile) return;
    
    setIsAnalyzing(true);
    const tempId = crypto.randomUUID();
    
    try {
      let fileData: { data: string; mimeType: string } | undefined;
      
      if (sourceType === 'file' && selectedFile) {
        const reader = new FileReader();
        const base64Promise = new Promise<string>((resolve) => {
          reader.onload = () => {
            const result = reader.result as string;
            resolve(result.split(',')[1]);
          };
        });
        reader.readAsDataURL(selectedFile);
        const base64Data = await base64Promise;
        fileData = { data: base64Data, mimeType: selectedFile.type };
      }

      const stream = await analyzePaperStream(inputText, analysisMode, fileData);
      
      let fullContent = '';
      
      // Initial placeholder
      const initialAnalysis: Analysis = {
        id: tempId,
        title: sourceType === 'url' ? 'URL Analysis' : (sourceType === 'file' ? selectedFile?.name || 'File Analysis' : 'Text Analysis'),
        content: '',
        timestamp: Date.now(),
        mode: analysisMode,
        readingTime: 'Estimating...',
        sourceType,
        excerpt: sourceType === 'file' ? `File: ${selectedFile?.name}` : inputText.slice(0, 100) + '...'
      };
      
      setCurrentAnalysis(initialAnalysis);
      setView('analysis');

      for await (const chunk of stream) {
        fullContent += chunk.text || '';
        
        // Extract title and reading time if possible from current content
        const titleMatch = fullContent?.match(/^# (.*)/m);
        const title = titleMatch ? titleMatch[1] : initialAnalysis.title;
        
        const readingTimeMatch = fullContent?.match(/Reading Time Estimate: (.*)/i);
        const readingTime = readingTimeMatch ? readingTimeMatch[1] : initialAnalysis.readingTime;

        setCurrentAnalysis(prev => prev ? ({
          ...prev,
          content: fullContent,
          title,
          readingTime
        }) : null);
      }
      
      // Final update to history
      const finalAnalysis = {
        ...initialAnalysis,
        content: fullContent,
        title: fullContent.match(/^# (.*)/m)?.[1] || initialAnalysis.title,
        readingTime: fullContent.match(/Reading Time Estimate: (.*)/i)?.[1] || '3 min read'
      };

      setHistory(prev => [finalAnalysis, ...prev]);
      setCurrentAnalysis(finalAnalysis);
      setInputText('');
    } catch (error) {
      console.error(error);
      alert("Analysis failed. Please check your API key or input.");
      setView('input');
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

  const filteredHistory = history.filter(item => 
    item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.excerpt.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className={cn(
      "flex h-screen transition-colors duration-200 font-sans overflow-hidden relative",
      theme.darkMode && "dark",
      accessibility.liquidGlass 
        ? (theme.darkMode ? "text-[#E3E3E3]" : (accessibility.highContrast ? "text-black" : "text-[#37352F]"))
        : (theme.darkMode 
            ? "bg-[#141414] text-[#E3E3E3]" 
            : (accessibility.highContrast ? "bg-white text-black" : "bg-[#FBFBFA] text-[#37352F]"))
    )} style={{ fontSize: accessibility.fontSize }}>
      {accessibility.liquidGlass && (
        <div className="ambient-background shadow-inner">
          <div className="ambient-blob w-[600px] h-[600px] bg-blue-500/40 dark:bg-blue-600/30 top-[-15%] left-[-10%]" />
          <div className="ambient-blob w-[700px] h-[700px] bg-indigo-500/40 dark:bg-indigo-600/30 bottom-[-20%] right-[-10%]" style={{ animationDelay: '2s' }} />
          <div className="ambient-blob w-[500px] h-[500px] bg-violet-400/40 dark:bg-violet-500/30 top-[35%] right-[15%]" style={{ animationDelay: '4s' }} />
          <div className="ambient-blob w-[450px] h-[450px] bg-sky-400/30 dark:bg-sky-500/20 bottom-[10%] left-[10%]" style={{ animationDelay: '6s' }} />
        </div>
      )}
      <div className="flex h-full w-full relative z-10">
        {/* Sidebar */}
        <aside className={cn(
          "w-64 flex-shrink-0 border-r flex flex-col relative transition-all duration-500",
          accessibility.liquidGlass 
            ? "liquid-glass" 
            : (theme.darkMode ? "bg-[#202020]" : "bg-[#F7F6F3]"),
          getBorderClass()
        )}>
          {accessibility.liquidGlass && <div className="glass-grain" />}
        <div className={cn(
          "p-4 flex items-center gap-2 cursor-pointer transition-colors",
          theme.darkMode ? "hover:bg-[#2A2A2A]" : "hover:bg-[#EBEAE9]"
        )} onClick={() => setView('input')}>
          <div className="w-6 h-6 bg-[#141414] rounded flex items-center justify-center">
            <BookOpen className="w-4 h-4 text-white" />
          </div>
          <span className="font-semibold text-sm tracking-tight">LitFocus AI</span>
        </div>

        <div className="px-4 py-2 mb-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-[#141414] text-white flex items-center justify-center text-sm font-bold">
            {profile.name[0]}
          </div>
          <div className="flex-1 min-w-0">
            <p className={cn("text-sm font-bold truncate leading-tight", accessibility.highContrast && "high-contrast-text")}>{profile.name}</p>
            <p className={cn("text-xs opacity-60 truncate leading-tight mt-0.5", accessibility.highContrast && "high-contrast-dim")}>{profile.bio}</p>
          </div>
        </div>

        <div className="px-3 mb-2">
          <button 
            onClick={() => { setView('input'); setCurrentAnalysis(null); }}
            className={cn(
              "w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded-md transition-colors",
              theme.darkMode ? "hover:bg-[#2A2A2A]" : "hover:bg-[#EBEAE9]"
            )}
          >
            <Plus className="w-4 h-4" />
            <span>New Analysis</span>
          </button>
        </div>

        <div className="px-3 mb-4">
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
        </div>

        <div className="flex-1 overflow-y-auto px-1 space-y-0.5">
          <div className="px-3 py-2 text-[10px] font-bold text-[#91918E] uppercase tracking-wider">History</div>
          {filteredHistory.length === 0 ? (
            <div className="px-5 py-4 text-center">
              <HistoryIcon className="w-8 h-8 text-[#EBEAE9] mx-auto mb-2" />
              <p className="text-[10px] text-[#91918E]">No history yet</p>
            </div>
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
                    "group flex items-center gap-2 px-3 py-1.5 text-xs rounded-lg cursor-pointer transition-all mx-1",
                    currentAnalysis?.id === item.id 
                      ? (accessibility.liquidGlass ? "liquid-glass-accent text-blue-500 font-bold" : "bg-[#EBEAE9] text-[#37352F] font-medium") 
                      : (accessibility.liquidGlass ? "hover:liquid-glass-accent text-inherit" : "hover:bg-[#EBEAE9] text-[#37352F] opacity-80 hover:opacity-100")
                  )}
                >
                  <FileText className="w-3.5 h-3.5 flex-shrink-0 text-[#91918E]" />
                  <span className="truncate flex-1">{item.title}</span>
                  <button 
                    onClick={(e) => deleteFromHistory(item.id, e)}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:bg-[#D9D8D6] rounded transition-opacity"
                  >
                    <Trash2 className="w-3 h-3 text-[#91918E]" />
                  </button>
                </motion.div>
              ))}
            </AnimatePresence>
          )}
        </div>

        <div className="mt-auto p-2 space-y-0.5 border-t border-inherit">
          <button 
            onClick={() => setView('settings')}
            className={cn(
              "w-full flex items-center gap-2 px-3 py-1.5 text-xs rounded-lg transition-colors",
              view === 'settings' ? (theme.darkMode ? "bg-[#333333]" : "bg-[#EBEAE9]") : (theme.darkMode ? "hover:bg-[#2A2A2A]" : "hover:bg-[#EBEAE9]")
            )}
          >
            <SettingsIcon className="w-3.5 h-3.5" />
            <span>Settings</span>
          </button>
          <div className="px-4 py-2 text-[10px] opacity-40">
            © 2026 LitFocus AI
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className={cn(
        "flex-1 overflow-y-auto relative transition-all duration-500",
        accessibility.liquidGlass 
          ? "bg-transparent backdrop-blur-md" 
          : (theme.darkMode ? "bg-[#141414]" : "bg-white")
      )}>
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
                "border rounded-xl shadow-sm overflow-hidden mb-8 transition-all duration-500 relative",
                accessibility.liquidGlass ? "liquid-glass" : (theme.darkMode ? "bg-[#252525]" : "bg-white"),
                getBorderClass()
              )}>
                {accessibility.liquidGlass && <div className="glass-grain opacity-10" />}
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
                            <p className="text-xs opacity-60">PDF, TXT, DOCX, or Images (MAX 50MB)</p>
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
                          ? (theme.darkMode ? "bg-white text-black border-white" : "bg-[#141414] text-white border-[#141414]") 
                          : (accessibility.liquidGlass 
                              ? "liquid-glass-accent border-opacity-50" 
                              : (theme.darkMode ? "bg-[#252525] border-[#444444] text-white hover:border-white" : "bg-white text-[#37352F] border-[#D1D1D1] hover:border-[#141414]")),
                        accessibility.liquidGlass && analysisMode === mode && "ring-2 ring-blue-500/50"
                      )}
                    >
                      {mode === 'eli5' ? 'ELI5' : mode === 'deep-dive' ? 'Deep Dive' : 'Key Points'}
                    </button>
                  ))}
                </div>

                <button 
                  onClick={handleAnalyze}
                  disabled={isAnalyzing || (sourceType !== 'file' && !inputText.trim()) || (sourceType === 'file' && !selectedFile)}
                  className={cn(
                    "w-full py-3 rounded-lg font-medium transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg",
                    accessibility.liquidGlass 
                      ? "liquid-glass bg-blue-500/20 text-blue-500 border-blue-500/50 hover:bg-blue-500/30" 
                      : (theme.darkMode ? "bg-white text-black hover:bg-[#E0E0E0]" : "bg-[#141414] text-white hover:bg-[#2A2A2A]")
                  )}
                >
                  {isAnalyzing ? (
                    <>
                      <div className={cn("w-4 h-4 border-2 rounded-full animate-spin", theme.darkMode ? "border-black/20 border-t-black" : "border-white/20 border-t-white")} />
                      Analyzing with Gemini...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      Analyze Now
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
                      className={cn("p-1 rounded-md transition-colors", theme.darkMode ? "hover:bg-[#2A2A2A]" : "hover:bg-[#EBEAE9]")}
                    >
                      <ChevronRight className="w-5 h-5 rotate-180" />
                    </button>
                    <div>
                      <h1 className="text-3xl font-bold tracking-tight mb-1">{currentAnalysis.title}</h1>
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
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => handleCopy(currentAnalysis.content)}
                      className={cn("p-2 rounded-md transition-colors flex items-center gap-2 px-3", theme.darkMode ? "hover:bg-[#2A2A2A] text-[#91918E]" : "hover:bg-[#EBEAE9] text-[#91918E]")}
                    >
                      {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                      <span className="text-[10px] font-bold uppercase tracking-wider">{copied ? 'Copied' : 'Copy'}</span>
                    </button>
                    <button 
                      onClick={() => { setView('input'); setInputText(currentAnalysis.excerpt); }}
                      className={cn("p-2 rounded-md transition-colors text-[#91918E]", theme.darkMode ? "hover:bg-[#2A2A2A]" : "hover:bg-[#EBEAE9]")}
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className={cn(
                  "p-8 border rounded-2xl transition-all duration-500 relative overflow-hidden",
                  accessibility.liquidGlass ? "liquid-glass shadow-xl" : (theme.darkMode ? "bg-[#202020]" : "bg-white"),
                  getBorderClass()
                )}>
                  {accessibility.liquidGlass && <div className="glass-grain opacity-10" />}
                  <div className={cn(
                    "prose prose-sm max-w-none prose-headings:font-bold prose-headings:tracking-tight prose-p:leading-relaxed prose-strong:font-bold markdown-body transition-colors",
                    theme.darkMode ? "prose-invert text-[#E3E3E3]" : "text-[#37352F]"
                  )}>
                    <Markdown>{currentAnalysis.content}</Markdown>
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
                <div className={cn("border rounded-xl p-6 space-y-4 transition-all duration-500 relative overflow-hidden", accessibility.liquidGlass ? "liquid-glass" : (theme.darkMode ? "bg-[#252525]" : "bg-white"), getBorderClass())}>
                  {accessibility.liquidGlass && <div className="glass-grain opacity-5" />}
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
                  <Palette className="w-5 h-5 text-[#91918E]" />
                  <h2 className="text-xl font-bold tracking-tight">Appearance</h2>
                </div>
                <div className={cn("border rounded-xl p-6 space-y-6 transition-all duration-500 relative overflow-hidden", accessibility.liquidGlass ? "liquid-glass" : (theme.darkMode ? "bg-[#252525]" : "bg-white"), getBorderClass())}>
                  {accessibility.liquidGlass && <div className="glass-grain opacity-5" />}
                  <div className="flex items-center justify-between">
                    <div>
                      <p className={cn("text-sm font-medium", accessibility.highContrast && "high-contrast-text")}>Dark Mode</p>
                      <p className={cn("text-xs opacity-60", accessibility.highContrast && "high-contrast-dim")}>Reduce eye strain in low light</p>
                    </div>
                    <button 
                      onClick={() => setTheme({...theme, darkMode: !theme.darkMode})}
                      className={cn(
                        "w-14 h-7 rounded-full relative transition-all duration-300 shadow-inner flex items-center px-1",
                        theme.darkMode ? "bg-white" : "bg-[#141414]"
                      )}
                    >
                      <div className={cn(
                        "z-10 w-5 h-5 rounded-full transition-all duration-300 flex items-center justify-center transform shadow-md",
                        theme.darkMode ? "bg-black translate-x-7" : "bg-white translate-x-0"
                      )}>
                        {theme.darkMode ? <Moon className="w-3 h-3 text-white" /> : <Sun className="w-3 h-3 text-black" />}
                      </div>
                      <div className="absolute inset-0 flex items-center justify-between px-2 pointer-events-none">
                        <Sun className={cn("w-3 h-3 transition-opacity", theme.darkMode ? "opacity-0" : "text-white opacity-40")} />
                        <Moon className={cn("w-3 h-3 transition-opacity", theme.darkMode ? "text-black opacity-40" : "opacity-0")} />
                      </div>
                    </button>
                  </div>
                  <div className="space-y-3">
                    <p className={cn("text-sm font-medium", accessibility.highContrast && "high-contrast-text")}>Border Strength</p>
                    <div className="grid grid-cols-3 gap-3">
                      {(['subtle', 'medium', 'heavy'] as const).map((strength) => (
                        <button
                          key={strength}
                          onClick={() => setTheme({...theme, borderStrength: strength})}
                          className={cn(
                            "py-4 text-xs rounded-lg border-2 transition-all flex flex-col items-center gap-2",
                            theme.borderStrength === strength 
                              ? (theme.darkMode ? "bg-white text-black border-white ring-2 ring-white/20" : "bg-black text-white border-black ring-2 ring-black/20")
                              : (theme.darkMode ? "bg-[#191919] border-neutral-700 text-neutral-400 hover:border-white" : "bg-white border-neutral-300 text-neutral-500 hover:border-black"),
                            strength === 'subtle' ? "border-[1px]" : strength === 'medium' ? "border-[2px]" : "border-[3.5px]"
                          )}
                        >
                          <span className="font-bold">{strength.charAt(0).toUpperCase() + strength.slice(1)}</span>
                          <div className={cn(
                            "w-8 h-1 rounded-full",
                            theme.borderStrength === strength ? (theme.darkMode ? "bg-black" : "bg-white") : "bg-current opacity-40"
                          )} />
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Accessibility Section */}
              <div className="mb-12">
                <div className="flex items-center gap-2 mb-6">
                  <Eye className="w-5 h-5 text-[#91918E]" />
                  <h2 className="text-xl font-bold tracking-tight">Accessibility</h2>
                </div>
                <div className={cn("border rounded-xl p-6 space-y-6 transition-all duration-500 relative overflow-hidden", accessibility.liquidGlass ? "liquid-glass" : (theme.darkMode ? "bg-[#252525]" : "bg-white"), getBorderClass())}>
                  {accessibility.liquidGlass && <div className="glass-grain opacity-5" />}
                   <div className="space-y-3">
                    <p className={cn("text-sm font-medium flex items-center gap-2", accessibility.highContrast && "high-contrast-text")}>
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
                        className="grow accent-black dark:accent-white"
                      />
                      <span className="text-sm">Large</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-4 border-t border-inherit">
                    <div>
                      <p className={cn("text-sm font-medium", accessibility.highContrast && "high-contrast-text")}>High Contrast</p>
                      <p className={cn("text-xs opacity-60", accessibility.highContrast && "high-contrast-dim")}>Force readable text colors</p>
                    </div>
                    <button 
                      onClick={() => setAccessibility({...accessibility, highContrast: !accessibility.highContrast})}
                      className={cn(
                        "w-14 h-7 rounded-full relative transition-all duration-300 shadow-inner flex items-center px-1 border",
                        accessibility.highContrast 
                          ? (theme.darkMode ? "bg-white border-white" : "bg-black border-black") 
                          : "bg-neutral-100 border-neutral-300"
                      )}
                    >
                      <div className={cn(
                        "z-10 w-5 h-5 rounded-full transition-all duration-300 flex items-center justify-center transform shadow-md",
                        accessibility.highContrast 
                          ? (theme.darkMode ? "bg-black translate-x-7" : "bg-white translate-x-7") 
                          : (theme.darkMode ? "bg-neutral-800 translate-x-0" : "bg-white translate-x-0")
                      )}>
                        <Eye className={cn("w-3 h-3", accessibility.highContrast ? (theme.darkMode ? "text-white" : "text-black") : "text-neutral-400")} />
                      </div>
                    </button>
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t border-inherit">
                    <div>
                      <p className={cn("text-sm font-medium", accessibility.highContrast && "high-contrast-text")}>Liquid Glass</p>
                      <p className={cn("text-xs opacity-60", accessibility.highContrast && "high-contrast-dim")}>Organic blur and ambient reflections</p>
                    </div>
                    <button 
                      onClick={() => setAccessibility({...accessibility, liquidGlass: !accessibility.liquidGlass})}
                      className={cn(
                        "w-14 h-7 rounded-full relative transition-all duration-300 shadow-inner flex items-center px-1 border",
                        accessibility.liquidGlass 
                          ? (theme.darkMode ? "bg-blue-400 border-blue-400" : "bg-blue-600 border-blue-600") 
                          : "bg-neutral-100 border-neutral-300"
                      )}
                    >
                      <div className={cn(
                        "z-10 w-5 h-5 rounded-full transition-all duration-300 flex items-center justify-center transform shadow-md bg-white",
                        accessibility.liquidGlass ? "translate-x-7" : "translate-x-0"
                      )}>
                        <div className={cn("w-1.5 h-1.5 rounded-full", accessibility.liquidGlass ? "bg-blue-600" : "bg-neutral-400")} />
                      </div>
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
      </div>
    </div>
  );
}
