import { NavLink, Outlet } from 'react-router-dom';
import styled from 'styled-components';

const Shell = styled.div`
  min-height: 100%;
  display: flex;
  flex-direction: column;
`;

const NavBar = styled.nav`
  position: sticky;
  top: ${({ theme }) => theme.spacing.md};
  z-index: ${({ theme }) => theme.zIndex.nav};
  margin: ${({ theme }) => `${theme.spacing.md} auto 0`};
  width: fit-content;
  max-width: calc(100% - 2rem);
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.xs};
  padding: 7px 10px 7px 18px;
  background: ${({ theme }) => theme.colors.panelBg};
  backdrop-filter: blur(18px);
  border: 1px solid ${({ theme }) => theme.colors.border1};
  border-radius: ${({ theme }) => theme.radii.pill};
  box-shadow: ${({ theme }) => theme.shadows.nav};
  overflow-x: auto;
`;

const Brand = styled(NavLink)`
  display: inline-flex;
  align-items: center;
  gap: 9px;
  font-family: ${({ theme }) => theme.typography.fontFamily.display};
  font-size: ${({ theme }) => theme.typography.fontSize.navBrand};
  font-weight: ${({ theme }) => theme.typography.fontWeight.semibold};
  letter-spacing: ${({ theme }) => theme.typography.letterSpacing.brand};
  color: ${({ theme }) => theme.colors.text1};
  padding-right: ${({ theme }) => theme.spacing.sm};
  white-space: nowrap;
`;

const Spark = styled.span`
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: ${({ theme }) => theme.colors.amber};
  box-shadow: ${({ theme }) => theme.shadows.glowSm};
`;

const NavItem = styled(NavLink)`
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  color: ${({ theme }) => theme.colors.text2};
  padding: 8px 14px;
  border-radius: ${({ theme }) => theme.radii.pill};
  white-space: nowrap;
  transition: background 140ms ease, color 140ms ease;

  &:hover {
    color: ${({ theme }) => theme.colors.text1};
    background: ${({ theme }) => theme.colors.moonWash};
  }
  &.active {
    color: ${({ theme }) => theme.colors.night};
    background: ${({ theme }) => theme.colors.amber};
    font-weight: ${({ theme }) => theme.typography.fontWeight.medium};
  }
`;

const Main = styled.main`
  flex: 1;
`;

const Footer = styled.footer`
  border-top: 1px solid ${({ theme }) => theme.colors.border0};
  color: ${({ theme }) => theme.colors.text3};
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  text-align: center;
  padding: ${({ theme }) => `${theme.spacing.xl} ${theme.spacing.md}`};
  line-height: ${({ theme }) => theme.typography.lineHeight.relaxed};
`;

const NAV = [
  { to: '/', label: 'Explorer', end: true },
  { to: '/runs', label: 'Runs' },
  { to: '/suites', label: 'Suites' },
  { to: '/compare', label: 'Compare' },
  { to: '/methodology', label: 'Methodology' },
];

export function Layout() {
  return (
    <Shell>
      <NavBar>
        <Brand to="/" end>
          <Spark />
          Skulk Ledger
        </Brand>
        {NAV.map((n) => (
          <NavItem key={n.to} to={n.to} end={n.end}>
            {n.label}
          </NavItem>
        ))}
      </NavBar>
      <Main>
        <Outlet />
      </Main>
      <Footer>
        An honest results ledger for the Skulk distributed-inference fabric. Every number links to
        its raw run. Not a leaderboard.
        <br />
        Foxlight Foundation · measurements from the private Foxlight fleet.
      </Footer>
    </Shell>
  );
}
