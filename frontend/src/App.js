import { useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';

import { Layout } from './components/Layout';
import { Game } from './components/Game';
import { About } from './components/About';
import { Games } from './components/Games';
import { RealmAppProvider } from './components/RealmApp';
import './App.css';
import { Stats } from './components/Stats';

function AppRoutes() {
  const getSavedGameSoundsSetting = () => {
    return localStorage.getItem('sounds') || 'on';
  };

  const saveGameSoundsSetting = (value) => {
    localStorage.setItem('sounds', value);
  };

  const [gameSoundsSetting, setGameSoundsSetting] = useState(
    getSavedGameSoundsSetting()
  );

  const [gameNo, setGameNo] = useState(null);

  const onGameSoundsSettingChange = () => {
    const newValue = gameSoundsSetting === 'on' ? 'off' : 'on';
    saveGameSoundsSetting(newValue);
    setGameSoundsSetting(newValue);
  };

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path='/'
          element={
            <Layout
              gameNo={gameNo}
              sounds={gameSoundsSetting}
              onSettingChange={onGameSoundsSettingChange}
            />
          }
        >
          <Route
            index
            element={<Game sounds={gameSoundsSetting} onGameNo={setGameNo} />}
          />
          <Route path='/about' element={<About />} />
          <Route path='/games' element={<Games />} />
          <Route
            path='/games/:gameId'
            element={<Game sounds={gameSoundsSetting} onGameNo={setGameNo} />}
          />
          <Route path='/stats' element={<Stats />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

function App() {
  return (
    <RealmAppProvider>
      <AppRoutes />
    </RealmAppProvider>
  );
}

export default App;
