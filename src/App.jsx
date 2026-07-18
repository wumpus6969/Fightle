import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Barbell,
  ChartBar,
  CheckCircle,
  Fire,
  MagnifyingGlass,
  Question,
  ShareNetwork,
  Skull,
  Trophy,
  X,
} from "@phosphor-icons/react";

const divisions = ["FLW", "BW", "FW", "LW", "WW", "MW", "LHW", "HW"];
const assetUrl = (path) => `${import.meta.env.BASE_URL}${path}`;

const fighters = [
  { name: "Charles Oliveira", division: "LW", country: "Brazil", iso: "br", rank: 3, age: 36, height: 70 },
  { name: "Cory Sandhagen", division: "BW", country: "United States", iso: "us", rank: 5, age: 34, height: 71 },
  { name: "Johnny Walker", division: "LHW", country: "Brazil", iso: "br", rank: 15, age: 34, height: 78 },
  { name: "Dan Hooker", division: "LW", country: "New Zealand", iso: "nz", rank: 6, age: 36, height: 72 },
  { name: "Michael Chandler", division: "LW", country: "United States", iso: "us", rank: null, age: 40, height: 68 },
  { name: "Jiri Prochazka", division: "LHW", country: "Czechia", iso: "cz", rank: 2, age: 33, height: 75 },
  { name: "Israel Adesanya", division: "MW", country: "Nigeria", iso: "ng", rank: 8, age: 36, height: 76 },
  { name: "Bo Nickal", division: "MW", country: "United States", iso: "us", rank: 13, age: 30, height: 73 },
  { name: "Edmen Shahbazyan", division: "MW", country: "United States", iso: "us", rank: null, age: 28, height: 74 },
  { name: "Carlos Ulberg", division: "LHW", country: "New Zealand", iso: "nz", rank: 1, age: 35, height: 76 },
  { name: "Nicolas Dalby", division: "WW", country: "Denmark", iso: "dk", rank: null, age: 41, height: 71 },
  { name: "Muslim Salikhov", division: "WW", country: "Russia", iso: "ru", rank: null, age: 41, height: 71 },
  { name: "Jake Matthews", division: "WW", country: "Australia", iso: "au", rank: null, age: 31, height: 71 },
  { name: "Matt Schnell", division: "FLW", country: "United States", iso: "us", rank: 12, age: 36, height: 68 },
  { name: "Alexander Volkanovski", division: "FW", country: "Australia", iso: "au", rank: 1, age: 37, height: 66 },
  { name: "Tom Aspinall", division: "HW", country: "England", iso: "gb-eng", rank: 1, age: 32, height: 77 },
  { name: "Max Holloway", division: "FW", country: "United States", iso: "us", rank: 2, age: 34, height: 71 },
  { name: "Dricus Du Plessis", division: "MW", country: "South Africa", iso: "za", rank: 1, age: 32, height: 73 },
];

const heightLabel = (inches) => `${Math.floor(inches / 12)}'${inches % 12}"`;
const rankLabel = (rank) => (rank == null ? "NR" : `#${rank}`);

function direction(guess, answer) {
  if (guess == null && answer == null) return "";
  if (guess == null) return "↑";
  if (answer == null) return "↓";
  if (answer === guess) return "";
  return answer > guess ? "↑" : "↓";
}

function resultFor(type, guess, target) {
  if (type === "country") return guess.country === target.country ? "correct" : "miss";
  if (type === "division") {
    const a = divisions.indexOf(guess.division);
    const b = divisions.indexOf(target.division);
    return a === b ? "correct" : Math.abs(a - b) === 1 ? "close" : "miss";
  }
  const a = guess[type];
  const b = target[type];
  if (a === b) return "correct";
  if (a == null || b == null) return "miss";
  const threshold = type === "rank" ? 5 : type === "height" ? 2 : 3;
  return Math.abs(a - b) <= threshold ? "close" : "miss";
}

function GuessCard({ fighter, target, isWinner }) {
  const cells = [
    { key: "division", label: fighter.division, arrow: direction(divisions.indexOf(fighter.division), divisions.indexOf(target.division)) },
    { key: "country", label: fighter.country, iso: fighter.iso },
    { key: "rank", label: rankLabel(fighter.rank), arrow: direction(fighter.rank, target.rank) },
    { key: "age", label: fighter.age, arrow: direction(fighter.age, target.age) },
    { key: "height", label: heightLabel(fighter.height), arrow: direction(fighter.height, target.height) },
  ];

  return (
    <article className={`guess-card ${isWinner ? "winner" : ""}`}>
      <div className="fighter-name">
        <img src={assetUrl("assets/fighter-avatar.png")} alt="" />
        <strong>{fighter.name}</strong>
        {isWinner && <CheckCircle className="winner-check" weight="fill" />}
      </div>
      <div className="attribute-grid">
        {cells.map((cell) => (
          <div className={`attribute ${resultFor(cell.key, fighter, target)}`} key={cell.key}>
            {cell.iso && <img className="flag" src={assetUrl(`flags/${cell.iso}.svg`)} alt="" />}
            <span>{cell.label}</span>
            {cell.arrow && <span className="arrow">{cell.arrow}</span>}
          </div>
        ))}
      </div>
    </article>
  );
}

function Modal({ type, onClose, stats }) {
  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <section className="modal" onMouseDown={(e) => e.stopPropagation()}>
        <button className="close-button" onClick={onClose} aria-label="Close"><X /></button>
        {type === "help" ? (
          <>
            <Question size={34} weight="bold" />
            <h2>How to play</h2>
            <p>Guess the mystery fighter in six tries. Green is an exact match, gold means you’re close, and arrows point toward the answer.</p>
            <div className="legend">
              <span className="correct">Exact match</span>
              <span className="close">Close</span>
              <span className="miss">Keep looking</span>
            </div>
          </>
        ) : (
          <>
            <ChartBar size={34} weight="fill" />
            <h2>Your corner</h2>
            <div className="stat-grid">
              <div><strong>{stats.played}</strong><span>Played</span></div>
              <div><strong>{stats.wins}</strong><span>Wins</span></div>
              <div><strong>{stats.streak}</strong><span>Streak</span></div>
            </div>
          </>
        )}
      </section>
    </div>
  );
}

function App() {
  const [targetIndex, setTargetIndex] = useState(() => Math.floor(Math.random() * fighters.length));
  const [guesses, setGuesses] = useState([]);
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const [modal, setModal] = useState(null);
  const [stats, setStats] = useState(() => {
    try { return JSON.parse(localStorage.getItem("fightle-stats")) || { played: 0, wins: 0, streak: 0 }; }
    catch { return { played: 0, wins: 0, streak: 0 }; }
  });
  const [roundRecorded, setRoundRecorded] = useState(false);
  const inputRef = useRef(null);
  const target = fighters[targetIndex];
  const won = guesses.some((fighter) => fighter.name === target.name);
  const finished = won || guesses.length >= 6;

  const suggestions = useMemo(() => {
    const used = new Set(guesses.map((g) => g.name));
    return fighters
      .filter((fighter) => !used.has(fighter.name) && fighter.name.toLowerCase().includes(query.toLowerCase().trim()))
      .slice(0, 5);
  }, [query, guesses]);

  useEffect(() => {
    if (!finished || roundRecorded) return;
    const next = {
      played: stats.played + 1,
      wins: stats.wins + (won ? 1 : 0),
      streak: won ? stats.streak + 1 : 0,
    };
    setStats(next);
    setRoundRecorded(true);
    localStorage.setItem("fightle-stats", JSON.stringify(next));
  }, [finished, roundRecorded, stats, won]);

  function submitGuess(fighter) {
    if (finished) return;
    setGuesses((current) => [...current, fighter]);
    setQuery("");
    setFocused(false);
    inputRef.current?.blur();
  }

  function newFighter() {
    let next = targetIndex;
    while (next === targetIndex) next = Math.floor(Math.random() * fighters.length);
    setTargetIndex(next);
    setGuesses([]);
    setQuery("");
    setFocused(false);
    setRoundRecorded(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function shareResult() {
    const blocks = guesses.map((fighter) =>
      ["division", "country", "rank", "age", "height"]
        .map((key) => ({ correct: "🟩", close: "🟨", miss: "⬛" }[resultFor(key, fighter, target)]))
        .join("")
    ).join("\n");
    const text = `FIGHTLE ${won ? `${guesses.length}/6` : "X/6"}\n${blocks}`;
    if (navigator.share) await navigator.share({ title: "Fightle", text });
    else await navigator.clipboard.writeText(text);
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <button className="icon-button back" aria-label="Back"><ArrowLeft /></button>
        <a className="brand" href="/" aria-label="Fightle home">
          <span className="brand-mark"><i /><i /><i /><i /></span>
          <span>FIGHTLE</span>
        </a>
        <span className="header-spacer" />
      </header>

      <main className="game">
        <div className="game-heading">
          <div>
            <h1>FIGHTLE</h1>
            <p>Guess the fighter · 6 guesses</p>
          </div>
          <div className="heading-actions">
            <button className="icon-button" onClick={() => setModal("help")} aria-label="How to play"><Question /></button>
            <button className="icon-button" onClick={() => setModal("stats")} aria-label="Statistics"><ChartBar weight="fill" /></button>
            <div className="streak"><Fire weight="fill" /> {stats.streak}</div>
          </div>
        </div>

        {!finished ? (
          <div className="search-wrap">
            <div className={`search-box ${focused ? "focus" : ""}`}>
              <MagnifyingGlass />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onFocus={() => setFocused(true)}
                placeholder={`Guess a fighter (${6 - guesses.length} left)`}
                aria-label="Guess a fighter"
              />
            </div>
            {focused && query.trim() && suggestions.length > 0 && (
              <div className="suggestions">
                {suggestions.map((fighter) => (
                  <button onMouseDown={(e) => e.preventDefault()} onClick={() => submitGuess(fighter)} key={fighter.name}>
                    <img src={assetUrl("assets/fighter-avatar.png")} alt="" />
                    <span><strong>{fighter.name}</strong><small>{fighter.division} · {fighter.country}</small></span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <section className={`result-banner ${won ? "success" : "failure"}`}>
            {won ? <Trophy weight="fill" /> : <Skull weight="fill" />}
            <div>
              <strong>{won ? "Got it!" : "Out of guesses"}</strong>
              <span>{won ? `Solved in ${guesses.length}/6` : `Answer: ${target.name}`}</span>
            </div>
            <div className="result-actions">
              <button className="share-button" onClick={shareResult}><ShareNetwork weight="fill" /> Share</button>
              <button className="next-button" onClick={newFighter}>New fighter</button>
            </div>
          </section>
        )}

        {guesses.length > 0 && (
          <>
            <div className="column-headings">
              <span>Division</span><span>Country</span><span>Rank</span><span>Age</span><span>Height</span>
            </div>
            <div className="guesses">
              {guesses.map((fighter) => (
                <GuessCard fighter={fighter} target={target} isWinner={fighter.name === target.name} key={fighter.name} />
              ))}
            </div>
          </>
        )}

        {guesses.length === 0 && (
          <section className="empty-state">
            <Barbell size={34} weight="duotone" />
            <strong>Step into the octagon</strong>
            <span>Search any active fighter to throw your first guess.</span>
          </section>
        )}
      </main>
      <footer>Unlimited rounds · No daily lockout</footer>
      {modal && <Modal type={modal} onClose={() => setModal(null)} stats={stats} />}
    </div>
  );
}

export { App };
