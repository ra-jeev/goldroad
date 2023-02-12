import { useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';

import { FirebaseProvider } from './providers/Firebase';
import { AppDataProvider } from './providers/AppData';
import { Layout } from './components/Layout';
import { Game } from './components/Game';
import { About } from './components/About';
import { Games } from './components/Games';
import { Stats } from './components/Stats';
import { SignIn } from './components/SignIn';
import './App.css';

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
              sounds={gameSoundsSetting}
              onSettingChange={onGameSoundsSettingChange}
            />
          }
        >
          <Route index element={<Game sounds={gameSoundsSetting} />} />
          <Route path='/about' element={<About />} />
          <Route path='/games' element={<Games />} />
          <Route
            path='/games/:gameId'
            element={<Game sounds={gameSoundsSetting} />}
          />
          <Route path='/stats' element={<Stats />} />
          <Route path='/sign-in' element={<SignIn />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

function App() {
  return (
    <FirebaseProvider>
      <AppDataProvider>
        <AppRoutes />
      </AppDataProvider>
    </FirebaseProvider>
  );
}

export default App;
