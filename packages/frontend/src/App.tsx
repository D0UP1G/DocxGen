import { useEffect } from 'react';
import { DocumentGenerator } from './components/DocumentGenerator';
import { Landing } from './components/Landing';
import { SiteHeader } from './components/SiteHeader';
import { useHashRoute } from './lib/useHashRoute';
import { useAppDispatch } from './hooks';
import { fetchCatalog } from './store/documentSlice';

function App() {
  const { route, navigate } = useHashRoute();
  const dispatch = useAppDispatch();
  useEffect(() => { dispatch(fetchCatalog()); }, [dispatch]);
  const goToApp = () => navigate('app');
  const goHome = () => navigate('landing');

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader variant={route === 'landing' ? 'landing' : 'app'} onStart={goToApp} onHome={goHome} />
      {route === 'landing' ? (
        <Landing onStart={goToApp} />
      ) : (
        <main className="px-5 py-10 sm:px-12 sm:py-14">
          <DocumentGenerator />
        </main>
      )}
    </div>
  );
}

export default App;
