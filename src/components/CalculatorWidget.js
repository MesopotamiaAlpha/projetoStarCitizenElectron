import React, { useEffect, useState } from 'react';
import { Calculator, GripHorizontal, RotateCcw, X } from 'lucide-react';
import { SCU_CALCULATOR_UNITS, calculateScuValue } from '../data/scuCalculator';

function formatNumberForDisplay(value) {
  const raw = String(value ?? '');
  if (!raw) return raw;
  const [integerPart, fractionPart] = raw.split('.');
  const numericInteger = Number(integerPart || 0);
  if (!Number.isFinite(numericInteger)) return raw;
  const formattedInteger = numericInteger.toLocaleString('pt-BR', {
    maximumFractionDigits: 0,
  });
  return fractionPart !== undefined ? `${formattedInteger},${fractionPart}` : formattedInteger;
}

function formatExpressionForDisplay(expression) {
  return String(expression || '').replace(/\d+(?:\.\d+)?/g, formatNumberForDisplay);
}

function formatResultForDisplay(value) {
  return Number(value).toLocaleString('pt-BR', { maximumFractionDigits: 10 });
}

function evaluateExpression(expression) {
  const normalized = String(expression || '')
    .replace(/×/g, '*')
    .replace(/÷/g, '/')
    .replace(/,/g, '.')
    .replace(/(\d+(?:\.\d+)?)%/g, '($1/100)');

  if (!normalized || !/^[0-9+\-*/().\s]+$/.test(normalized)) throw new Error('Expressão inválida');
  // A expressão é formada apenas pelos caracteres permitidos acima.
  const value = Function(`"use strict"; return (${normalized})`)();
  if (!Number.isFinite(value)) throw new Error('Resultado inválido');
  return Number(value.toFixed(10));
}

const BUTTONS = [
  { label:'AC', action:'clear', tone:'danger' },
  { label:'⌫', action:'backspace', icon:RotateCcw, tone:'muted' },
  { label:'%', value:'%', tone:'operator' },
  { label:'÷', value:'÷', tone:'operator' },
  { label:'7', value:'7' },
  { label:'8', value:'8' },
  { label:'9', value:'9' },
  { label:'×', value:'×', tone:'operator' },
  { label:'4', value:'4' },
  { label:'5', value:'5' },
  { label:'6', value:'6' },
  { label:'−', value:'-', tone:'operator' },
  { label:'1', value:'1' },
  { label:'2', value:'2' },
  { label:'3', value:'3' },
  { label:'+', value:'+', tone:'operator' },
  { label:'0', value:'0', wide:true },
  { label:'.', value:'.' },
  { label:'=', action:'equals', tone:'equals' },
];

export default function CalculatorWidget() {
  const [open, setOpen] = useState(false);
  const [calculatorMode, setCalculatorMode] = useState('normal');
  const [expression, setExpression] = useState('');
  const [displayResult, setDisplayResult] = useState('0');
  const [error, setError] = useState(false);
  const [justEvaluated, setJustEvaluated] = useState(false);
  const [scuInputUnit, setScuInputUnit] = useState('SCU');
  const [scuOutputUnit, setScuOutputUnit] = useState('SCU');
  const [scuSummary, setScuSummary] = useState(null);

  function resetCalculator() {
    setExpression('');
    setDisplayResult('0');
    setError(false);
    setJustEvaluated(false);
    setScuSummary(null);
  }

  function changeMode(nextMode) {
    if (nextMode === calculatorMode) return;
    setCalculatorMode(nextMode);
    resetCalculator();
  }

  function calculate(value = expression) {
    try {
      const arithmeticResult = evaluateExpression(value);
      if (calculatorMode === 'scu') {
        const converted = calculateScuValue(arithmeticResult, scuInputUnit, scuOutputUnit);
        setDisplayResult(`${formatResultForDisplay(converted.output)} ${converted.outputUnit}`);
        setScuSummary(converted.summary);
      } else {
        setDisplayResult(formatResultForDisplay(arithmeticResult));
        setScuSummary(null);
      }
      // Mantemos a expressão no valor aritmético da unidade de entrada para
      // permitir continuar somando/subtraindo sem misturar unidade de saída.
      setExpression(String(arithmeticResult));
      setError(false);
      setJustEvaluated(true);
    } catch {
      setDisplayResult('Erro');
      setError(true);
      setJustEvaluated(true);
    }
  }

  function appendValue(value) {
    setError(false);
    setJustEvaluated(false);
    setScuSummary(null);
    setExpression(prev => {
      const current = justEvaluated && !['+','-','×','÷','%'].includes(value) ? '' : prev;
      if (value === '.') {
        const lastNumber = current.split(/[+\-×÷]/).pop() || '';
        if (lastNumber.includes('.')) return current;
        if (!current || /[+\-×÷]$/.test(current)) return `${current}0.`;
      }
      if (['+','-','×','÷'].includes(value)) {
        if (!current && value !== '-') return current;
        if (/[+\-×÷]$/.test(current)) return `${current.slice(0,-1)}${value}`;
      }
      if (value === '%' && (!current || /[+\-×÷%]$/.test(current))) return current;
      return `${current}${value}`;
    });
  }

  function handleButton(button) {
    if (button.action === 'clear') {
      resetCalculator();
      return;
    }
    if (button.action === 'backspace') {
      setExpression(prev => prev.slice(0, -1));
      setError(false);
      setJustEvaluated(false);
      setScuSummary(null);
      return;
    }
    if (button.action === 'equals') {
      calculate();
      return;
    }
    appendValue(button.value);
  }

  useEffect(() => {
    function handleKeyDown(event) {
      if (!open) return;
      const key = event.key;
      if (/^[0-9.]$/.test(key)) { appendValue(key); event.preventDefault(); }
      else if (['+','-'].includes(key)) { appendValue(key); event.preventDefault(); }
      else if (key === '*') { appendValue('×'); event.preventDefault(); }
      else if (key === '/') { appendValue('÷'); event.preventDefault(); }
      else if (key === '%') { appendValue('%'); event.preventDefault(); }
      else if (key === 'Enter' || key === '=') { calculate(); event.preventDefault(); }
      else if (key === 'Backspace') { handleButton({ action:'backspace' }); event.preventDefault(); }
      else if (key === 'Escape') { setOpen(false); event.preventDefault(); }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  const panelStyle = {
    position:'fixed', right:12, bottom:12, width:'min(320px, calc(100vw - 24px))', maxWidth:'calc(100vw - 24px)', zIndex:4000, pointerEvents:'auto',
    background:'var(--bg-card)', border:'1px solid rgba(56,189,248,0.38)',
    borderRadius:12, boxShadow:'0 18px 55px rgba(0,0,0,0.58), 0 0 0 1px rgba(56,189,248,0.08)',
    overflow:'hidden', fontFamily:'"Exo 2",sans-serif',
  };
  const buttonStyle = (button) => ({
    minHeight:42, gridColumn:button.wide?'span 2':'auto',
    border:`1px solid ${button.tone==='equals'?'rgba(52,211,153,0.4)':button.tone==='operator'?'rgba(56,189,248,0.3)':'var(--border-subtle)'}`,
    borderRadius:6, background:button.tone==='equals'?'rgba(52,211,153,0.15)':button.tone==='operator'?'rgba(56,189,248,0.1)':button.tone==='danger'?'rgba(251,113,133,0.1)':'rgba(255,255,255,0.035)',
    color:button.tone==='equals'?'var(--accent-green)':button.tone==='operator'?'var(--accent-primary)':button.tone==='danger'?'var(--accent-red)':'var(--text-primary)',
    cursor:'pointer', fontFamily:'Share Tech Mono,monospace', fontSize:button.tone==='danger'?11:16, fontWeight:700,
    display:'flex', alignItems:'center', justifyContent:'center', transition:'all 0.12s',
  });
  const modeButtonStyle = (active) => ({
    flex:1, padding:'6px 7px', border:`1px solid ${active?'rgba(56,189,248,0.42)':'var(--border-subtle)'}`,
    borderRadius:5, background:active?'rgba(56,189,248,0.14)':'transparent', color:active?'var(--accent-primary)':'var(--text-muted)',
    cursor:'pointer', fontFamily:'"Exo 2",sans-serif', fontSize:10, fontWeight:800, textTransform:'uppercase', letterSpacing:'0.04em',
  });
  const unitSelectStyle = { flex:1, minWidth:0, padding:'6px 7px', background:'var(--bg-base)', border:'1px solid var(--border-subtle)', borderRadius:5, color:'var(--text-primary)', fontFamily:'Share Tech Mono,monospace', fontSize:11 };

  return (
    <>
      {!open && (
        <button className="calculator-launcher" onClick={()=>setOpen(true)} title="Abrir calculadora" aria-label="Abrir calculadora" style={{position:'fixed',right:12,bottom:12,zIndex:3999,width:46,height:46,borderRadius:'50%',border:'1px solid rgba(56,189,248,0.45)',background:'rgba(13,23,38,0.96)',color:'var(--accent-primary)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',boxShadow:'0 8px 25px rgba(0,0,0,0.45),0 0 18px rgba(56,189,248,0.12)',pointerEvents:'auto'}}>
          <Calculator size={20}/>
        </button>
      )}
      {open && (
        <div className="calculator-panel" style={panelStyle} role="dialog" aria-label="Calculadora flutuante">
          <div className="calculator-header" style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'9px 11px',background:'rgba(56,189,248,0.07)',borderBottom:'1px solid rgba(56,189,248,0.18)'}}>
            <div style={{display:'flex',alignItems:'center',gap:7,color:'var(--accent-primary)',fontSize:11,fontWeight:700,letterSpacing:'0.08em',textTransform:'uppercase'}}><Calculator size={14}/> Calculadora</div>
            <div style={{display:'flex',alignItems:'center',gap:5}}>
              <GripHorizontal size={14} style={{color:'var(--text-muted)'}}/>
              <button className="calculator-close" onClick={()=>setOpen(false)} title="Fechar calculadora" aria-label="Fechar calculadora" style={{width:23,height:23,display:'flex',alignItems:'center',justifyContent:'center',background:'transparent',border:'1px solid var(--border-subtle)',borderRadius:4,color:'var(--text-muted)',cursor:'pointer'}}><X size={12}/></button>
            </div>
          </div>

          <div style={{display:'flex',gap:6,padding:'9px 11px 0'}}>
            <button type="button" onClick={()=>changeMode('normal')} style={modeButtonStyle(calculatorMode==='normal')}>Modo Normal</button>
            <button type="button" onClick={()=>changeMode('scu')} style={modeButtonStyle(calculatorMode==='scu')}>Modo SCU</button>
          </div>

          {calculatorMode === 'scu' && (
            <div style={{padding:'8px 11px 0'}}>
              <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:5}}>
                <select aria-label="Unidade de entrada SCU" value={scuInputUnit} onChange={e=>{setScuInputUnit(e.target.value);setScuSummary(null);}} style={unitSelectStyle}>
                  {SCU_CALCULATOR_UNITS.map(unit=><option key={unit} value={unit}>{unit}</option>)}
                </select>
                <span style={{color:'var(--text-muted)',fontSize:10}}>→</span>
                <select aria-label="Unidade de saída SCU" value={scuOutputUnit} onChange={e=>{setScuOutputUnit(e.target.value);setScuSummary(null);}} style={unitSelectStyle}>
                  {SCU_CALCULATOR_UNITS.map(unit=><option key={unit} value={unit}>{unit}</option>)}
                </select>
              </div>
              <div style={{fontSize:9,color:'var(--text-muted)',fontFamily:'Share Tech Mono,monospace'}}>1 SCU = 100 cSCU = 100 Units</div>
            </div>
          )}

          <div className="calculator-display" style={{padding:'12px 12px 9px',background:'rgba(0,0,0,0.12)'}}>
            <div style={{minHeight:18,textAlign:'right',color:'var(--text-muted)',fontFamily:'Share Tech Mono,monospace',fontSize:12,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{formatExpressionForDisplay(expression) || '0'}</div>
            <div style={{minHeight:32,textAlign:'right',color:error?'var(--accent-red)':'var(--text-primary)',fontFamily:'Michroma,sans-serif',fontSize:22,fontWeight:800,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{displayResult}</div>
            {calculatorMode === 'scu' && scuSummary && (
              <div style={{marginTop:6,paddingTop:6,borderTop:'1px solid rgba(56,189,248,0.14)',fontSize:9,lineHeight:1.45,color:'var(--accent-primary)',fontFamily:'Share Tech Mono,monospace',textAlign:'right',wordBreak:'break-word'}}>{scuSummary.text}</div>
            )}
          </div>

          <div className="calculator-keypad" style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:6,padding:11}}>
            {BUTTONS.map((button,index)=>(
              <button className={`calculator-key ${button.tone ? `tone-${button.tone}` : ''}`} key={`${button.label}-${index}`} onClick={()=>handleButton(button)} style={buttonStyle(button)}>
                {button.icon ? <button.icon size={15}/> : button.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
