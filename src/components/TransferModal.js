import React, { useMemo, useState } from 'react';
import { CheckCircle2, MapPin, X } from 'lucide-react';
import { cargoInputStep, parseCargoInput } from '../data/cargoUnits';

function normalizeDestination(destination, index) {
  const locationName = String(
    destination?.location_name || destination?.value || destination?.label || destination?.key || ''
  ).trim();
  const system = String(destination?.system || 'Outro').trim() || 'Outro';
  const locationType = String(destination?.location_type || 'Outros').trim() || 'Outros';
  const key = String(destination?.key || `${system}::${locationType}::${locationName || index}`).trim();
  return {
    ...destination,
    key,
    system,
    location_type: locationType,
    location_name: locationName,
    label: destination?.label || `${locationName} · ${system} · ${locationType}`,
  };
}

export default function TransferModal({
  itemName,
  quantity,
  unit = 'un',
  destinations = [],
  currentKey = '',
  title = 'TRANSFERIR PARA...',
  decimal = false,
  onConfirm,
  onCancel,
}) {
  const available = Math.max(0, Number(quantity) || 0);
  const currentValue = String(currentKey || '').trim();
  const normalizedDestinations = useMemo(
    () => (Array.isArray(destinations) ? destinations : [])
      .map(normalizeDestination)
      .filter(destination => destination.location_name),
    [destinations]
  );
  const options = useMemo(
    () => normalizedDestinations.filter(destination => (
      destination.key !== currentValue && destination.location_name !== currentValue
    )),
    [normalizedDestinations, currentValue]
  );

  const currentParts = currentValue.split('::');
  const initialOption = options.find(option => (
    option.system === currentParts[0] && option.location_type === currentParts[1]
  )) || options.find(option => option.system === currentParts[0]) || options[0] || null;
  const [selectedSystem, setSelectedSystem] = useState(initialOption?.system || '');
  const [selectedType, setSelectedType] = useState(initialOption?.location_type || '');
  const [destinationKey, setDestinationKey] = useState(initialOption?.key || '');
  const [amount, setAmount] = useState(String(available));
  const [error, setError] = useState('');

  const systems = useMemo(
    () => [...new Set(options.map(option => option.system))].sort((a, b) => a.localeCompare(b)),
    [options]
  );
  const typeOptions = useMemo(
    () => [...new Set(options.filter(option => option.system === selectedSystem).map(option => option.location_type))]
      .sort((a, b) => a.localeCompare(b)),
    [options, selectedSystem]
  );
  const locationOptions = useMemo(
    () => options
      .filter(option => option.system === selectedSystem && option.location_type === selectedType)
      .sort((a, b) => a.location_name.localeCompare(b.location_name)),
    [options, selectedSystem, selectedType]
  );

  function selectFirstLocation(system, type) {
    const first = options.find(option => option.system === system && option.location_type === type) || null;
    setDestinationKey(first?.key || '');
  }

  function handleSystemChange(event) {
    const system = event.target.value;
    const nextType = options.find(option => option.system === system)?.location_type || '';
    setSelectedSystem(system);
    setSelectedType(nextType);
    selectFirstLocation(system, nextType);
    setError('');
  }

  function handleTypeChange(event) {
    const type = event.target.value;
    setSelectedType(type);
    selectFirstLocation(selectedSystem, type);
    setError('');
  }

  function handleLocationChange(event) {
    setDestinationKey(event.target.value);
    setError('');
  }

  function handleConfirm() {
    const parsed = decimal ? parseCargoInput(amount, unit) : parseInt(amount, 10);
    if (!selectedSystem) { setError('Escolha um sistema.'); return; }
    if (!selectedType) { setError('Escolha o tipo de local.'); return; }
    if (!destinationKey) { setError('Escolha uma localização.'); return; }
    if (!Number.isFinite(parsed) || parsed <= 0) { setError('Informe uma quantidade válida.'); return; }
    if (parsed > available) { setError(`A quantidade não pode ultrapassar ${available} ${unit}.`); return; }
    const destination = options.find(option => option.key === destinationKey);
    if (!destination) { setError('Destino inválido.'); return; }
    onConfirm({ destination, quantity: parsed });
  }

  const selectStyle = {
    width: '100%',
    boxSizing: 'border-box',
    padding: '8px 10px',
    background: 'var(--bg-base)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 5,
    color: 'var(--text-primary)',
    fontFamily: '"Exo 2",sans-serif',
    fontSize: 12,
    outline: 'none',
  };

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.78)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:2200, padding:16 }} onClick={onCancel}>
      <div style={{ background:'var(--bg-card)', border:'1px solid rgba(56,189,248,0.4)', borderRadius:11, padding:20, width:'100%', maxWidth:460, boxShadow:'0 20px 60px rgba(0,0,0,0.7)' }} onClick={e=>e.stopPropagation()}>
        <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:10, marginBottom:14 }}>
          <div>
            <div style={{ fontFamily:'Michroma,sans-serif', fontSize:13, fontWeight:700, color:'var(--accent-primary)', letterSpacing:'0.06em' }}>{title}</div>
            <div style={{ fontSize:12, color:'var(--text-primary)', fontWeight:700, marginTop:5 }}>{itemName}</div>
            <div style={{ fontSize:10, color:'var(--text-muted)', marginTop:2 }}>Disponível: {available} {unit}</div>
          </div>
          <button onClick={onCancel} style={{ width:28, height:28, display:'flex', alignItems:'center', justifyContent:'center', background:'transparent', border:'1px solid var(--border-subtle)', borderRadius:5, color:'var(--text-muted)', cursor:'pointer' }}><X size={13}/></button>
        </div>

        <div style={{ display:'flex', flexDirection:'column', gap:5, marginBottom:10 }}>
          <label style={{ fontSize:10, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.08em' }}>1. Sistema</label>
          <div style={{ display:'flex', alignItems:'center', gap:7 }}>
            <MapPin size={13} style={{ color:'var(--accent-primary)', flexShrink:0 }}/>
            <select value={selectedSystem} onChange={handleSystemChange} style={selectStyle}>
              {!systems.length && <option value="">Nenhum sistema disponível</option>}
              {systems.map(system => <option key={system} value={system}>{system}</option>)}
            </select>
          </div>
        </div>

        <div style={{ display:'flex', flexDirection:'column', gap:5, marginBottom:10 }}>
          <label style={{ fontSize:10, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.08em' }}>2. Tipo de local</label>
          <select value={selectedType} onChange={handleTypeChange} disabled={!selectedSystem || !typeOptions.length} style={{ ...selectStyle, opacity: selectedSystem && typeOptions.length ? 1 : 0.55 }}>
            {!typeOptions.length && <option value="">Selecione um sistema primeiro</option>}
            {typeOptions.map(type => <option key={type} value={type}>{type}</option>)}
          </select>
        </div>

        <div style={{ display:'flex', flexDirection:'column', gap:5, marginBottom:12 }}>
          <label style={{ fontSize:10, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.08em' }}>3. Localização</label>
          <select value={destinationKey} onChange={handleLocationChange} disabled={!selectedType || !locationOptions.length} style={{ ...selectStyle, opacity: selectedType && locationOptions.length ? 1 : 0.55 }}>
            {!locationOptions.length && <option value="">Selecione o tipo de local primeiro</option>}
            {locationOptions.map(option => <option key={option.key} value={option.key}>{option.location_name}</option>)}
          </select>
          {selectedSystem && selectedType && locationOptions.length > 0 && (
            <div style={{ fontSize:10, color:'var(--text-muted)' }}>{locationOptions.length} localização{locationOptions.length !== 1 ? 'ões' : ''} disponível{locationOptions.length !== 1 ? 'eis' : ''} neste tipo.</div>
          )}
        </div>

        <div style={{ display:'flex', flexDirection:'column', gap:5, marginBottom:12 }}>
          <label style={{ fontSize:10, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.08em' }}>Quantidade a transferir</label>
          <input type={decimal ? 'text' : 'number'} inputMode={decimal ? 'decimal' : undefined} min={decimal?'0.000001':'1'} max={available} step={decimal ? (unit === 'kg' ? '0.001' : cargoInputStep(unit)) : '1'} value={amount} onChange={e=>{setAmount(e.target.value);setError('');}} onKeyDown={e=>e.key==='Enter'&&handleConfirm()} style={{ width:'100%', boxSizing:'border-box', padding:'8px 10px', background:'var(--bg-base)', border:'1px solid var(--border-subtle)', borderRadius:5, color:'var(--text-primary)', fontFamily:'Share Tech Mono,monospace', fontSize:13, outline:'none' }}/>
        </div>

        {error && <div style={{ fontSize:11, color:'var(--accent-red)', marginBottom:12 }}>{error}</div>}
        <div style={{ display:'flex', justifyContent:'flex-end', gap:8 }}>
          <button onClick={onCancel} style={{ padding:'7px 13px', background:'transparent', border:'1px solid var(--border-subtle)', borderRadius:5, color:'var(--text-secondary)', cursor:'pointer', fontSize:11, fontWeight:700 }}>Cancelar</button>
          <button onClick={handleConfirm} disabled={!locationOptions.length} style={{ display:'flex', alignItems:'center', gap:5, padding:'7px 13px', background:'rgba(52,211,153,0.1)', border:'1px solid rgba(52,211,153,0.3)', borderRadius:5, color:'var(--accent-green)', cursor:locationOptions.length?'pointer':'not-allowed', fontSize:11, fontWeight:700, opacity:locationOptions.length?1:0.5 }}>
            <CheckCircle2 size={12}/> Transferir
          </button>
        </div>
      </div>
    </div>
  );
}
