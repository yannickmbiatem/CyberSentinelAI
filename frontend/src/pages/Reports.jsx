import { useState } from 'react';
import { FileText, Upload, Download, Zap, X, Target } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { fuseReports, generatePDF } from '../api';
import MarkdownRenderer from '../components/MarkdownRenderer';

function DropZone({ file, label, icon, onFile, onClear }) {
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { 'text/plain': ['.txt', '.xml', '.json', '.nmap'] },
    maxFiles: 1,
    onDrop: files => {
      if (!files[0]) return;
      const reader = new FileReader();
      reader.onload = () => onFile({ name: files[0].name, content: reader.result });
      reader.readAsText(files[0]);
    },
  });

  return (
    <div
      {...getRootProps()}
      style={{
        border: `2px dashed ${file ? 'var(--accent-green)' : isDragActive ? 'var(--accent)' : 'var(--border)'}`,
        borderRadius: 12,
        padding: '20px 16px',
        textAlign: 'center',
        cursor: 'pointer',
        background: file ? 'var(--accent-green-dim)' : isDragActive ? 'var(--accent-dim)' : 'transparent',
        transition: 'all 0.2s',
        position: 'relative',
      }}
    >
      <input {...getInputProps()} />
      <div style={{ fontSize: 26, marginBottom: 8 }}>{icon}</div>
      <div style={{ fontWeight: 600, fontSize: 14, color: file ? 'var(--accent-green)' : 'var(--text-primary)' }}>{label}</div>
      {file ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 6 }}>
          <span style={{ fontSize: 11, color: 'var(--accent-green)' }}>✓ {file.name}</span>
          <button
            onClick={e => { e.stopPropagation(); onClear(); }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0, display: 'flex', alignItems: 'center' }}
          >
            <X size={12} />
          </button>
        </div>
      ) : (
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Drop file or click to upload</p>
      )}
    </div>
  );
}

export default function Reports() {
  const [nmapFile, setNmapFile] = useState(null);
  const [niktoFile, setNiktoFile] = useState(null);
  const [wifiFile, setWifiFile] = useState(null);
  const [targetName, setTargetName] = useState('');
  const [analysis, setAnalysis] = useState('');
  const [vulnerabilities, setVulnerabilities] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);

  const hasFiles = nmapFile || niktoFile || wifiFile;

  async function fuse() {
    setLoading(true);
    try {
      const data = await fuseReports(
        nmapFile?.content || '',
        niktoFile?.content || '',
        wifiFile?.content || '',
        targetName || 'Unknown Target'
      );
      setAnalysis(data.analysis);
      setVulnerabilities(data.vulnerabilities || []);
    } catch (err) {
      setAnalysis(`**Error:** ${err.message}`);
      setVulnerabilities([]);
    }
    setLoading(false);
  }

  async function handlePDF() {
    setPdfLoading(true);
    try {
      if (vulnerabilities.length === 0) {
        throw new Error("No vulnerabilities available to generate PDF.");
      }
      await generatePDF(vulnerabilities, targetName || 'Unknown Target');
    } catch (err) {
      alert(`PDF error: ${err.message}`);
    }
    setPdfLoading(false);
  }

  return (
    <div style={{ padding: '0 0 40px' }} className="animate-fade-up">
      <div className="page-header">
        <div className="page-title"><FileText size={22} color="var(--accent)" /> Multi-Tool Report Fusion</div>
        <div className="page-subtitle">Upload reports from Nmap, Nikto, or WiFi scanners — AI gives a 360° analysis</div>
      </div>

      <div style={{ padding: '28px 32px', maxWidth: 960 }}>
        {/* Target name */}
        <div className="glass-card" style={{ padding: 20, marginBottom: 20 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
            <Target size={14} /> Target Name (optional)
          </label>
          <input
            value={targetName}
            onChange={e => setTargetName(e.target.value)}
            placeholder="e.g., Company Server, Lab Machine, Home Router"
            className="input-field"
          />
        </div>

        {/* Drop zones */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 20 }}>
          <DropZone file={nmapFile} label="Nmap Report" icon="🔍" onFile={setNmapFile} onClear={() => setNmapFile(null)} />
          <DropZone file={niktoFile} label="Nikto Report" icon="🌐" onFile={setNiktoFile} onClear={() => setNiktoFile(null)} />
          <DropZone file={wifiFile} label="WiFi Scan" icon="📡" onFile={setWifiFile} onClear={() => setWifiFile(null)} />
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
          <button
            onClick={fuse}
            disabled={loading || !hasFiles}
            className="btn-primary"
            style={{ flex: 1, justifyContent: 'center', padding: 14, fontSize: 15 }}
          >
            <Zap size={18} /> {loading ? 'Analyzing all reports...' : '⚡ Fuse & Analyze'}
          </button>
          <button
            onClick={handlePDF}
            disabled={pdfLoading || vulnerabilities.length === 0}
            className="btn-danger"
            style={{ padding: '14px 24px', opacity: vulnerabilities.length === 0 ? 0.5 : 1 }}
          >
            <Download size={17} /> {pdfLoading ? 'Generating...' : 'PDF Playbook'}
          </button>
        </div>

        {/* Loading */}
        {loading && (
          <div className="glass-card" style={{ padding: 32, textAlign: 'center', marginBottom: 20 }}>
            <div style={{ width: 50, height: 50, borderRadius: '50%', border: '3px solid var(--border)', borderTopColor: 'var(--accent)', margin: '0 auto 16px', animation: 'spin-slow 1s linear infinite' }} />
            <div style={{ color: 'var(--accent)', fontWeight: 600 }}>Fusing reports with AI analysis...</div>
            <div style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>This may take up to 30 seconds</div>
          </div>
        )}

        {/* Analysis result */}
        {analysis && !loading && (
          <div className="glass-card" style={{ padding: 28 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
              <h3 style={{ fontWeight: 800, fontSize: 17, margin: 0, color: 'var(--accent)' }}>
                🔬 Fused Security Analysis
              </h3>
              {targetName && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>— {targetName}</span>}
            </div>
            <MarkdownRenderer content={analysis} />
          </div>
        )}
      </div>
    </div>
  );
}
