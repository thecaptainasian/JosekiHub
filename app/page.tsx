import GoBoard from "./components/go-board";

export default function Home() {
  return (
    <main className="joseki-page">
      <section className="hero-panel">
        <div>
          <p className="hero-kicker">Joseki Atelier</p>
          <h1 className="hero-title">
            Model opening patterns on a board that feels studied, calm, and
            tactile.
          </h1>
        </div>
        <div className="hero-copy">
          <p>
            This first pass focuses on the board itself: a responsive 19 by 19
            goban with coordinates, numbered stones, captures, suicide
            prevention, and simple ko.
          </p>
          <p>
            The goal is to make sketching joseki lines feel closer to working on
            a study table than clicking through a generic game widget.
          </p>
        </div>
      </section>

      <GoBoard />
    </main>
  );
}
