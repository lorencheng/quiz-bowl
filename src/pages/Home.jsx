import { Link } from 'react-router-dom'

export default function Home() {
  return (
    <div className="home">
      <h1>QuizBowl TTS</h1>
      <p>Quiz bowl practice with text-to-speech</p>
      <nav className="home-nav">
        <Link to="/practice/tossup" className="nav-card">
          <h2>Tossup Practice</h2>
          <p>Practice tossups with questions read aloud</p>
        </Link>
        <Link to="/practice/bonus" className="nav-card">
          <h2>Bonus Practice</h2>
          <p>Practice bonuses with questions read aloud</p>
        </Link>
        <Link to="/multiplayer" className="nav-card">
          <h2>Multiplayer</h2>
          <p>Join existing qbreader rooms</p>
        </Link>
      </nav>
    </div>
  )
}
