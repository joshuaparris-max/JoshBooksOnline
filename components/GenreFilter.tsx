'use client';

interface GenreFilterProps {
  genres: readonly string[];
  selected: string | null;
  counts?: Record<string, number>;
  onSelect: (genre: string | null) => void;
}

export default function GenreFilter({ genres, selected, counts, onSelect }: GenreFilterProps) {
  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={() => onSelect(null)}
        className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
          selected === null
            ? 'bg-sky-600 text-white'
            : 'bg-white/5 text-slate-400 hover:bg-white/10 hover:text-slate-200'
        }`}
      >
        All
      </button>
      {genres.map((genre) => {
        const count = counts?.[genre];
        return (
          <button
            key={genre}
            type="button"
            onClick={() => onSelect(selected === genre ? null : genre)}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
              selected === genre
                ? 'bg-sky-600 text-white'
                : 'bg-white/5 text-slate-400 hover:bg-white/10 hover:text-slate-200'
            }`}
          >
            {genre}
            {count !== undefined && (
              <span className="ml-1 opacity-60">{count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
