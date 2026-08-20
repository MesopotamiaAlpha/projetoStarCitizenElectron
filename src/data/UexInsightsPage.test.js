import { trendQualityRequests } from './UexInsightsPage';

describe('Análise de lucro — consulta de qualidade', () => {
  test('usa o endpoint agregado quando nenhuma qualidade é escolhida', () => {
    expect(trendQualityRequests('')).toEqual(['']);
    expect(trendQualityRequests(null)).toEqual(['']);
  });

  test('mantém uma consulta específica quando o usuário escolhe um tier', () => {
    expect(trendQualityRequests('5')).toEqual(['5']);
    expect(trendQualityRequests(7)).toEqual(['7']);
  });
});
