// ============================================================================
// FLAGS DE DEBUG — Companheiro Emoto
// ============================================================================
//
// O aplicativo deve ser entregue com todas as flags desligadas.
// Para ativar uma ferramenta durante o desenvolvimento, descomente a linha
// marcada com "ATIVAR" e reinicie o dev server ou gere uma nova build.
//
// Não use localStorage para essas flags: elas são deliberadamente controladas
// pelo código-fonte e não ficam disponíveis para o usuário final.

export const ENABLE_FX_DIAGNOSTICS = false;
// export const ENABLE_FX_DIAGNOSTICS = true; // ATIVAR: Diagnóstico FX visual

export const ENABLE_MISSION_MONITOR_DEBUG = false;
// export const ENABLE_MISSION_MONITOR_DEBUG = true; // ATIVAR: logs detalhados do monitor

export const ENABLE_CALCULATOR_DEBUG = false;
// export const ENABLE_CALCULATOR_DEBUG = true; // ATIVAR: estado interno da calculadora

export const ENABLE_PROFILE_DEBUG = false;
// export const ENABLE_PROFILE_DEBUG = true; // ATIVAR: estado dos cards 3D/profile

export const ENABLE_LAYOUT_DEBUG = false;
// export const ENABLE_LAYOUT_DEBUG = true; // ATIVAR: diagnóstico de layout

export const ENABLE_DEBUG_CONSOLE = false;
// export const ENABLE_DEBUG_CONSOLE = true; // ATIVAR: logs técnicos auxiliares

export const DEBUG_FLAGS = Object.freeze({
  fxDiagnostics: ENABLE_FX_DIAGNOSTICS,
  missionMonitor: ENABLE_MISSION_MONITOR_DEBUG,
  calculator: ENABLE_CALCULATOR_DEBUG,
  profile: ENABLE_PROFILE_DEBUG,
  layout: ENABLE_LAYOUT_DEBUG,
  console: ENABLE_DEBUG_CONSOLE,
});
