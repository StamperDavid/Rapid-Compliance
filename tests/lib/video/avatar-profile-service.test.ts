/**
 * Avatar Profile Service — Unit Tests
 *
 * Covers all exported functions: createAvatarProfile, getAvatarProfile,
 * listAvatarProfiles, updateAvatarProfile, deleteAvatarProfile,
 * setDefaultProfile, getDefaultProfile, addReferenceImage,
 * addGreenScreenClip, removeGreenScreenClip.
 *
 * All Firestore interactions are intercepted via the mock below — no real
 * database is contacted.
 */

// ---------------------------------------------------------------------------
// Mock function declarations — MUST be defined before jest.mock() calls
// because jest.mock() is hoisted to the top of the compiled output.
// ---------------------------------------------------------------------------

const mockSet = jest.fn().mockResolvedValue(undefined);
const mockGet = jest.fn();
const mockUpdate = jest.fn().mockResolvedValue(undefined);
const mockDelete = jest.fn().mockResolvedValue(undefined);

// Per-query get mock so different where chains can return different data
const mockWhereGet = jest.fn();

const mockDocFn = jest.fn(() => ({
  set: mockSet,
  get: mockGet,
  update: mockUpdate,
  delete: mockDelete,
}));

const mockBatchUpdate = jest.fn();
const mockBatchCommit = jest.fn().mockResolvedValue(undefined);
const mockBatchFn = jest.fn(() => ({
  update: mockBatchUpdate,
  commit: mockBatchCommit,
}));

const mockCollectionFn = jest.fn(() => ({
  doc: mockDocFn,
  where: mockWhereFn,
}));

// mockWhereFn returns a chainable object with .where(), .get(), .limit()
function mockWhereFn(): {
  where: () => ReturnType<typeof mockWhereFn>;
  get: typeof mockWhereGet;
  limit: () => { get: typeof mockWhereGet };
} {
  return {
    where: mockWhereFn,
    get: mockWhereGet,
    limit: () => ({ get: mockWhereGet }),
  };
}

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

jest.mock('@/lib/firebase/admin', () => ({
  __esModule: true,
  get adminDb() {
    return { collection: mockCollectionFn, batch: mockBatchFn };
  },
}));

jest.mock('firebase-admin/firestore', () => ({
  __esModule: true,
  FieldValue: {
    serverTimestamp: jest.fn(() => ({ _methodName: 'serverTimestamp' })),
  },
}));

jest.mock('@/lib/logger/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('@/lib/constants/platform', () => ({
  PLATFORM_ID: 'rapid-compliance-root',
}));

const FIXED_UUID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
jest.mock('crypto', () => ({
  ...jest.requireActual<typeof import('crypto')>('crypto'),
  randomUUID: jest.fn(() => FIXED_UUID),
}));

// ---------------------------------------------------------------------------
// Import the module under test — AFTER all mocks are registered
// ---------------------------------------------------------------------------

import {
  createAvatarProfile,
  getAvatarProfile,
  listAvatarProfiles,
  updateAvatarProfile,
  deleteAvatarProfile,
  setDefaultProfile,
  getDefaultProfile,
  addReferenceImage,
  addGreenScreenClip,
  removeGreenScreenClip,
  type AvatarProfile,
  type GreenScreenClip,
  type CreateAvatarProfileData,
} from '@/lib/video/avatar-profile-service';

// ---------------------------------------------------------------------------
// Shared test fixtures
// ---------------------------------------------------------------------------

const USER_ID = 'user-test-001';
const PROFILE_ID = 'profile-test-001';

function makeTimestamp(iso: string): { toDate: () => Date } {
  return { toDate: () => new Date(iso) };
}

function makeFirestoreDoc(
  id: string,
  overrides: Partial<{
    userId: string;
    name: string;
    source: string;
    role: string;
    styleTag: string;
    tier: string;
    frontalImageUrl: string;
    additionalImageUrls: string[];
    fullBodyImageUrl: string | null;
    upperBodyImageUrl: string | null;
    greenScreenClips: GreenScreenClip[];
    voiceId: string | null;
    voiceName: string | null;
    voiceProvider: string | null;
    hedraCharacterId: string | null;
    description: string | null;
    isDefault: boolean;
    isFavorite: boolean;
    createdAt: ReturnType<typeof makeTimestamp>;
    updatedAt: ReturnType<typeof makeTimestamp>;
  }> = {}
): { id: string; data: () => Record<string, unknown> } {
  const iso = '2026-01-01T00:00:00.000Z';
  return {
    id,
    data: () => ({
      userId: USER_ID,
      name: 'Test Profile',
      source: 'custom',
      role: 'presenter',
      styleTag: 'real',
      tier: 'standard',
      frontalImageUrl: 'https://example.com/face.jpg',
      additionalImageUrls: [],
      fullBodyImageUrl: null,
      upperBodyImageUrl: null,
      greenScreenClips: [],
      voiceId: null,
      voiceName: null,
      voiceProvider: null,
      hedraCharacterId: null,
      description: null,
      isDefault: false,
      isFavorite: false,
      createdAt: makeTimestamp(iso),
      updatedAt: makeTimestamp(iso),
      ...overrides,
    }),
  };
}

// ---------------------------------------------------------------------------
// beforeEach — reset all mocks between tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.clearAllMocks();
  mockBatchCommit.mockResolvedValue(undefined);
  mockUpdate.mockResolvedValue(undefined);
  mockDelete.mockResolvedValue(undefined);
  mockSet.mockResolvedValue(undefined);
});

// ===========================================================================
// createAvatarProfile
// ===========================================================================

describe('createAvatarProfile', () => {
  it('creates a profile with sensible defaults and returns success', async () => {
    mockWhereGet.mockResolvedValue({ docs: [] });

    const data: CreateAvatarProfileData = {
      name: 'David — Professional',
      frontalImageUrl: 'https://cdn.example.com/david.jpg',
    };

    const result = await createAvatarProfile(USER_ID, data);

    expect(result.success).toBe(true);
    expect(result.profile).toBeDefined();

    const profile = result.profile as AvatarProfile;
    expect(profile.id).toBe(FIXED_UUID);
    expect(profile.userId).toBe(USER_ID);
    expect(profile.name).toBe('David — Professional');
    expect(profile.source).toBe('custom');
    expect(profile.role).toBe('presenter');
    expect(profile.styleTag).toBe('real');
    expect(profile.tier).toBe('standard');
    expect(profile.frontalImageUrl).toBe('https://cdn.example.com/david.jpg');
    expect(profile.isDefault).toBe(false);
    expect(profile.isFavorite).toBe(false);
  });

  it('auto-promotes tier to premium when greenScreenClips are provided', async () => {
    mockWhereGet.mockResolvedValue({ docs: [] });

    const clip: GreenScreenClip = {
      id: 'clip-1',
      videoUrl: 'https://cdn.example.com/clip.mp4',
      thumbnailUrl: null,
      script: 'Hello world',
      duration: 10,
      createdAt: new Date().toISOString(),
    };

    const data: CreateAvatarProfileData = {
      name: 'Premium Avatar',
      frontalImageUrl: 'https://cdn.example.com/face.jpg',
      greenScreenClips: [clip],
    };

    const result = await createAvatarProfile(USER_ID, data);

    expect(result.success).toBe(true);
    expect(result.profile?.tier).toBe('premium');
  });

  it('respects explicitly set tier over auto-detection', async () => {
    mockWhereGet.mockResolvedValue({ docs: [] });

    const data: CreateAvatarProfileData = {
      name: 'Forced Standard',
      frontalImageUrl: 'https://cdn.example.com/face.jpg',
      tier: 'standard',
      greenScreenClips: [],
    };

    const result = await createAvatarProfile(USER_ID, data);
    expect(result.profile?.tier).toBe('standard');
  });

  it('calls unsetOtherDefaults when isDefault is true', async () => {
    // The where query for unsetOtherDefaults returns one existing default doc
    const existingDefaultDoc = {
      id: 'old-default-id',
      ref: { id: 'old-default-id' },
      data: () => ({ isDefault: true }),
    };
    mockWhereGet.mockResolvedValue({ docs: [existingDefaultDoc] });

    const data: CreateAvatarProfileData = {
      name: 'New Default',
      frontalImageUrl: 'https://cdn.example.com/face.jpg',
      isDefault: true,
    };

    const result = await createAvatarProfile(USER_ID, data);

    expect(result.success).toBe(true);
    expect(result.profile?.isDefault).toBe(true);
    // batch.commit should have been called since there was another default to unset
    expect(mockBatchCommit).toHaveBeenCalled();
  });

  it('truncates additionalImageUrls to a maximum of 4', async () => {
    mockWhereGet.mockResolvedValue({ docs: [] });

    const data: CreateAvatarProfileData = {
      name: 'Many Images',
      frontalImageUrl: 'https://cdn.example.com/face.jpg',
      additionalImageUrls: [
        'https://cdn.example.com/img1.jpg',
        'https://cdn.example.com/img2.jpg',
        'https://cdn.example.com/img3.jpg',
        'https://cdn.example.com/img4.jpg',
        'https://cdn.example.com/img5.jpg', // 5th — should be dropped
        'https://cdn.example.com/img6.jpg', // 6th — should be dropped
      ],
    };

    const result = await createAvatarProfile(USER_ID, data);

    expect(result.success).toBe(true);
    expect(result.profile?.additionalImageUrls).toHaveLength(4);
  });

  it('returns error when Firestore set throws', async () => {
    mockSet.mockRejectedValueOnce(new Error('Firestore write failed'));

    const result = await createAvatarProfile(USER_ID, {
      name: 'Failing Profile',
      frontalImageUrl: 'https://cdn.example.com/face.jpg',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Failed to create avatar profile');
  });
});

// ===========================================================================
// getAvatarProfile
// ===========================================================================

describe('getAvatarProfile', () => {
  it('returns a mapped AvatarProfile when document exists', async () => {
    const doc = makeFirestoreDoc(PROFILE_ID);
    mockGet.mockResolvedValueOnce({
      exists: true,
      id: PROFILE_ID,
      data: doc.data,
    });

    const profile = await getAvatarProfile(PROFILE_ID);

    expect(profile).not.toBeNull();
    expect(profile?.id).toBe(PROFILE_ID);
    expect(profile?.name).toBe('Test Profile');
    expect(profile?.userId).toBe(USER_ID);
    expect(profile?.source).toBe('custom');
  });

  it('returns null when the document does not exist', async () => {
    mockGet.mockResolvedValueOnce({ exists: false, id: PROFILE_ID });

    const profile = await getAvatarProfile(PROFILE_ID);

    expect(profile).toBeNull();
  });

  it('returns null and does not throw when Firestore throws', async () => {
    mockGet.mockRejectedValueOnce(new Error('Network error'));

    const profile = await getAvatarProfile(PROFILE_ID);

    expect(profile).toBeNull();
  });

  it('applies backward-compat hedraAssetId → hedraCharacterId mapping', async () => {
    const doc = makeFirestoreDoc(PROFILE_ID);
    const originalData = doc.data();
    mockGet.mockResolvedValueOnce({
      exists: true,
      id: PROFILE_ID,
      // Simulate a legacy document that uses hedraAssetId instead of hedraCharacterId
      data: () => ({ ...originalData, hedraCharacterId: null, hedraAssetId: 'hedra-legacy-id' }),
    });

    const profile = await getAvatarProfile(PROFILE_ID);

    expect(profile?.hedraCharacterId).toBe('hedra-legacy-id');
  });

  it('infers tier from greenScreenClips when tier field is absent', async () => {
    const clip: GreenScreenClip = {
      id: 'c1',
      videoUrl: 'https://cdn.example.com/clip.mp4',
      thumbnailUrl: null,
      script: 'Hi',
      duration: 5,
      createdAt: new Date().toISOString(),
    };
    const doc = makeFirestoreDoc(PROFILE_ID, { greenScreenClips: [clip] });
    const rawData: Record<string, unknown> = doc.data();
    // Remove tier so docToProfile must infer it
    const { tier: _omitted, ...dataWithoutTier } = rawData;
    mockGet.mockResolvedValueOnce({
      exists: true,
      id: PROFILE_ID,
      data: () => dataWithoutTier,
    });

    const profile = await getAvatarProfile(PROFILE_ID);

    expect(profile?.tier).toBe('premium');
  });
});

// ===========================================================================
// listAvatarProfiles
// ===========================================================================

describe('listAvatarProfiles', () => {
  it('returns user profiles followed by stock (system) profiles', async () => {
    const userDoc = makeFirestoreDoc('user-profile-1', {
      userId: USER_ID,
      name: 'User Profile',
      createdAt: makeTimestamp('2026-02-01T00:00:00.000Z'),
    });
    const stockDoc = makeFirestoreDoc('stock-profile-1', {
      userId: 'system',
      name: 'Stock Avatar',
      createdAt: makeTimestamp('2025-12-01T00:00:00.000Z'),
    });

    // First call → user profiles, second call → stock profiles
    mockWhereGet
      .mockResolvedValueOnce({ docs: [userDoc] })
      .mockResolvedValueOnce({ docs: [stockDoc] });

    const profiles = await listAvatarProfiles(USER_ID);

    expect(profiles).toHaveLength(2);
    expect(profiles[0].name).toBe('User Profile');
    expect(profiles[1].name).toBe('Stock Avatar');
  });

  it('returns stock profiles even when user query fails', async () => {
    const stockDoc = makeFirestoreDoc('stock-1', {
      userId: 'system',
      name: 'Stock Avatar',
    });

    mockWhereGet
      .mockRejectedValueOnce(new Error('User query failed'))
      .mockResolvedValueOnce({ docs: [stockDoc] });

    const profiles = await listAvatarProfiles(USER_ID);

    expect(profiles).toHaveLength(1);
    expect(profiles[0].name).toBe('Stock Avatar');
  });

  it('returns user profiles even when stock query fails', async () => {
    const userDoc = makeFirestoreDoc('user-1', {
      userId: USER_ID,
      name: 'My Avatar',
    });

    mockWhereGet
      .mockResolvedValueOnce({ docs: [userDoc] })
      .mockRejectedValueOnce(new Error('Stock query failed'));

    const profiles = await listAvatarProfiles(USER_ID);

    expect(profiles).toHaveLength(1);
    expect(profiles[0].name).toBe('My Avatar');
  });

  it('returns empty array when both queries fail', async () => {
    mockWhereGet
      .mockRejectedValueOnce(new Error('User query failed'))
      .mockRejectedValueOnce(new Error('Stock query failed'));

    const profiles = await listAvatarProfiles(USER_ID);

    expect(profiles).toEqual([]);
  });

  it('sorts user profiles by createdAt descending within each group', async () => {
    const older = makeFirestoreDoc('old-profile', {
      name: 'Older',
      createdAt: makeTimestamp('2026-01-01T00:00:00.000Z'),
    });
    const newer = makeFirestoreDoc('new-profile', {
      name: 'Newer',
      createdAt: makeTimestamp('2026-03-01T00:00:00.000Z'),
    });

    // Return older first from Firestore — service should sort newest first
    mockWhereGet
      .mockResolvedValueOnce({ docs: [older, newer] })
      .mockResolvedValueOnce({ docs: [] });

    const profiles = await listAvatarProfiles(USER_ID);

    expect(profiles[0].name).toBe('Newer');
    expect(profiles[1].name).toBe('Older');
  });
});

// ===========================================================================
// updateAvatarProfile
// ===========================================================================

describe('updateAvatarProfile', () => {
  it('performs a partial update and returns success', async () => {
    const result = await updateAvatarProfile(PROFILE_ID, { name: 'Updated Name' });

    expect(result.success).toBe(true);
    expect(mockUpdate).toHaveBeenCalledTimes(1);
    const updateArg = mockUpdate.mock.calls[0][0] as Record<string, unknown>;
    expect(updateArg.name).toBe('Updated Name');
    expect(updateArg.updatedAt).toBeDefined();
  });

  it('automatically includes updatedAt in every update', async () => {
    await updateAvatarProfile(PROFILE_ID, { description: 'New description' });

    const updateArg = mockUpdate.mock.calls[0][0] as Record<string, unknown>;
    expect(updateArg).toHaveProperty('updatedAt');
  });

  it('calls unsetOtherDefaults when isDefault is set to true', async () => {
    // First update call succeeds; then a get is issued to read userId; then where query for defaults
    const doc = makeFirestoreDoc(PROFILE_ID);
    mockGet.mockResolvedValueOnce({ exists: true, id: PROFILE_ID, data: doc.data });
    mockWhereGet.mockResolvedValue({ docs: [] });

    const result = await updateAvatarProfile(PROFILE_ID, { isDefault: true });

    expect(result.success).toBe(true);
    // get() is called once to retrieve userId for unsetOtherDefaults
    expect(mockGet).toHaveBeenCalledTimes(1);
  });

  it('does NOT call get() when isDefault is not changing to true', async () => {
    await updateAvatarProfile(PROFILE_ID, { name: 'No default change' });

    // No additional get() needed
    expect(mockGet).not.toHaveBeenCalled();
  });

  it('truncates additionalImageUrls to 4 in an update', async () => {
    await updateAvatarProfile(PROFILE_ID, {
      additionalImageUrls: ['u1', 'u2', 'u3', 'u4', 'u5'],
    });

    const updateArg = mockUpdate.mock.calls[0][0] as Record<string, unknown>;
    expect((updateArg.additionalImageUrls as string[])).toHaveLength(4);
  });

  it('returns error when Firestore update throws', async () => {
    mockUpdate.mockRejectedValueOnce(new Error('Firestore update failed'));

    const result = await updateAvatarProfile(PROFILE_ID, { name: 'Failing' });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Failed to update avatar profile');
  });
});

// ===========================================================================
// deleteAvatarProfile
// ===========================================================================

describe('deleteAvatarProfile', () => {
  it('deletes the profile and returns true', async () => {
    const result = await deleteAvatarProfile(PROFILE_ID);

    expect(result).toBe(true);
    expect(mockDelete).toHaveBeenCalledTimes(1);
  });

  it('returns false when Firestore delete throws', async () => {
    mockDelete.mockRejectedValueOnce(new Error('Delete failed'));

    const result = await deleteAvatarProfile(PROFILE_ID);

    expect(result).toBe(false);
  });
});

// ===========================================================================
// setDefaultProfile
// ===========================================================================

describe('setDefaultProfile', () => {
  it('sets the target profile as default and unsets others', async () => {
    const doc = makeFirestoreDoc(PROFILE_ID, { userId: USER_ID, isDefault: false });

    // First get() verifies the profile exists and belongs to the user
    mockGet.mockResolvedValueOnce({ exists: true, id: PROFILE_ID, data: doc.data });

    // Where query in unsetOtherDefaults returns no other defaults
    mockWhereGet.mockResolvedValue({ docs: [] });

    const result = await setDefaultProfile(USER_ID, PROFILE_ID);

    expect(result.success).toBe(true);
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ isDefault: true })
    );
  });

  it('returns error when the profile does not exist', async () => {
    mockGet.mockResolvedValueOnce({ exists: false });

    const result = await setDefaultProfile(USER_ID, 'nonexistent-id');

    expect(result.success).toBe(false);
    expect(result.error).toBe('Profile not found');
  });

  it('returns error when the profile belongs to a different user', async () => {
    const doc = makeFirestoreDoc(PROFILE_ID, { userId: 'other-user-999' });
    mockGet.mockResolvedValueOnce({ exists: true, id: PROFILE_ID, data: doc.data });

    const result = await setDefaultProfile(USER_ID, PROFILE_ID);

    expect(result.success).toBe(false);
    expect(result.error).toBe('Profile does not belong to this user');
  });

  it('uses a batch write to unset other current defaults', async () => {
    const doc = makeFirestoreDoc(PROFILE_ID, { userId: USER_ID });
    mockGet.mockResolvedValueOnce({ exists: true, id: PROFILE_ID, data: doc.data });

    const otherDefaultDoc = {
      id: 'other-default',
      ref: { id: 'other-default' },
      data: () => ({ isDefault: true }),
    };
    mockWhereGet.mockResolvedValue({ docs: [otherDefaultDoc] });

    await setDefaultProfile(USER_ID, PROFILE_ID);

    expect(mockBatchUpdate).toHaveBeenCalledWith(
      { id: 'other-default' },
      expect.objectContaining({ isDefault: false })
    );
    expect(mockBatchCommit).toHaveBeenCalled();
  });
});

// ===========================================================================
// getDefaultProfile
// ===========================================================================

describe('getDefaultProfile', () => {
  it('returns the profile explicitly marked as default', async () => {
    const defaultDoc = makeFirestoreDoc('explicit-default', { isDefault: true });

    // First where+limit+get call returns a hit
    mockWhereGet.mockResolvedValueOnce({
      empty: false,
      docs: [defaultDoc],
    });

    const profile = await getDefaultProfile(USER_ID);

    expect(profile).not.toBeNull();
    expect(profile?.id).toBe('explicit-default');
  });

  it('falls back to the most recently created profile when no default is set', async () => {
    const olderDoc = makeFirestoreDoc('older-profile', {
      name: 'Older',
      createdAt: makeTimestamp('2026-01-01T00:00:00.000Z'),
    });
    const newerDoc = makeFirestoreDoc('newer-profile', {
      name: 'Newer',
      createdAt: makeTimestamp('2026-03-01T00:00:00.000Z'),
    });

    // First call (isDefault == true query) → empty
    mockWhereGet.mockResolvedValueOnce({ empty: true, docs: [] });
    // Second call (all profiles query for fallback) → both docs, older listed first
    mockWhereGet.mockResolvedValueOnce({
      empty: false,
      docs: [olderDoc, newerDoc],
    });

    const profile = await getDefaultProfile(USER_ID);

    expect(profile?.name).toBe('Newer');
  });

  it('returns null when the user has no profiles at all', async () => {
    mockWhereGet.mockResolvedValueOnce({ empty: true, docs: [] });
    mockWhereGet.mockResolvedValueOnce({ empty: true, docs: [] });

    const profile = await getDefaultProfile(USER_ID);

    expect(profile).toBeNull();
  });

  it('returns null and does not throw when Firestore throws', async () => {
    mockWhereGet.mockRejectedValueOnce(new Error('Query failed'));

    const profile = await getDefaultProfile(USER_ID);

    expect(profile).toBeNull();
  });
});

// ===========================================================================
// addReferenceImage
// ===========================================================================

describe('addReferenceImage', () => {
  it('replaces frontalImageUrl for type "frontal"', async () => {
    const doc = makeFirestoreDoc(PROFILE_ID);
    mockGet.mockResolvedValueOnce({ exists: true, id: PROFILE_ID, data: doc.data });

    const result = await addReferenceImage(PROFILE_ID, 'https://cdn.example.com/new-frontal.jpg', 'frontal');

    expect(result.success).toBe(true);
    const updateArg = mockUpdate.mock.calls[0][0] as Record<string, unknown>;
    expect(updateArg.frontalImageUrl).toBe('https://cdn.example.com/new-frontal.jpg');
  });

  it('appends an additional image when under the 4-image limit', async () => {
    const doc = makeFirestoreDoc(PROFILE_ID, {
      additionalImageUrls: ['https://cdn.example.com/existing.jpg'],
    });
    mockGet.mockResolvedValueOnce({ exists: true, id: PROFILE_ID, data: doc.data });

    const result = await addReferenceImage(PROFILE_ID, 'https://cdn.example.com/extra.jpg', 'additional');

    expect(result.success).toBe(true);
    const updateArg = mockUpdate.mock.calls[0][0] as Record<string, unknown>;
    expect((updateArg.additionalImageUrls as string[])).toHaveLength(2);
  });

  it('rejects an additional image when already at the 4-image limit', async () => {
    const doc = makeFirestoreDoc(PROFILE_ID, {
      additionalImageUrls: ['img1', 'img2', 'img3', 'img4'],
    });
    mockGet.mockResolvedValueOnce({ exists: true, id: PROFILE_ID, data: doc.data });

    const result = await addReferenceImage(PROFILE_ID, 'img5', 'additional');

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Maximum of 4 additional images/);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('sets fullBodyImageUrl for type "fullBody"', async () => {
    const doc = makeFirestoreDoc(PROFILE_ID);
    mockGet.mockResolvedValueOnce({ exists: true, id: PROFILE_ID, data: doc.data });

    const result = await addReferenceImage(PROFILE_ID, 'https://cdn.example.com/body.jpg', 'fullBody');

    expect(result.success).toBe(true);
    const updateArg = mockUpdate.mock.calls[0][0] as Record<string, unknown>;
    expect(updateArg.fullBodyImageUrl).toBe('https://cdn.example.com/body.jpg');
  });

  it('sets upperBodyImageUrl for type "upperBody"', async () => {
    const doc = makeFirestoreDoc(PROFILE_ID);
    mockGet.mockResolvedValueOnce({ exists: true, id: PROFILE_ID, data: doc.data });

    const result = await addReferenceImage(PROFILE_ID, 'https://cdn.example.com/upper.jpg', 'upperBody');

    expect(result.success).toBe(true);
    const updateArg = mockUpdate.mock.calls[0][0] as Record<string, unknown>;
    expect(updateArg.upperBodyImageUrl).toBe('https://cdn.example.com/upper.jpg');
  });

  it('returns error when profile does not exist', async () => {
    mockGet.mockResolvedValueOnce({ exists: false });

    const result = await addReferenceImage(PROFILE_ID, 'https://cdn.example.com/img.jpg', 'frontal');

    expect(result.success).toBe(false);
    expect(result.error).toBe('Profile not found');
  });

  it('returns error when Firestore throws', async () => {
    mockGet.mockRejectedValueOnce(new Error('DB error'));

    const result = await addReferenceImage(PROFILE_ID, 'https://cdn.example.com/img.jpg', 'frontal');

    expect(result.success).toBe(false);
    expect(result.error).toBe('Failed to add reference image');
  });
});

// ===========================================================================
// addGreenScreenClip
// ===========================================================================

describe('addGreenScreenClip', () => {
  it('adds a clip and upgrades tier to premium', async () => {
    const doc = makeFirestoreDoc(PROFILE_ID, { greenScreenClips: [], tier: 'standard' });
    mockGet.mockResolvedValueOnce({ exists: true, id: PROFILE_ID, data: doc.data });

    const result = await addGreenScreenClip(PROFILE_ID, {
      videoUrl: 'https://cdn.example.com/clip.mp4',
      thumbnailUrl: null,
      script: 'Hello there',
      duration: 15,
    });

    expect(result.success).toBe(true);
    expect(result.clipId).toBe(FIXED_UUID);

    const updateArg = mockUpdate.mock.calls[0][0] as Record<string, unknown>;
    expect(updateArg.tier).toBe('premium');
    const clips = updateArg.greenScreenClips as GreenScreenClip[];
    expect(clips).toHaveLength(1);
    expect(clips[0].script).toBe('Hello there');
    expect(clips[0].duration).toBe(15);
  });

  it('returns error when profile does not exist', async () => {
    mockGet.mockResolvedValueOnce({ exists: false });

    const result = await addGreenScreenClip(PROFILE_ID, {
      videoUrl: 'https://cdn.example.com/clip.mp4',
      thumbnailUrl: null,
      script: 'Script',
      duration: 10,
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Profile not found');
  });

  it('rejects when clip count is already at the maximum (20)', async () => {
    const clips: GreenScreenClip[] = Array.from({ length: 20 }, (_, i) => ({
      id: `clip-${i}`,
      videoUrl: `https://cdn.example.com/clip${i}.mp4`,
      thumbnailUrl: null,
      script: `Script ${i}`,
      duration: 5,
      createdAt: new Date().toISOString(),
    }));

    const doc = makeFirestoreDoc(PROFILE_ID, { greenScreenClips: clips });
    mockGet.mockResolvedValueOnce({ exists: true, id: PROFILE_ID, data: doc.data });

    const result = await addGreenScreenClip(PROFILE_ID, {
      videoUrl: 'https://cdn.example.com/new.mp4',
      thumbnailUrl: null,
      script: 'One more',
      duration: 8,
    });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Maximum of 20 green screen clips/);
  });

  it('returns error when Firestore throws', async () => {
    mockGet.mockRejectedValueOnce(new Error('DB error'));

    const result = await addGreenScreenClip(PROFILE_ID, {
      videoUrl: 'https://cdn.example.com/clip.mp4',
      thumbnailUrl: null,
      script: 'Script',
      duration: 10,
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Failed to add green screen clip');
  });
});

// ===========================================================================
// removeGreenScreenClip
// ===========================================================================

describe('removeGreenScreenClip', () => {
  it('removes a clip and keeps tier at premium when other clips remain', async () => {
    const clips: GreenScreenClip[] = [
      { id: 'clip-a', videoUrl: 'https://cdn/a.mp4', thumbnailUrl: null, script: 'A', duration: 5, createdAt: new Date().toISOString() },
      { id: 'clip-b', videoUrl: 'https://cdn/b.mp4', thumbnailUrl: null, script: 'B', duration: 6, createdAt: new Date().toISOString() },
    ];
    const doc = makeFirestoreDoc(PROFILE_ID, { greenScreenClips: clips, tier: 'premium' });
    mockGet.mockResolvedValueOnce({ exists: true, id: PROFILE_ID, data: doc.data });

    const result = await removeGreenScreenClip(PROFILE_ID, 'clip-a');

    expect(result.success).toBe(true);
    const updateArg = mockUpdate.mock.calls[0][0] as Record<string, unknown>;
    const remaining = updateArg.greenScreenClips as GreenScreenClip[];
    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).toBe('clip-b');
    expect(updateArg.tier).toBe('premium'); // still premium — one clip left
  });

  it('downgrades tier to standard when the last clip is removed', async () => {
    const clips: GreenScreenClip[] = [
      { id: 'only-clip', videoUrl: 'https://cdn/only.mp4', thumbnailUrl: null, script: 'Only', duration: 10, createdAt: new Date().toISOString() },
    ];
    const doc = makeFirestoreDoc(PROFILE_ID, { greenScreenClips: clips, tier: 'premium' });
    mockGet.mockResolvedValueOnce({ exists: true, id: PROFILE_ID, data: doc.data });

    const result = await removeGreenScreenClip(PROFILE_ID, 'only-clip');

    expect(result.success).toBe(true);
    const updateArg = mockUpdate.mock.calls[0][0] as Record<string, unknown>;
    expect((updateArg.greenScreenClips as GreenScreenClip[])).toHaveLength(0);
    expect(updateArg.tier).toBe('standard'); // downgraded — no clips remain
  });

  it('returns error when the specified clipId does not exist in the profile', async () => {
    const doc = makeFirestoreDoc(PROFILE_ID, { greenScreenClips: [] });
    mockGet.mockResolvedValueOnce({ exists: true, id: PROFILE_ID, data: doc.data });

    const result = await removeGreenScreenClip(PROFILE_ID, 'nonexistent-clip');

    expect(result.success).toBe(false);
    expect(result.error).toBe('Clip not found');
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('returns error when profile does not exist', async () => {
    mockGet.mockResolvedValueOnce({ exists: false });

    const result = await removeGreenScreenClip(PROFILE_ID, 'clip-a');

    expect(result.success).toBe(false);
    expect(result.error).toBe('Profile not found');
  });

  it('returns error when Firestore throws', async () => {
    mockGet.mockRejectedValueOnce(new Error('DB error'));

    const result = await removeGreenScreenClip(PROFILE_ID, 'clip-a');

    expect(result.success).toBe(false);
    expect(result.error).toBe('Failed to remove green screen clip');
  });
});
