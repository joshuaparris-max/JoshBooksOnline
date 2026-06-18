import type { OnlineEbook } from '@/types/books';

/** Build the standard Project Gutenberg EPUB + cover URLs from a book id. */
function gutenberg(
  id: number,
  title: string,
  author: string,
  category: OnlineEbook['category']
): OnlineEbook {
  return {
    id: `pg${id}`,
    title,
    author,
    format: 'epub',
    url: `https://www.gutenberg.org/cache/epub/${id}/pg${id}.epub`,
    coverUrl: `https://www.gutenberg.org/cache/epub/${id}/pg${id}.cover.medium.jpg`,
    source: 'Project Gutenberg',
    category,
  };
}

/**
 * Curated free, public-domain ebooks. All read in-app via /api/fetch-ebook.
 * Gutenberg ids are stable; if a title 404s the reader shows a friendly error.
 */
export const ONLINE_EBOOKS: OnlineEbook[] = [
  // Classic literature
  gutenberg(1342, 'Pride and Prejudice', 'Jane Austen', 'Classic literature'),
  gutenberg(1260, 'Jane Eyre', 'Charlotte Brontë', 'Classic literature'),
  gutenberg(768, 'Wuthering Heights', 'Emily Brontë', 'Classic literature'),
  gutenberg(2701, 'Moby-Dick; or, The Whale', 'Herman Melville', 'Classic literature'),
  gutenberg(1661, 'The Adventures of Sherlock Holmes', 'Arthur Conan Doyle', 'Classic literature'),
  gutenberg(98, 'A Tale of Two Cities', 'Charles Dickens', 'Classic literature'),
  gutenberg(1400, 'Great Expectations', 'Charles Dickens', 'Classic literature'),
  gutenberg(74, 'The Adventures of Tom Sawyer', 'Mark Twain', 'Classic literature'),
  gutenberg(174, 'The Picture of Dorian Gray', 'Oscar Wilde', 'Classic literature'),
  gutenberg(1184, 'The Count of Monte Cristo', 'Alexandre Dumas', 'Classic literature'),
  gutenberg(2554, 'Crime and Punishment', 'Fyodor Dostoyevsky', 'Classic literature'),

  // Sci-fi & fantasy
  gutenberg(84, 'Frankenstein', 'Mary Shelley', 'Sci-fi & fantasy'),
  gutenberg(345, 'Dracula', 'Bram Stoker', 'Sci-fi & fantasy'),
  gutenberg(35, 'The Time Machine', 'H. G. Wells', 'Sci-fi & fantasy'),
  gutenberg(36, 'The War of the Worlds', 'H. G. Wells', 'Sci-fi & fantasy'),
  gutenberg(164, 'Twenty Thousand Leagues under the Sea', 'Jules Verne', 'Sci-fi & fantasy'),
  gutenberg(11, "Alice's Adventures in Wonderland", 'Lewis Carroll', 'Sci-fi & fantasy'),
  gutenberg(55, 'The Wonderful Wizard of Oz', 'L. Frank Baum', 'Sci-fi & fantasy'),
  gutenberg(16, 'Peter Pan', 'J. M. Barrie', 'Sci-fi & fantasy'),
  gutenberg(2591, "Grimms' Fairy Tales", 'Jacob & Wilhelm Grimm', 'Sci-fi & fantasy'),

  // Philosophy & nonfiction
  gutenberg(2680, 'Meditations', 'Marcus Aurelius', 'Philosophy & nonfiction'),
  gutenberg(132, 'The Art of War', 'Sun Tzu', 'Philosophy & nonfiction'),
  gutenberg(1497, 'The Republic', 'Plato', 'Philosophy & nonfiction'),
  gutenberg(1228, 'On the Origin of Species', 'Charles Darwin', 'Philosophy & nonfiction'),
  gutenberg(2009, 'The Origin of Species (1st ed.)', 'Charles Darwin', 'Philosophy & nonfiction'),

  // Christian & faith
  gutenberg(10, 'The King James Bible', 'Authorized Version', 'Christian & faith'),
  gutenberg(131, "The Pilgrim's Progress", 'John Bunyan', 'Christian & faith'),
  gutenberg(3296, 'The Confessions of St. Augustine', 'Augustine of Hippo', 'Christian & faith'),
  gutenberg(1695, 'The Man Who Was Thursday', 'G. K. Chesterton', 'Christian & faith'),
  gutenberg(16769, 'Orthodoxy', 'G. K. Chesterton', 'Christian & faith'),
];
