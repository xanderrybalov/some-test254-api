export interface User {
  id: string;
  username: string;
  createdAt: Date;
}

export interface Movie {
  id: string;
  omdbId: string | null;
  title: string;
  normalizedTitle: string;
  year: number | null;
  runtimeMinutes: number | null;
  genre: string[] | null;
  director: string[] | null;
  poster: string | null;
  source: 'omdb' | 'custom';
  createdByUserId: string | null;
  isDeleted: boolean;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserMovie {
  userId: string;
  movieId: string;
  isFavorite: boolean;
  overriddenTitle: string | null;
  overriddenYear: number | null;
  overriddenRuntimeMinutes: number | null;
  overriddenGenre: string[] | null;
  overriddenDirector: string[] | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserMovieWithDetails extends UserMovie {
  movie: Movie;
}

export interface MovieWithUserData {
  id: string;
  title: string;
  year: number | null;
  runtimeMinutes: number | null;
  genre: string[] | null;
  director: string[] | null;
  poster: string | null;
  isFavorite: boolean;
  overrides: {
    title: string | null;
    year: number | null;
    runtimeMinutes: number | null;
    genre: string[] | null;
    director: string[] | null;
  };
  source: 'omdb' | 'custom';
}

// OMDB API types
export interface OMDBSearchResponse {
  Search: OMDBSearchItem[];
  totalResults: string;
  Response: string;
  Error?: string;
}

export interface OMDBSearchItem {
  Title: string;
  Year: string;
  imdbID: string;
  Type: string;
  Poster: string;
}

export interface OMDBMovieDetails {
  Title: string;
  Year: string;
  Rated: string;
  Released: string;
  Runtime: string;
  Genre: string;
  Director: string;
  Writer: string;
  Actors: string;
  Plot: string;
  Language: string;
  Country: string;
  Awards: string;
  Poster: string;
  Ratings: Array<{
    Source: string;
    Value: string;
  }>;
  Metascore: string;
  imdbRating: string;
  imdbVotes: string;
  imdbID: string;
  Type: string;
  DVD: string;
  BoxOffice: string;
  Production: string;
  Website: string;
  Response: string;
  Error?: string;
}

// API request/response types
export interface CreateUserRequest {
  username: string;
}

export interface UserResponse {
  user: {
    id: string;
    username: string;
  };
}

export interface SearchMoviesResponse {
  items: Array<{
    id: string;
    omdbId: string | null;
    title: string;
    year: number | null;
    runtimeMinutes: number | null;
    genre: string[] | null;
    director: string[] | null;
    source: 'omdb' | 'custom';
  }>;
  page: number;
  total: number;
}

export interface CreateMovieRequest {
  title: string;
  year: number;
  runtimeMinutes: number;
  genre: string[];
  director: string[];
  poster?: string;
}

export interface UpdateMovieRequest {
  title?: string;
  year?: number;
  runtimeMinutes?: number;
  genre?: string[];
  director?: string[];
  poster?: string;
}

export interface SetFavoriteRequest {
  isFavorite: boolean;
}

export interface GetMoviesByIdsRequest {
  ids: string[];
}

// Database row types (raw from database)
export interface UserRow {
  id: string;
  username: string;
  created_at: Date;
}

export interface MovieRow {
  id: string;
  omdb_id: string | null;
  title: string;
  normalized_title: string;
  year: number | null;
  runtime_minutes: number | null;
  genre: string[] | null;
  director: string[] | null;
  poster: string | null;
  source: 'omdb' | 'custom';
  created_by_user_id: string | null;
  is_deleted: boolean;
  deleted_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface UserMovieRow {
  id: string;
  user_id: string;
  movie_id: string;
  is_favorite: boolean;
  overridden_title: string | null;
  overridden_year: number | null;
  overridden_runtime_minutes: number | null;
  overridden_genre: string[] | null;
  overridden_director: string[] | null;
  effective_normalized_title: string;
  created_at: Date;
  updated_at: Date;
}
