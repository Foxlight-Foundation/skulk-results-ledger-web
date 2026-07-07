import styled, { keyframes } from 'styled-components';

import { Page, Panel } from './primitives';

const pulse = keyframes`
  0%, 100% { opacity: 0.4; }
  50% { opacity: 0.8; }
`;

const Center = styled(Panel)`
  padding: ${({ theme }) => theme.spacing.xxl};
  text-align: center;
  color: ${({ theme }) => theme.colors.text3};
`;

const Loading = styled(Center)`
  animation: ${pulse} 1.4s ease-in-out infinite;
`;

export function LoadingState({ label = 'Loading ledger…' }: { label?: string }) {
  return (
    <Page>
      <Loading>{label}</Loading>
    </Page>
  );
}

export function ErrorState({ error }: { error: string }) {
  return (
    <Page>
      <Center>
        <strong>Could not load data.</strong>
        <div style={{ marginTop: 8 }}>{error}</div>
        <div style={{ marginTop: 12, fontSize: 13 }}>
          Run <code>npm run import</code> to generate <code>public/data/</code> from harness runs.
        </div>
      </Center>
    </Page>
  );
}

export function EmptyState({ label }: { label: string }) {
  return (
    <Center>
      <div>{label}</div>
    </Center>
  );
}
