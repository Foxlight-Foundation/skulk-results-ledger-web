import styled from 'styled-components';

import { PassRateChip } from '../components/Chip';
import { BigNumber, Eyebrow, Grid, Muted, Page, Panel, Row } from '../components/primitives';
import { ErrorState, LoadingState } from '../components/States';
import { formatDate } from '../data/format';
import { useIndex } from '../data/useLedger';

const Title = styled.h1`
  font-size: ${({ theme }) => theme.typography.fontSize.sectionH};
  letter-spacing: ${({ theme }) => theme.typography.letterSpacing.section};
`;

const Sub = styled.p`
  color: ${({ theme }) => theme.colors.text2};
  max-width: 58ch;
  margin: ${({ theme }) => theme.spacing.sm} 0 ${({ theme }) => theme.spacing.lg};
`;

const Card = styled(Panel)`
  padding: ${({ theme }) => theme.spacing.lg};
`;

const SuiteName = styled.h3`
  font-family: ${({ theme }) => theme.typography.fontFamily.mono};
  font-size: ${({ theme }) => theme.typography.fontSize.md};
  color: ${({ theme }) => theme.colors.text1};
  margin-bottom: ${({ theme }) => theme.spacing.md};
  word-break: break-word;
`;

const Line = styled(Row)`
  justify-content: space-between;
  padding: 6px 0;
  border-top: 1px solid ${({ theme }) => theme.colors.border0};
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
`;

export function SuitesPage() {
  const { data, error, loading } = useIndex();
  if (loading) return <LoadingState />;
  if (error) return <ErrorState error={error} />;
  if (!data) return <ErrorState error="No index." />;

  return (
    <Page>
      <Eyebrow>Coverage</Eyebrow>
      <Title>Test suites</Title>
      <Sub>
        Each suite is a named battery of assertions run against a set of models. Pass rate is across
        every result the suite has ever recorded, not a cherry-picked best.
      </Sub>
      <Grid $min="300px">
        {data.suites.map((s) => (
          <Card key={s.testSet}>
            <SuiteName>{s.testSet}</SuiteName>
            <Row $justify="space-between">
              <div>
                <BigNumber>{s.runCount}</BigNumber>
                <Muted>runs</Muted>
              </div>
              <PassRateChip passRate={s.passRate} />
            </Row>
            <div style={{ marginTop: 16 }}>
              <Line>
                <Muted>Models covered</Muted>
                <span>{s.modelCount}</span>
              </Line>
              <Line>
                <Muted>Total results</Muted>
                <span>{s.totalResults}</span>
              </Line>
              <Line>
                <Muted>Last run</Muted>
                <span>{formatDate(s.lastRunAt)}</span>
              </Line>
            </div>
          </Card>
        ))}
      </Grid>
    </Page>
  );
}
