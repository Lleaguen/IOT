import React, { useState } from 'react';
import FileUploader from './components/FileUploader';
import ActionBar from './components/ActionBar';
import TabBar from './components/TabBar';
import ResultTable from './components/ResultTable';
import NoMatchTMSTable from './components/NoMatchTMSTable';
import NoMatchEDTable from './components/NoMatchEDTable';
import TimeMatchTable from './components/TimeMatchTable';
import VehicleCounter from './components/VehicleCounter';
import { parseTmsCSV } from './utils/csvParser';
import { parseDockingXLSX } from './utils/xlsxParser';
import { matchData } from './utils/matcher';
import { exportToExcel } from './utils/exporter';

export default function App() {
  const [tmsFile, setTmsFile] = useState(null);
  const [tmsError, setTmsError] = useState(null);
  const [dockingFile, setDockingFile] = useState(null);
  const [dockingError, setDockingError] = useState(null);
  const [matched, setMatched] = useState(null);
  const [noMatchTMS, setNoMatchTMS] = useState(null);
  const [noMatchED, setNoMatchED] = useState(null);
  const [timeMatches, setTimeMatches] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [processError, setProcessError] = useState(null);
  const [activeTab, setActiveTab] = useState('matched');

  const handleTmsFile = (file, err) => { setTmsFile(file); setTmsError(err); setMatched(null); };
  const handleDockingFile = (file, err) => { setDockingFile(file); setDockingError(err); setMatched(null); };

  const canProcess = tmsFile && dockingFile && !tmsError && !dockingError;

  const handleProcess = async () => {
    setProcessing(true);
    setProcessError(null);
    setMatched(null);

    const { data: tmsData, error: tmsParseError } = await parseTmsCSV(tmsFile);
    if (tmsParseError) { setProcessError(tmsParseError); setProcessing(false); return; }

    const { data: dockingData, error: dockingParseError } = await parseDockingXLSX(dockingFile);
    if (dockingParseError) { setProcessError(dockingParseError); setProcessing(false); return; }

    const { matched: m, noMatchTMS: nm, noMatchED: ned, timeMatches: tm } = matchData(tmsData, dockingData);
    setMatched(m);
    setNoMatchTMS(nm);
    setNoMatchED(ned);
    setTimeMatches(tm);
    setActiveTab('matched');
    setProcessing(false);
  };

  const tabs = [
    { id: 'matched', label: `Matcheados (${matched?.length || 0})` },
    { id: 'noMatchTMS', label: `Sin match TMS (${noMatchTMS?.length || 0})` },
    { id: 'noMatchED', label: `ED sin match (${noMatchED?.length || 0})` },
    { id: 'timeMatch', label: `Matcheo por horario (${timeMatches?.length || 0})` },
  ];

  return (
    <div className="app">
      <header className="app-header">
        <h1>IOT — TMS Docking Matcher</h1>
        <p>Cargá los archivos para hacer el matching de patentes entre TMS y Easy Docking.</p>
      </header>

      <div className="uploaders">
        <FileUploader label="TMS CSV" accept=".csv" onFile={handleTmsFile} error={tmsError} fileName={tmsFile?.name} />
        <FileUploader label="Easy Docking XLSX" accept=".xlsx" onFile={handleDockingFile} error={dockingError} fileName={dockingFile?.name} />
      </div>

      <ActionBar
        canProcess={canProcess}
        processing={processing}
        onProcess={handleProcess}
        onExport={() => exportToExcel(matched)}
        canExport={matched?.length > 0}
      />

      {processError && <div className="error-banner">⚠️ {processError}</div>}

      {matched && (
        <div className="results-section">
          <div className="tabs-header">
            <TabBar tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />
            <VehicleCounter results={matched} />
          </div>

          {activeTab === 'matched' && (
            <>
              <div className="results-summary">
                {matched.length} vehículo(s) —{' '}
                {matched.filter(r => r.matchType === 'exact').length} exactos,{' '}
                {matched.filter(r => r.matchType === 'fuzzy-high').length} posibles (alto),{' '}
                {matched.filter(r => r.matchType === 'fuzzy-low').length} posibles (bajo)
              </div>
              <ResultTable results={matched} />
            </>
          )}
          {activeTab === 'noMatchTMS' && <NoMatchTMSTable rows={noMatchTMS} />}
          {activeTab === 'noMatchED' && <NoMatchEDTable rows={noMatchED} />}
          {activeTab === 'timeMatch' && <TimeMatchTable rows={timeMatches} />}
        </div>
      )}
    </div>
  );
}
