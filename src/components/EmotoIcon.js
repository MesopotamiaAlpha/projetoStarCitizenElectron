import React from 'react';

/**
 * Ícone original do Emoto — cabeça de robô companheiro arredondada, com
 * "orelhas" laterais, olhos retangulares brilhantes e placa de queixo com
 * detalhe dourado. Interpretação própria/estilizada, não uma reprodução da
 * arte oficial do jogo.
 */
export default function EmotoIcon({ size = 28, className, style }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 64 64"
      className={className} style={style}
      fill="none" xmlns="http://www.w3.org/2000/svg"
    >
      {/* Orelhas / pods laterais */}
      <circle cx="9"  cy="33" r="6.5" fill="#161d2b" stroke="var(--accent-gold)" strokeWidth="1.4"/>
      <circle cx="55" cy="33" r="6.5" fill="#161d2b" stroke="var(--accent-gold)" strokeWidth="1.4"/>

      {/* Cúpula da cabeça */}
      <path
        d="M14 31 C14 15, 22 6, 32 6 C42 6, 50 15, 50 31 L50 39 C50 47.5, 42.5 53.5, 32 53.5 C21.5 53.5, 14 47.5, 14 39 Z"
        fill="#0c111c" stroke="var(--accent-primary)" strokeWidth="1.6"
      />

      {/* Reflexo sutil na cúpula */}
      <path d="M20 16 C23 11, 27 9, 31 8.5" stroke="var(--accent-primary)" strokeWidth="1" opacity="0.35" strokeLinecap="round"/>

      {/* Olhos */}
      <rect x="20.5" y="23" width="8" height="8" rx="1.6" fill="var(--accent-green)"/>
      <rect x="35.5" y="23" width="8" height="8" rx="1.6" fill="var(--accent-green)"/>

      {/* Placa de queixo */}
      <rect x="23" y="37" width="18" height="11" rx="3.5" fill="#131a28" stroke="var(--accent-gold)" strokeWidth="1.2"/>
      <rect x="29.5" y="40.5" width="5" height="4" rx="1" fill="var(--accent-gold)"/>

      {/* Luz da base */}
      <rect x="26" y="49.5" width="12" height="2.2" rx="1.1" fill="var(--accent-green)" opacity="0.85"/>
    </svg>
  );
}
