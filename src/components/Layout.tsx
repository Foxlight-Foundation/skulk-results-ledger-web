import { Link, NavLink, Outlet } from 'react-router-dom';

import { TimeWindowControl } from './TimeWindowControl';
import styled, { css, keyframes } from 'styled-components';
import { FoxlightMark } from './FoxlightMark/FoxlightMark';

/**
 * Site shell, ported 1:1 from foxlight.ai's Nav + Footer (FoxlightWeb) so the
 * benchmarks property reads as the same host: identical floating glass pill,
 * FoxlightMark brand that links BACK to foxlight.ai, identical footer. Only
 * the center links (ledger routes) and a small "Benchmarks" chip differ.
 */

const slideDown = keyframes`
  from { opacity: 0; transform: translateY(-14px); }
  to   { opacity: 1; transform: none; }
`;

const Shell = styled.div`
  min-height: 100%;
  display: flex;
  flex-direction: column;
`;

const Floater = styled.div`
  position: fixed;
  top: 16px;
  left: 0;
  right: 0;
  z-index: ${({ theme }) => theme.zIndex.nav};
  display: flex;
  justify-content: center;
  padding: 0 24px;
  pointer-events: none;
  animation: ${slideDown} 0.5s ease backwards;

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }

  @media (max-width: 768px) {
    top: 10px;
    padding: 0 12px;
  }
`;

const Pill = styled.nav`
  pointer-events: all;
  width: 100%;
  max-width: 1100px;
  height: 52px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px 0 16px;
  background: rgba(11, 17, 36, 0.65);
  backdrop-filter: blur(24px) saturate(1.6) brightness(1.1);
  -webkit-backdrop-filter: blur(24px) saturate(1.6) brightness(1.1);
  border: 1px solid rgba(240, 237, 232, 0.1);
  border-radius: ${({ theme }) => theme.radii.pill};
  box-shadow: ${({ theme }) => theme.shadows.nav};
  transition:
    background 0.3s ease,
    box-shadow 0.3s ease;

  &:hover {
    background: rgba(11, 17, 36, 0.58);
    box-shadow: ${({ theme }) => theme.shadows.navHover};
  }

  @media (max-width: 768px) {
    padding: 0 14px 0 12px;
  }
`;

const BrandGroup = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
`;

/* The brand crosses hosts: it points at foxlight.ai, exactly like the brand
   on foxlight.ai points at its own root. Same mark, same type. */
const Brand = styled.a`
  display: flex;
  align-items: center;
  gap: 10px;
  text-decoration: none;
  font-family: ${({ theme }) => theme.typography.fontFamily.display};
  font-size: ${({ theme }) => theme.typography.fontSize.navBrand};
  font-weight: ${({ theme }) => theme.typography.fontWeight.semibold};
  color: ${({ theme }) => theme.colors.text1};
  letter-spacing: ${({ theme }) => theme.typography.letterSpacing.brand};
  white-space: nowrap;

  &:visited,
  &:hover {
    color: ${({ theme }) => theme.colors.text1};
  }
`;

/* Section identity: a quiet mono chip so the pill still reads "one site". */
const SectionChip = styled(NavLink)`
  font-family: ${({ theme }) => theme.typography.fontFamily.mono};
  font-size: 10px;
  font-weight: ${({ theme }) => theme.typography.fontWeight.semibold};
  letter-spacing: 0.7px;
  text-transform: uppercase;
  color: ${({ theme }) => theme.colors.text3};
  border: 1px solid ${({ theme }) => theme.colors.border1};
  border-radius: ${({ theme }) => theme.radii.pill};
  padding: 3px 10px;
  white-space: nowrap;
  transition: color 0.18s ease, border-color 0.18s ease;

  &:hover {
    color: ${({ theme }) => theme.colors.text1};
    border-color: ${({ theme }) => theme.colors.border2};
  }

  @media (max-width: 480px) {
    display: none;
  }
`;

const Links = styled.div`
  display: flex;
  gap: 2px;

  @media (max-width: 768px) {
    display: none;
  }
`;

const NavItem = styled(NavLink)`
  font-family: ${({ theme }) => theme.typography.fontFamily.body};
  font-size: 14px;
  font-weight: ${({ theme }) => theme.typography.fontWeight.medium};
  color: ${({ theme }) => theme.colors.text3};
  text-decoration: none;
  padding: 6px 12px;
  border-radius: ${({ theme }) => theme.radii.sm};
  white-space: nowrap;
  transition:
    color 0.18s ease,
    background 0.18s ease;

  &:visited {
    color: ${({ theme }) => theme.colors.text3};
  }

  &:hover {
    color: ${({ theme }) => theme.colors.text1};
    background: ${({ theme }) => theme.colors.border0};
  }

  &.active {
    color: ${({ theme }) => theme.colors.text1};
    background: ${({ theme }) => theme.colors.border0};
  }
`;

/* Same recipe as foxlight.ai's nav CTA. */
const NavCta = styled.a`
  background: ${({ theme }) => theme.colors.amber};
  color: ${({ theme }) => theme.colors.night};
  font-family: ${({ theme }) => theme.typography.fontFamily.body};
  font-size: 13px;
  font-weight: ${({ theme }) => theme.typography.fontWeight.semibold};
  padding: 7px 18px;
  border-radius: ${({ theme }) => theme.radii.pill};
  text-decoration: none;
  display: inline-block;
  white-space: nowrap;
  box-shadow:
    0 0 16px rgba(255, 149, 0, 0.4),
    0 2px 8px rgba(0, 0, 0, 0.3);
  letter-spacing: -0.1px;
  transition:
    background 0.18s ease,
    box-shadow 0.18s ease,
    transform 0.14s ease;

  &:visited {
    color: ${({ theme }) => theme.colors.night};
  }

  &:hover {
    background: ${({ theme }) => theme.colors.amberHi};
    box-shadow:
      0 0 28px rgba(255, 149, 0, 0.55),
      0 2px 8px rgba(0, 0, 0, 0.3);
    transform: translateY(-1px);
  }
`;

/* Fixed nav means content clears it with top padding (52px pill + offsets). */
const Main = styled.main`
  flex: 1;
  position: relative;
  z-index: 1;
  padding-top: 92px;

  @media (max-width: 768px) {
    padding-top: 78px;
  }
`;

/* Global, persistent period selector: one control that scopes every page's
   data to the selected window. Aligned to the page content width. */
const PeriodBar = styled.div`
  max-width: 1100px;
  margin: 0 auto;
  padding: ${({ theme }) => `0 ${theme.spacing.lg}`};
  display: flex;
  justify-content: flex-end;

  @media (max-width: ${({ theme }) => theme.breakpoints.md}) {
    padding: ${({ theme }) => `0 ${theme.spacing.md}`};
    justify-content: flex-start;
  }
`;

const FooterWrapper = styled.footer`
  position: relative;
  z-index: 1;
  border-top: 1px solid ${({ theme }) => theme.colors.border0};
  padding: 48px 40px 36px;
  background-color: rgba(0, 0, 0, 0.3);
  backdrop-filter: blur(7px);
  -webkit-backdrop-filter: blur(24px) saturate(1.6) brightness(1.1);

  @media (max-width: 768px) {
    padding: 36px 20px;
  }
`;

const FooterTop = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 36px;
`;

const FooterBrand = styled.div`
  font-family: ${({ theme }) => theme.typography.fontFamily.display};
  font-size: 17px;
  font-weight: ${({ theme }) => theme.typography.fontWeight.semibold};
  color: ${({ theme }) => theme.colors.text1};
  letter-spacing: -0.3px;
`;

const Columns = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 40px;
  margin-bottom: 40px;

  @media (max-width: 768px) {
    grid-template-columns: 1fr 1fr;
    gap: 28px;
  }
`;

const ColumnHeading = styled.div`
  font-family: ${({ theme }) => theme.typography.fontFamily.mono};
  font-size: 10px;
  font-weight: ${({ theme }) => theme.typography.fontWeight.semibold};
  color: ${({ theme }) => theme.colors.text1};
  letter-spacing: 0.7px;
  text-transform: uppercase;
  margin-bottom: 16px;
`;

const columnLinkCss = css`
  display: block;
  font-size: 13px;
  color: ${({ theme }) => theme.colors.text3};
  text-decoration: none;
  padding: 4px 0;
  transition: color 0.18s ease;

  &:visited {
    color: ${({ theme }) => theme.colors.text3};
  }

  &:hover {
    color: ${({ theme }) => theme.colors.text1};
  }
`;

const ColumnLink = styled.a`
  ${columnLinkCss}
`;

/* Internal ledger routes go through the router (respects the configured
   base path, no full-page reload); external links stay plain anchors. */
const ColumnRouteLink = styled(Link)`
  ${columnLinkCss}
`;

const FooterBottom = styled.div`
  border-top: 1px solid ${({ theme }) => theme.colors.border0};
  padding-top: 24px;
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const Copy = styled.div`
  font-size: 12px;
  color: ${({ theme }) => theme.colors.text3};
`;

const NAV = [
  { to: '/', label: 'Explorer', end: true },
  { to: '/runs', label: 'Runs' },
  { to: '/suites', label: 'Suites' },
  { to: '/hardware', label: 'Hardware' },
  { to: '/compare', label: 'Compare' },
  { to: '/methodology', label: 'Methodology' },
];

const FOOTER_COLUMNS = [
  {
    heading: 'Benchmarks',
    links: [
      { label: 'Explorer', href: '/' },
      { label: 'Runs', href: '/runs' },
      { label: 'Suites', href: '/suites' },
      { label: 'Hardware', href: '/hardware' },
      { label: 'Compare', href: '/compare' },
      { label: 'Methodology', href: '/methodology' },
    ],
  },
  {
    heading: 'Products',
    links: [
      { label: 'Skulk', href: 'https://foxlight.ai/products/skulk' },
      { label: 'Foxmemory', href: 'https://foxlight.ai/products/foxmemory' },
      { label: 'Foxden', href: 'https://foxlight.ai/products/foxden' },
      { label: 'Open Source', href: 'https://foxlight.ai/open' },
    ],
  },
  {
    heading: 'Company',
    links: [
      { label: 'Vision', href: 'https://foxlight.ai/vision' },
      { label: 'Foundation', href: 'https://foxlight.ai/foundation' },
      { label: 'Blog', href: 'https://foxlight.ai/blog' },
    ],
  },
  {
    heading: 'Legal',
    links: [
      { label: 'Privacy', href: 'https://foxlight.ai/legal/privacy' },
      { label: 'Terms', href: 'https://foxlight.ai/legal/terms' },
      {
        label: 'GitHub',
        href: 'https://github.com/Foxlight-Foundation',
        external: true,
      },
    ],
  },
];

export function Layout() {
  return (
    <Shell>
      <Floater>
        <Pill aria-label="Primary">
          <BrandGroup>
            <Brand href="https://foxlight.ai" aria-label="FoxlightAI home">
              <FoxlightMark height={34} />
              FoxlightAI®
            </Brand>
            <SectionChip to="/" end>
              Benchmarks
            </SectionChip>
          </BrandGroup>
          <Links>
            {NAV.map((n) => (
              <NavItem key={n.to} to={n.to} end={n.end}>
                {n.label}
              </NavItem>
            ))}
          </Links>
          <NavCta href="https://foxlight.ai/products/skulk">Get Skulk</NavCta>
        </Pill>
      </Floater>
      <Main>
        <PeriodBar>
          <TimeWindowControl />
        </PeriodBar>
        <Outlet />
      </Main>
      <FooterWrapper>
        <FooterTop>
          <FoxlightMark width={34} height={34} />
          <FooterBrand>FoxlightAI®</FooterBrand>
        </FooterTop>
        <Columns>
          {FOOTER_COLUMNS.map((col) => (
            <div key={col.heading}>
              <ColumnHeading>{col.heading}</ColumnHeading>
              {col.links.map((link) =>
                link.href.startsWith('/') ? (
                  <ColumnRouteLink key={link.href} to={link.href}>
                    {link.label}
                  </ColumnRouteLink>
                ) : (
                  <ColumnLink
                    key={link.href}
                    href={link.href}
                    {...('external' in link && link.external
                      ? { target: '_blank', rel: 'noopener noreferrer' }
                      : {})}
                  >
                    {link.label}
                  </ColumnLink>
                ),
              )}
            </div>
          ))}
        </Columns>
        <FooterBottom>
          <Copy>© 2026 FoxlightAI®, Inc.</Copy>
          <Copy>
            An honest results ledger for the Skulk distributed-inference fabric. Every number links
            to its raw run.
          </Copy>
        </FooterBottom>
      </FooterWrapper>
    </Shell>
  );
}
