import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
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
import fighters from "./data/fighters.json";

const divisionMeta = {
  SW: { track: "men", order: 0 },
  FLW: { track: "men", order: 1 },
  BW: { track: "men", order: 2 },
  FW: { track: "men", order: 3 },
  LW: { track: "men", order: 4 },
  WW: { track: "men", order: 5 },
  MW: { track: "men", order: 6 },
  LHW: { track: "men", order: 7 },
  HW: { track: "men", order: 8 },
  WSW: { track: "women", order: 0 },
  WFLW: { track: "women", order: 1 },
  WBW: { track: "women", order: 2 },
  WFW: { track: "women", order: 3 },
};
const assetUrl = (path) => `${import.meta.env.BASE_URL}${path}`;

const heightLabel = (inches) => `${Math.floor(inches / 12)}'${inches % 12}"`;
const rankLabel = (rank) => (rank == null ? "NR" : rank === 0 ? "C" : `#${rank}`);
const divisionLabel = (division) => (division.startsWith("W") ? `W-${division.slice(1)}` : division);
const rankedFighterIndexes = fighters
  .map((fighter, index) => ({ fighter, index }))
  .filter(({ fighter }) => fighter.rank != null && fighter.rank <= 15)
  .map(({ index }) => index);
const unrankedFighterIndexes = fighters
  .map((fighter, index) => ({ fighter, index }))
  .filter(({ fighter }) => fighter.rank == null || fighter.rank > 15)
  .map(({ index }) => index);

function randomTargetIndex(excludeIndex = -1) {
  const preferRanked = Math.random() < 0.8;
  const preferredPool = preferRanked ? rankedFighterIndexes : unrankedFighterIndexes;
  const available = preferredPool.filter((index) => index !== excludeIndex);
  const fallback = fighters.map((_, index) => index).filter((index) => index !== excludeIndex);
  const pool = available.length > 0 ? available : fallback;
  return pool[Math.floor(Math.random() * pool.length)];
}

function FighterAvatar({ fighter }) {
  const fallback = assetUrl("assets/fighter-avatar.png");
  return (
    <img
      src={fighter.image || fallback}
      alt=""
      referrerPolicy="no-referrer"
      onError={(event) => {
        event.currentTarget.onerror = null;
        event.currentTarget.src = fallback;
      }}
    />
  );
}

// Numeric arrows point from the guessed value toward the answer.
function direction(guess, answer) {
  if (guess == null && answer == null) return "";
  if (guess == null) return "↑";
  if (answer == null) return "↓";
  if (answer === guess) return "";
  return answer > guess ? "↑" : "↓";
}

// Ranking is inverse-numeric: #1 is higher than #2, #3, and so on.
function rankDirection(guess, answer) {
  if (guess == null || answer == null || guess === answer) {
    return direction(guess, answer);
  }
  return answer < guess ? "↑" : "↓";
}

function divisionDirection(guess, answer) {
  const guessMeta = divisionMeta[guess];
  const answerMeta = divisionMeta[answer];
  if (!guessMeta || !answerMeta || guessMeta.track !== answerMeta.track) return "";
  return direction(guessMeta.order, answerMeta.order);
}

function resultFor(type, guess, target) {
  if (type === "country") return guess.country === target.country ? "correct" : "miss";
  if (type === "division") {
    const a = divisionMeta[guess.division];
    const b = divisionMeta[target.division];
    if (!a || !b) return "miss";
    if (a.track !== b.track) return "gender";
    return a.order === b.order ? "correct" : Math.abs(a.order - b.order) === 1 ? "close" : "miss";
  }
  const a = guess[type];
  const b = target[type];
  if (a === b) return "correct";
  if (a == null || b == null) return "miss";
  const threshold = type === "rank" ? 2 : type === "height" ? 2 : 3;
  return Math.abs(a - b) <= threshold ? "close" : "miss";
}

function GuessCard({ fighter, target, isWinner }) {
  const cells = [
    { key: "division", label: divisionLabel(fighter.division), arrow: divisionDirection(fighter.division, target.division) },
    { key: "country", label: fighter.country, iso: fighter.iso },
    { key: "rank", label: rankLabel(fighter.rank), arrow: rankDirection(fighter.rank, target.rank) },
    { key: "age", label: fighter.age, arrow: direction(fighter.age, target.age) },
    { key: "height", label: heightLabel(fighter.height), arrow: direction(fighter.height, target.height) },
  ];

  return (
    <article className={`guess-card ${isWinner ? "winner" : ""}`}>
      <div className="fighter-name">
        <FighterAvatar fighter={fighter} />
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
      <section className={`modal ${type === "help" ? "help-modal" : ""}`} onMouseDown={(e) => e.stopPropagation()}>
        <button className="close-button" onClick={onClose} aria-label="Close"><X /></button>
        {type === "help" ? (
          <>
            <h2>How to play</h2>
            <p>Guess the mystery UFC fighter in 6 tries.</p>
            <p>After each guess, every tile shows how your pick compares:</p>
            <div className="help-legend">
              <div><span className="help-swatch correct" /><p><strong>Green</strong> — exact match</p></div>
              <div><span className="help-swatch close" /><p><strong>Yellow</strong> — close: within 2 ranks, 3 years (age), 2 inches (height), or one weight class away</p></div>
              <div><span className="help-swatch miss" /><p><strong>Gray</strong> — not close</p></div>
              <div><span className="help-swatch gender" /><p><strong>Purple</strong> — Division: different gender (men’s vs women’s)</p></div>
            </div>
            <p>Arrows point toward the answer:</p>
            <div className="arrow-help">
              <div><ArrowUp weight="bold" /><p>Answer is higher — heavier division, ranked higher (closer to #1), older, taller</p></div>
              <div><ArrowDown weight="bold" /><p>Answer is lower</p></div>
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
  const [targetIndex, setTargetIndex] = useState(() => randomTargetIndex());
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
    setTargetIndex(randomTargetIndex(targetIndex));
    setGuesses([]);
    setQuery("");
    setFocused(false);
    setRoundRecorded(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function shareResult() {
    const blocks = guesses.map((fighter) =>
      ["division", "country", "rank", "age", "height"]
        .map((key) => ({ correct: "🟩", close: "🟨", gender: "🟪", miss: "⬛" }[resultFor(key, fighter, target)]))
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
        <a className="brand" href={import.meta.env.BASE_URL} aria-label="Fightle home">
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
                    <FighterAvatar fighter={fighter} />
                    <span><strong>{fighter.name}</strong><small>{divisionLabel(fighter.division)} · {fighter.country}</small></span>
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
