import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';

import { Layout } from './components/Layout';
import { ShootingStars } from './components/ShootingStars/ShootingStars';
import { StarField } from './components/StarField/StarField';
import { ComparePage } from './pages/ComparePage';
import { ExplorerPage } from './pages/ExplorerPage';
import { HardwarePage } from './pages/HardwarePage';
import { MethodologyPage } from './pages/MethodologyPage';
import { ModelPage } from './pages/ModelPage';
import { RunPage } from './pages/RunPage';
import { RunsPage } from './pages/RunsPage';
import { SuitesPage } from './pages/SuitesPage';

const BASENAME = import.meta.env.BASE_URL.replace(/\/$/, '');

/** Client-side routes. All data is static; there is no server. */
export function App() {
  return (
    <BrowserRouter basename={BASENAME || undefined}>
      {/* Atmosphere layers from foxlight.ai: fixed to the viewport, above the
          sky image, below all content. Same mount shape as FoxlightWeb. */}
      <StarField />
      <ShootingStars />
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<ExplorerPage />} />
          <Route path="model/:slug" element={<ModelPage />} />
          <Route path="runs" element={<RunsPage />} />
          <Route path="run/:runId" element={<RunPage />} />
          <Route path="suites" element={<SuitesPage />} />
          <Route path="hardware" element={<HardwarePage />} />
          <Route path="compare" element={<ComparePage />} />
          <Route path="methodology" element={<MethodologyPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
