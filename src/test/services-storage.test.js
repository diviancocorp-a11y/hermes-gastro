import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockUpload, mockGetPublicUrl, mockStorageFrom } = vi.hoisted(() => {
  const upload = vi.fn();
  const getPublicUrl = vi.fn();
  const storageFrom = vi.fn(() => ({ upload, getPublicUrl }));
  return { mockUpload: upload, mockGetPublicUrl: getPublicUrl, mockStorageFrom: storageFrom };
});

vi.mock('../lib/supabase', () => ({
  supabase: {
    storage: { from: mockStorageFrom },
  },
}));

import {
  ALLOWED_IMG_TYPES, ALLOWED_IMG_EXTS, MAX_IMG_SIZE,
  uploadRecipeImage, uploadCoverImage, uploadLogoImage, uploadCatImage,
} from '@hermes/core/services/storage';

beforeEach(() => {
  vi.clearAllMocks();
  mockUpload.mockResolvedValue({ data: { path: 'test.jpg' }, error: null });
  mockGetPublicUrl.mockReturnValue({ data: { publicUrl: 'https://cdn.example.com/test.jpg' } });
});

function fakeFile(name = 'photo.jpg', type = 'image/jpeg', size = 1024) {
  return { name, type, size };
}

describe('storage constants', () => {
  it('has correct allowed types', () => {
    expect(ALLOWED_IMG_TYPES).toContain('image/jpeg');
    expect(ALLOWED_IMG_TYPES).toContain('image/png');
    expect(ALLOWED_IMG_TYPES).toContain('image/webp');
  });

  it('max size is 5MB', () => {
    expect(MAX_IMG_SIZE).toBe(5 * 1024 * 1024);
  });
});

describe('uploadRecipeImage', () => {
  it('uploads valid image and returns URL', async () => {
    const result = await uploadRecipeImage(fakeFile());
    expect(result).toBe('https://cdn.example.com/test.jpg');
    expect(mockUpload).toHaveBeenCalled();
  });

  it('rejects invalid extension', async () => {
    const result = await uploadRecipeImage(fakeFile('script.exe', 'application/exe', 1024));
    expect(result).toHaveProperty('__error');
    expect(mockUpload).not.toHaveBeenCalled();
  });

  it('rejects invalid MIME type', async () => {
    const result = await uploadRecipeImage(fakeFile('image.jpg', 'text/html', 1024));
    expect(result).toHaveProperty('__error');
    expect(mockUpload).not.toHaveBeenCalled();
  });

  it('rejects oversized file', async () => {
    const result = await uploadRecipeImage(fakeFile('big.jpg', 'image/jpeg', 10 * 1024 * 1024));
    expect(result).toHaveProperty('__error');
  });

  it('returns null on upload error', async () => {
    mockUpload.mockResolvedValue({ data: null, error: { message: 'storage full' } });
    expect(await uploadRecipeImage(fakeFile())).toBeNull();
  });
});

describe('uploadCoverImage', () => {
  it('uploads valid cover image', async () => {
    const result = await uploadCoverImage(fakeFile('cover.png', 'image/png', 2048));
    expect(result).toBe('https://cdn.example.com/test.jpg');
  });
});

describe('uploadLogoImage', () => {
  it('uploads valid logo image', async () => {
    const result = await uploadLogoImage(fakeFile('logo.webp', 'image/webp', 512));
    expect(result).toBe('https://cdn.example.com/test.jpg');
  });
});

describe('uploadCatImage', () => {
  it('uploads with category name in path', async () => {
    const result = await uploadCatImage(fakeFile('cat.jpg', 'image/jpeg', 1024), 'Tortas Dulces');
    expect(result).toBe('https://cdn.example.com/test.jpg');
    expect(mockUpload).toHaveBeenCalled();
  });
});
