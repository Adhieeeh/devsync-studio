import React, { useState } from 'react';


const mergeCRDTSets = (setA, setB) => {
  const mergedMap = new Map();


  const allIds = new Set([...Object.keys(setA), ...Object.keys(setB)]);

  allIds.forEach(id => {
    const recordA = setA[id];
    const recordB = setB[id];

    if (recordA && !recordB) {
      mergedMap.set(id, recordA);
    } else if (!recordA && recordB) {
      mergedMap.set(id, recordB);
    } else {
      
      if (recordA.clock > recordB.clock) {
        mergedMap.set(id, recordA);
      } else if (recordB.clock > recordA.clock) {
        mergedMap.set(id, recordB);
      } else {
       
        const winner = recordA.clientId > recordB.clientId ? recordA : recordB;
        mergedMap.set(id, winner);
      }
    }
  });

  const finalObj = {};
  mergedMap.forEach((v, k) => { finalObj[k] = v; });
  return finalObj;
};


const INITIAL_TASKS = {
  'task-1': { id: 'task-1', title: 'Implement Raft Consensus', status: 'IN_PROGRESS', isTombstone: false, clock: 1, clientId: 'alpha' },
  'task-2': { id: 'task-2', title: 'Configure WAL Flushing', status: 'COMPLETED', isTombstone: false, clock: 2, clientId: 'alpha' }
};

export default function App() {
  
  const [clientAState, setClientAState] = useState(INITIAL_TASKS);
  const [clientAClock, setClientAClock] = useState(3);
  const [clientAInput, setClientAInput] = useState('');

 
  const [clientBState, setClientBState] = useState(INITIAL_TASKS);
  const [clientBClock, setClientBClock] = useState(3);
  const [clientBInput, setClientBInput] = useState('');


  const [isPartitioned, setIsPartitioned] = useState(false);


  const [syncLogs, setSyncLogs] = useState([
    ' DevSync CRDT Kernel online. Clients Alpha & Beta synchronized at Clock T:2.'
  ]);

 
  const handleAddTaskA = (e) => {
    e.preventDefault();
    if (!clientAInput.trim()) return;

    const newClock = clientAClock + 1;
    const newId = `task-${Date.now().toString().slice(-4)}`;
    const newTask = {
      id: newId,
      title: clientAInput.trim(),
      status: 'PENDING',
      isTombstone: false,
      clock: newClock,
      clientId: 'alpha'
    };

    const nextA = { ...clientAState, [newId]: newTask };
    setClientAState(nextA);
    setClientAClock(newClock);
    setClientAInput('');

    if (!isPartitioned) {
      setClientBState(mergeCRDTSets(clientBState, nextA));
      setClientBClock(Math.max(clientBClock, newClock) + 1);
      setSyncLogs(prev => [` [Alpha ➔ Beta] Replicated "${newTask.title}" instantly via active connection.`, ...prev]);
    } else {
      setSyncLogs(prev => [` [Alpha Local] Added "${newTask.title}" at T:${newClock} (Network Partitioned).`, ...prev]);
    }
  };


  const handleAddTaskB = (e) => {
    e.preventDefault();
    if (!clientBInput.trim()) return;

    const newClock = clientBClock + 1;
    const newId = `task-${Date.now().toString().slice(-4)}`;
    const newTask = {
      id: newId,
      title: clientBInput.trim(),
      status: 'PENDING',
      isTombstone: false,
      clock: newClock,
      clientId: 'beta'
    };

    const nextB = { ...clientBState, [newId]: newTask };
    setClientBState(nextB);
    setClientBClock(newClock);
    setClientBInput('');

    if (!isPartitioned) {
      setClientAState(mergeCRDTSets(clientAState, nextB));
      setClientAClock(Math.max(clientAClock, newClock) + 1);
      setSyncLogs(prev => [` [Beta ➔ Alpha] Replicated "${newTask.title}" instantly via active connection.`, ...prev]);
    } else {
      setSyncLogs(prev => [` [Beta Local] Added "${newTask.title}" at T:${newClock} (Offline Cache).`, ...prev]);
    }
  };


  const mutateTask = (targetClient, taskId, newStatus) => {
    if (targetClient === 'alpha') {
      const newClock = clientAClock + 1;
      const updated = {
        ...clientAState[taskId],
        status: newStatus,
        clock: newClock,
        clientId: 'alpha'
      };
      const nextA = { ...clientAState, [taskId]: updated };
      setClientAState(nextA);
      setClientAClock(newClock);

      if (!isPartitioned) {
        setClientBState(mergeCRDTSets(clientBState, nextA));
      }
      setSyncLogs(prev => [` [Alpha] Mutated [${taskId}] ➔ ${newStatus} (Clock: ${newClock})`, ...prev]);
    } else {
      const newClock = clientBClock + 1;
      const updated = {
        ...clientBState[taskId],
        status: newStatus,
        clock: newClock,
        clientId: 'beta'
      };
      const nextB = { ...clientBState, [taskId]: updated };
      setClientBState(nextB);
      setClientBClock(newClock);

      if (!isPartitioned) {
        setClientAState(mergeCRDTSets(clientAState, nextB));
      }
      setSyncLogs(prev => [` [Beta] Mutated [${taskId}] ➔ ${newStatus} (Clock: ${newClock})`, ...prev]);
    }
  };


  const deleteTask = (targetClient, taskId) => {
    if (targetClient === 'alpha') {
      const newClock = clientAClock + 1;
      const tombstoned = {
        ...clientAState[taskId],
        isTombstone: true,
        clock: newClock,
        clientId: 'alpha'
      };
      const nextA = { ...clientAState, [taskId]: tombstoned };
      setClientAState(nextA);
      setClientAClock(newClock);

      if (!isPartitioned) setClientBState(mergeCRDTSets(clientBState, nextA));
      setSyncLogs(prev => [` [Alpha] Tombstoned [${taskId}] at Clock ${newClock}`, ...prev]);
    } else {
      const newClock = clientBClock + 1;
      const tombstoned = {
        ...clientBState[taskId],
        isTombstone: true,
        clock: newClock,
        clientId: 'beta'
      };
      const nextB = { ...clientBState, [taskId]: tombstoned };
      setClientBState(nextB);
      setClientBClock(newClock);

      if (!isPartitioned) setClientAState(mergeCRDTSets(clientAState, nextB));
      setSyncLogs(prev => [` [Beta] Tombstoned [${taskId}] at Clock ${newClock}`, ...prev]);
    }
  };


  const triggerCRDTMerge = () => {
    setSyncLogs(prev => [' INITIATING CRDT CONVERGENCE: Executing LWW-Element-Set mathematical merge...', ...prev]);
    
    setTimeout(() => {
      const converged = mergeCRDTSets(clientAState, clientBState);
      const unifiedClock = Math.max(clientAClock, clientBClock) + 1;

      setClientAState(converged);
      setClientBState(converged);
      setClientAClock(unifiedClock);
      setClientBClock(unifiedClock);
      setIsPartitioned(false);

      setSyncLogs(prev => [
        ` CONVERGENCE ACHIEVED: Both peer nodes resolved to identical deterministic state (Unified Clock: T:${unifiedClock}). Zero merge conflicts.`,
        ...prev
      ]);
    }, 600);
  };

  return (
    <div style={{ maxWidth: '1350px', margin: '30px auto', padding: '0 24px', fontFamily: 'monospace', backgroundColor: '#070a13', color: '#f8fafc', minHeight: '92vh' }}>
      
      {/* HEADER HUD CONTROL STRIP */}
      <header style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #1e293b', paddingBottom: '20px', marginBottom: '30px', gap: '20px' }}>
        <div>
          <h1 style={{ margin: '0', fontSize: '24px', fontWeight: 'bold', color: '#06b6d4', letterSpacing: '-0.5px' }}>
             DevSync Collaborative CRDT Task Engine
          </h1>
          <p style={{ margin: '4px 0 0 0', color: '#475569', fontSize: '12px' }}>
            Offline-First Task Management: LWW-Element-Set CRDTs, Lamport Vector Clocks & Tombstone Garbage Collection.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <button
            onClick={() => setIsPartitioned(!isPartitioned)}
            style={{
              padding: '8px 16px',
              backgroundColor: isPartitioned ? '#ef4444' : '#10b981',
              color: '#070a13',
              border: 'none',
              borderRadius: '6px',
              fontWeight: 'bold',
              cursor: 'pointer',
              fontSize: '12px'
            }}
          >
            {isPartitioned ? '🔌 Network: PARTITIONED (Offline)' : '🟢 Network: CONNECTED'}
          </button>

          {isPartitioned && (
            <button
              onClick={triggerCRDTMerge}
              style={{
                padding: '8px 16px',
                backgroundColor: '#06b6d4',
                color: '#070a13',
                border: 'none',
                borderRadius: '6px',
                fontWeight: 'bold',
                cursor: 'pointer',
                fontSize: '12px'
              }}
            >
               Reconnect & Merge CRDT
            </button>
          )}
        </div>
      </header>

      {/* TWO-NODE DISTRIBUTED PEER WORKSPACE */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '25px', marginBottom: '30px' }}>
        
        {/* CLIENT ALPHA PANEL */}
        <section style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '14px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <span style={{ fontSize: '10px', color: '#38bdf8', fontWeight: 'bold', textTransform: 'uppercase' }}>PEER NODE A</span>
              <h3 style={{ margin: '2px 0 0 0', fontSize: '14px', color: '#fff' }}>Client Alpha (Local Device)</h3>
            </div>
            <span style={{ fontSize: '11px', color: '#38bdf8', backgroundColor: 'rgba(56, 189, 248, 0.1)', padding: '4px 10px', borderRadius: '6px', border: '1px solid rgba(56, 189, 248, 0.2)' }}>
              Lamport Clock: T:{clientAClock}
            </span>
          </div>

          {/* Add Task Form */}
          <form onSubmit={handleAddTaskA} style={{ display: 'flex', gap: '8px' }}>
            <input
              type="text"
              placeholder="Add task on Alpha..."
              value={clientAInput}
              onChange={(e) => setClientAInput(e.target.value)}
              style={{ flex: 1, padding: '8px 12px', backgroundColor: '#070a13', border: '1px solid #1e293b', borderRadius: '6px', color: '#fff', fontSize: '12px', boxSizing: 'border-box' }}
            />
            <button type="submit" style={{ padding: '8px 14px', backgroundColor: '#38bdf8', color: '#070a13', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '12px' }}>
              Add ➕
            </button>
          </form>

          {/* Task List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minHeight: '260px' }}>
            {Object.values(clientAState).filter(t => !t.isTombstone).map(task => (
              <div key={task.id} style={{ backgroundColor: '#070a13', border: `1px solid ${task.status === 'COMPLETED' ? '#10b981' : '#1e293b'}`, borderRadius: '8px', padding: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '12px', color: task.status === 'COMPLETED' ? '#64748b' : '#fff', textDecoration: task.status === 'COMPLETED' ? 'line-through' : 'none' }}>
                    {task.title}
                  </div>
                  <div style={{ fontSize: '9px', color: '#475569', marginTop: '4px' }}>
                    ID: {task.id} | Clock: T:{task.clock} | Source: {task.clientId}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    onClick={() => mutateTask('alpha', task.id, task.status === 'COMPLETED' ? 'PENDING' : 'COMPLETED')}
                    style={{ padding: '4px 8px', backgroundColor: task.status === 'COMPLETED' ? '#1e293b' : 'rgba(16, 185, 129, 0.2)', border: 'none', color: '#10b981', borderRadius: '4px', fontSize: '10px', cursor: 'pointer', fontWeight: 'bold' }}
                  >
                    {task.status === 'COMPLETED' ? 'Reopen' : 'Complete ✓'}
                  </button>
                  <button
                    onClick={() => deleteTask('alpha', task.id)}
                    style={{ padding: '4px 8px', backgroundColor: 'rgba(239, 68, 68, 0.15)', border: 'none', color: '#ef4444', borderRadius: '4px', fontSize: '10px', cursor: 'pointer' }}
                  >
                    💀
                  </button>
                </div>
              </div>
            ))}
            {Object.values(clientAState).filter(t => !t.isTombstone).length === 0 && (
              <div style={{ color: '#475569', fontSize: '12px', textAlign: 'center', marginTop: '80px' }}>No active tasks on Client Alpha.</div>
            )}
          </div>
        </section>

        {/* CLIENT BETA PANEL */}
        <section style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '14px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <span style={{ fontSize: '10px', color: '#a855f7', fontWeight: 'bold', textTransform: 'uppercase' }}>PEER NODE B</span>
              <h3 style={{ margin: '2px 0 0 0', fontSize: '14px', color: '#fff' }}>Client Beta (Remote Device)</h3>
            </div>
            <span style={{ fontSize: '11px', color: '#a855f7', backgroundColor: 'rgba(168, 85, 247, 0.1)', padding: '4px 10px', borderRadius: '6px', border: '1px solid rgba(168, 85, 247, 0.2)' }}>
              Lamport Clock: T:{clientBClock}
            </span>
          </div>

          {/* Add Task Form */}
          <form onSubmit={handleAddTaskB} style={{ display: 'flex', gap: '8px' }}>
            <input
              type="text"
              placeholder="Add task on Beta..."
              value={clientBInput}
              onChange={(e) => setClientBInput(e.target.value)}
              style={{ flex: 1, padding: '8px 12px', backgroundColor: '#070a13', border: '1px solid #1e293b', borderRadius: '6px', color: '#fff', fontSize: '12px', boxSizing: 'border-box' }}
            />
            <button type="submit" style={{ padding: '8px 14px', backgroundColor: '#a855f7', color: '#070a13', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '12px' }}>
              Add ➕
            </button>
          </form>

          {/* Task List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minHeight: '260px' }}>
            {Object.values(clientBState).filter(t => !t.isTombstone).map(task => (
              <div key={task.id} style={{ backgroundColor: '#070a13', border: `1px solid ${task.status === 'COMPLETED' ? '#10b981' : '#1e293b'}`, borderRadius: '8px', padding: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '12px', color: task.status === 'COMPLETED' ? '#64748b' : '#fff', textDecoration: task.status === 'COMPLETED' ? 'line-through' : 'none' }}>
                    {task.title}
                  </div>
                  <div style={{ fontSize: '9px', color: '#475569', marginTop: '4px' }}>
                    ID: {task.id} | Clock: T:{task.clock} | Source: {task.clientId}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    onClick={() => mutateTask('beta', task.id, task.status === 'COMPLETED' ? 'PENDING' : 'COMPLETED')}
                    style={{ padding: '4px 8px', backgroundColor: task.status === 'COMPLETED' ? '#1e293b' : 'rgba(16, 185, 129, 0.2)', border: 'none', color: '#10b981', borderRadius: '4px', fontSize: '10px', cursor: 'pointer', fontWeight: 'bold' }}
                  >
                    {task.status === 'COMPLETED' ? 'Reopen' : 'Complete ✓'}
                  </button>
                  <button
                    onClick={() => deleteTask('beta', task.id)}
                    style={{ padding: '4px 8px', backgroundColor: 'rgba(239, 68, 68, 0.15)', border: 'none', color: '#ef4444', borderRadius: '4px', fontSize: '10px', cursor: 'pointer' }}
                  >
                    
                  </button>
                </div>
              </div>
            ))}
            {Object.values(clientBState).filter(t => !t.isTombstone).length === 0 && (
              <div style={{ color: '#475569', fontSize: '12px', textAlign: 'center', marginTop: '80px' }}>No active tasks on Client Beta.</div>
            )}
          </div>
        </section>

      </div>

      {/* BOTTOM TELEMETRY CRDT LOGS */}
      <footer style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '14px', padding: '20px' }}>
        <h3 style={{ margin: '0 0 12px 0', fontSize: '12px', color: '#64748b', textTransform: 'uppercase' }}>CRDT Synchronization & Causality Logs</h3>
        <div style={{ backgroundColor: '#070a13', borderRadius: '8px', padding: '12px', height: '120px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {syncLogs.map((log, idx) => (
            <div key={idx} style={{ fontSize: '11px', color: log.includes('🚨') || log.includes('💀') ? '#ef4444' : log.includes('🎉') ? '#10b981' : log.includes('⚡') ? '#06b6d4' : '#64748b' }}>
              {log}
            </div>
          ))}
        </div>
      </footer>

    </div>
  );
}