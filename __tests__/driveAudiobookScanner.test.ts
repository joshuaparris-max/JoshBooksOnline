const listMock = jest.fn();

jest.mock('googleapis', () => ({
  google: {
    auth: { OAuth2: jest.fn(() => ({ setCredentials: jest.fn() })) },
    drive: jest.fn(() => ({ files: { list: listMock } })),
  },
}));

import { getAudiobooks } from '@/lib/googleDrive';

const folderMime = 'application/vnd.google-apps.folder';
const audioMime = 'audio/mpeg';

function folder(id: string, name: string) {
  return { id, name, mimeType: folderMime };
}

function audio(
  id: string,
  name: string,
  appProperties?: Record<string, string>
) {
  return { id, name, mimeType: audioMime, appProperties };
}

describe('Drive audiobook scanner', () => {
  beforeEach(() => {
    listMock.mockReset();

    const childrenByFolder: Record<string, object[]> = {
      // Permanent Audiobooks root
      '1NRY6dXCpILRzfG4yYTpisGqLnqx2ECEQ': [
        folder('classics', 'Fiction (Classics)'),
        folder('outlander-book', 'Voyager 3'),
      ],
      // Permanent Outlander root (the same book may also be reachable elsewhere)
      '1SBqmfghmj5gqxWRnCrxbHP65I23ohlcQ': [],
      classics: [
        audio('alice-1', 'Alice and Through the Looking Glass 1.mp3'),
        audio('alice-2', 'Alice and Through the Looking Glass 2.mp3'),
        audio('pooh-1', 'Winnie_the_Pooh_Blackstone_Part_1.mp3'),
        audio('pooh-2', 'Winnie_the_Pooh_Blackstone_Part_2.mp3'),
        audio('manual-1', 'MPCD 1.mp3', {
          m_audio_group: 'orthodoxy',
          m_audio_group_title: 'Orthodoxy',
        }),
        audio('manual-2', 'MPCD 2.mp3', {
          m_audio_group: 'orthodoxy',
          m_audio_group_title: 'Orthodoxy',
        }),
        folder('lilith-folder', 'Lilith'),
      ],
      'outlander-book': [audio('voyager-1', 'Voyager 3 - Part 1.mp3')],
      'lilith-folder': [
        audio('lilith-1', 'Lilith - Chapter 1.mp3'),
        audio('lilith-2', 'Lilith - Chapter 2.mp3'),
      ],
    };

    listMock.mockImplementation(({ q }: { q: string }) => {
      const parentId = q.match(/^'([^']+)' in parents/)?.[1];
      return Promise.resolve({
        data: { files: parentId ? childrenByFolder[parentId] || [] : [] },
      });
    });
  });

  it('splits mixed loose tracks into books without producing a category blob', async () => {
    const audiobooks = await getAudiobooks('test-token');

    expect(audiobooks.map((book) => book.title)).toEqual(
      expect.arrayContaining([
        "Alice's Adventures in Wonderland",
        'Winnie the Pooh Blackstone',
        'Orthodoxy',
        'Lilith',
        'Voyager 3',
      ])
    );
    expect(audiobooks).toHaveLength(5);
    expect(audiobooks.some((book) => book.title === 'Fiction (Classics)')).toBe(false);

    expect(audiobooks.find((book) => book.title === "Alice's Adventures in Wonderland")).toMatchObject({
      id: 'alice-1',
      isFolder: false,
    });
    expect(audiobooks.find((book) => book.title === 'Orthodoxy')).toMatchObject({
      id: 'manual-1',
      isFolder: false,
      isManualGroup: true,
    });
    expect(audiobooks.find((book) => book.title === 'Lilith')).toMatchObject({
      id: 'lilith-folder',
      isFolder: true,
    });
    expect(audiobooks.find((book) => book.title === 'Voyager 3')).toMatchObject({
      id: 'outlander-book',
      isFolder: true,
    });
  });
});
