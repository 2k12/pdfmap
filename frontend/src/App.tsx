import { NavLink, Route, Routes } from 'react-router-dom';
import { FilesPage } from './features/files/FilesPage';
import { MapperPage } from './features/mapper/MapperPage';
import { TemplatesPage } from './features/templates/TemplatesPage';

export function App() {
  return (
    <div className="app">
      <a href="#contenido" className="skip-link">
        Saltar al contenido
      </a>
      <header className="topbar">
        <span className="brand">PDF Mapper</span>
        <nav aria-label="Principal">
          <NavLink to="/" end>
            Archivos
          </NavLink>
          <NavLink to="/templates">Plantillas</NavLink>
        </nav>
      </header>
      <div id="contenido" className="content">
        <Routes>
          <Route path="/" element={<FilesPage />} />
          <Route path="/files/:fileId/map" element={<MapperPage />} />
          <Route path="/templates" element={<TemplatesPage />} />
          <Route path="*" element={<p className="empty">Página no encontrada.</p>} />
        </Routes>
      </div>
    </div>
  );
}
