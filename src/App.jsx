import { BrowserRouter, Routes, Route, Link } from 'react-router-dom'
import Home from './pages/Home'
import TossupPractice from './pages/TossupPractice'
import BonusPractice from './pages/BonusPractice'
import Multiplayer from './pages/Multiplayer'
import './App.css'

function App() {
  return (
    <BrowserRouter>
      <header className="app-header">
        <Link to="/" className="app-title">QuizBowl TTS</Link>
      </header>
      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/practice/tossup" element={<TossupPractice />} />
          <Route path="/practice/bonus" element={<BonusPractice />} />
          <Route path="/multiplayer" element={<Multiplayer />} />
        </Routes>
      </main>
    </BrowserRouter>
  )
}

export default App
