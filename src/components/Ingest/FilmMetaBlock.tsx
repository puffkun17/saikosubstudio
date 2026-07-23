'use client';

import React from 'react';

export type FilmRating = {
  /** Display brand, e.g. TMDB / IMDb / 豆瓣 */
  brand: string;
  /** Score text, e.g. "8.3"; omit or empty to show reserved slot */
  score?: string | null;
};

type FilmMetaBlockProps = {
  ratings?: FilmRating[];
  genres?: string[];
  /** Max genre badges; rest omitted */
  maxGenres?: number;
  className?: string;
};

/**
 * Film identity meta: rating brands on their own row, forest genre tags below.
 * Extra rating slots can be passed now (empty score = reserved/faint).
 */
export const FilmMetaBlock: React.FC<FilmMetaBlockProps> = ({
  ratings = [],
  genres = [],
  maxGenres = 6,
  className = '',
}) => {
  const visibleRatings = ratings.filter((item) => item.brand);
  const visibleGenres = genres.filter(Boolean).slice(0, maxGenres);
  if (visibleRatings.length === 0 && visibleGenres.length === 0) return null;

  return (
    <div className={`flex flex-col gap-1.5 ${className}`.trim()}>
      {visibleRatings.length > 0 && (
        <div className="ui-rating-row" aria-label="评分">
          {visibleRatings.map((item) => {
            const hasScore = Boolean(item.score?.trim());
            return (
              <span
                key={item.brand}
                className={`ui-rating ${hasScore ? '' : 'ui-rating--empty'}`}
                title={hasScore ? `${item.brand} ${item.score}` : `${item.brand}（暂无）`}
              >
                <span className="ui-rating__brand">{item.brand}</span>
                <span className="ui-rating__score">{hasScore ? item.score : '—'}</span>
              </span>
            );
          })}
        </div>
      )}
      {visibleGenres.length > 0 && (
        <div className="ui-tag-row" aria-label="类型">
          {visibleGenres.map((genre) => (
            <span key={genre} className="ui-tag">
              {genre}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

/** Build rating row: TMDB when present, plus reserved IMDb / 豆瓣 slots. */
export const buildFilmRatings = (voteAverage?: number | null): FilmRating[] => {
  const tmdbScore = voteAverage != null && voteAverage > 0 ? voteAverage.toFixed(1) : null;
  if (!tmdbScore) return [];
  return [
    { brand: 'TMDB', score: tmdbScore },
    { brand: 'IMDb', score: null },
    { brand: '豆瓣', score: null },
  ];
};
