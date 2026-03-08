import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Video as PeertubeVideo } from "@peertube/peertube-types";

// Set up application global before importing the module
(globalThis as any).application = { endVideo: vi.fn() };

vi.mock("ky", () => {
  const mockJson = vi.fn();
  const mockGet = vi.fn(() => ({ json: mockJson }));
  return { default: { get: mockGet }, __mockGet: mockGet, __mockJson: mockJson };
});

// Import after mocks are set up
const {
  startDateToSearchFilter,
  durationToSearchFilter,
  peertubeVideoToVideo,
  searchVideos,
  searchChannels,
  searchPlaylists,
  searchAll,
  getVideo,
  getChannelVideos,
  getPlaylistVideos,
} = await import("./index");

// Get mock references
const ky = await import("ky");
const mockGet = (ky as any).__mockGet as ReturnType<typeof vi.fn>;
const mockJson = (ky as any).__mockJson as ReturnType<typeof vi.fn>;

function makePeertubeVideo(overrides: Partial<PeertubeVideo> = {}): PeertubeVideo {
  return {
    name: "Test Video",
    uuid: "abc-123",
    duration: 120,
    views: 1000,
    likes: 50,
    dislikes: 2,
    description: "A test video",
    createdAt: "2024-01-15T00:00:00.000Z",
    thumbnailPath: "/static/thumbnails/abc-123.jpg",
    channel: {
      name: "testchannel",
      displayName: "Test Channel",
      host: "example.com",
    },
    account: {
      host: "example.com",
    },
    ...overrides,
  } as PeertubeVideo;
}

describe("startDateToSearchFilter", () => {
  it("returns an ISO date string for 'today'", () => {
    const result = startDateToSearchFilter("today");
    expect(result).toBeDefined();
    expect(new Date(result!).getTime()).toBeCloseTo(Date.now() - 86400 * 1000, -4);
  });

  it("returns an ISO date string for 'week'", () => {
    const result = startDateToSearchFilter("week");
    expect(result).toBeDefined();
    expect(new Date(result!).getTime()).toBeCloseTo(Date.now() - 86400 * 7 * 1000, -4);
  });

  it("returns an ISO date string for 'month'", () => {
    const result = startDateToSearchFilter("month");
    expect(result).toBeDefined();
    expect(new Date(result!).getTime()).toBeCloseTo(Date.now() - 86400 * 30 * 1000, -4);
  });

  it("returns an ISO date string for 'year'", () => {
    const result = startDateToSearchFilter("year");
    expect(result).toBeDefined();
    expect(new Date(result!).getTime()).toBeCloseTo(Date.now() - 86400 * 365 * 1000, -4);
  });

  it("returns undefined for unknown values", () => {
    expect(startDateToSearchFilter("unknown")).toBeUndefined();
  });

  it("returns undefined when no argument is passed", () => {
    expect(startDateToSearchFilter()).toBeUndefined();
  });
});

describe("durationToSearchFilter", () => {
  it("returns [undefined, 240] for 'short'", () => {
    expect(durationToSearchFilter("short")).toEqual([undefined, 240]);
  });

  it("returns [240, 600] for 'medium'", () => {
    expect(durationToSearchFilter("medium")).toEqual([240, 600]);
  });

  it("returns [600, undefined] for 'long'", () => {
    expect(durationToSearchFilter("long")).toEqual([600, undefined]);
  });

  it("returns undefined for unknown values", () => {
    expect(durationToSearchFilter("unknown")).toBeUndefined();
  });

  it("returns undefined when no argument is passed", () => {
    expect(durationToSearchFilter()).toBeUndefined();
  });
});

describe("peertubeVideoToVideo", () => {
  it("correctly maps a PeerTube video to a Video", () => {
    const ptVideo = makePeertubeVideo();
    const result = peertubeVideoToVideo(ptVideo);

    expect(result).toEqual({
      title: "Test Video",
      apiId: "example.com_abc-123",
      duration: 120,
      views: 1000,
      likes: 50,
      dislikes: 2,
      description: "A test video",
      uploadDate: "2024-01-15T00:00:00.000Z",
      channelName: "Test Channel",
      channelApiId: "testchannel@example.com",
      images: [{ url: "https://example.com/static/thumbnails/abc-123.jpg" }],
    });
  });

  it("handles createdAt as a Date object", () => {
    const date = new Date("2024-06-01T12:00:00.000Z");
    const ptVideo = makePeertubeVideo({ createdAt: date as any });
    const result = peertubeVideoToVideo(ptVideo);

    expect(result.uploadDate).toBe("2024-06-01T12:00:00.000Z");
  });
});

describe("searchVideos", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("builds the correct URL and returns mapped results", async () => {
    const ptVideo = makePeertubeVideo();
    mockJson.mockResolvedValueOnce({ data: [ptVideo], total: 1 });

    const result = await searchVideos({ query: "test" } as SearchRequest);

    expect(mockGet).toHaveBeenCalledOnce();
    const calledUrl = new URL(mockGet.mock.calls[0][0]);
    expect(calledUrl.pathname).toBe("/api/v1/search/videos");
    expect(calledUrl.searchParams.get("search")).toBe("test");
    expect(calledUrl.searchParams.get("count")).toBe("15");
    expect(calledUrl.searchParams.get("start")).toBe("0");
    expect(calledUrl.searchParams.get("nsfw")).toBe("false");
    expect(calledUrl.searchParams.get("sort")).toBe("-match");

    expect(result.items).toHaveLength(1);
    expect(result.items[0].title).toBe("Test Video");
    expect(result.pageInfo?.totalResults).toBe(1);
    expect(result.filterInfo).toBeDefined();
  });

  it("applies duration filter parameters", async () => {
    mockJson.mockResolvedValueOnce({ data: [], total: 0 });

    await searchVideos({
      query: "test",
      filterInfo: {
        filters: [{ id: "duration", value: "short" }],
      },
    } as SearchRequest);

    const calledUrl = new URL(mockGet.mock.calls[0][0]);
    expect(calledUrl.searchParams.get("durationMax")).toBe("240");
    expect(calledUrl.searchParams.has("durationMin")).toBe(false);
  });

  it("applies startDate filter parameters", async () => {
    mockJson.mockResolvedValueOnce({ data: [], total: 0 });

    await searchVideos({
      query: "test",
      filterInfo: {
        filters: [{ id: "startDate", value: "week" }],
      },
    } as SearchRequest);

    const calledUrl = new URL(mockGet.mock.calls[0][0]);
    expect(calledUrl.searchParams.has("startDate")).toBe(true);
  });

  it("uses pagination offset", async () => {
    mockJson.mockResolvedValueOnce({ data: [], total: 0 });

    await searchVideos({
      query: "test",
      pageInfo: { offset: 30 },
    } as SearchRequest);

    const calledUrl = new URL(mockGet.mock.calls[0][0]);
    expect(calledUrl.searchParams.get("start")).toBe("30");
  });
});

describe("searchChannels", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("builds the correct URL and maps channel data", async () => {
    mockJson.mockResolvedValueOnce({
      data: [
        {
          name: "mychannel",
          host: "peer.tube",
          avatars: [{ fileUrl: "https://peer.tube/avatar.png", width: 48, height: 48, path: "/avatar.png", createdAt: "", updatedAt: "" }],
        },
      ],
      total: 1,
    });

    const result = await searchChannels({ query: "music" } as SearchRequest);

    const calledUrl = new URL(mockGet.mock.calls[0][0]);
    expect(calledUrl.pathname).toBe("/api/v1/search/video-channels");
    expect(calledUrl.searchParams.get("search")).toBe("music");

    expect(result.items).toHaveLength(1);
    expect(result.items[0].name).toBe("mychannel");
    expect(result.items[0].apiId).toBe("mychannel@peer.tube");
    expect(result.items[0].images).toEqual([{ url: "https://peer.tube/avatar.png" }]);
  });

  it("handles channels without avatars", async () => {
    mockJson.mockResolvedValueOnce({
      data: [{ name: "nochannel", host: "peer.tube", avatars: [] }],
      total: 1,
    });

    const result = await searchChannels({ query: "test" } as SearchRequest);
    expect(result.items[0].images).toBeUndefined();
  });
});

describe("searchPlaylists", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("builds the correct URL and maps playlist data", async () => {
    mockJson.mockResolvedValueOnce({
      data: [
        {
          displayName: "My Playlist",
          uuid: "playlist-uuid",
          ownerAccount: { host: "peer.tube" },
          thumbnailUrl: "https://peer.tube/thumb.jpg",
        },
      ],
      total: 1,
    });

    const result = await searchPlaylists({ query: "favorites" } as SearchRequest);

    const calledUrl = new URL(mockGet.mock.calls[0][0]);
    expect(calledUrl.pathname).toBe("/api/v1/search/video-playlists");
    expect(calledUrl.searchParams.get("search")).toBe("favorites");

    expect(result.items).toHaveLength(1);
    expect(result.items[0].name).toBe("My Playlist");
    expect(result.items[0].apiId).toBe("peer.tube_playlist-uuid");
    expect(result.items[0].images).toEqual([{ url: "https://peer.tube/thumb.jpg" }]);
  });
});

describe("searchAll", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls all three search functions and returns combined results", async () => {
    // searchPlaylists is called first (declared first), then searchChannels, then searchVideos
    // But Promise.all order: videos, channels, playlists
    // The mock returns in call order, so we need 3 responses
    mockJson
      .mockResolvedValueOnce({ data: [], total: 0 }) // searchVideos
      .mockResolvedValueOnce({ data: [], total: 0 }) // searchChannels
      .mockResolvedValueOnce({ data: [], total: 0 }); // searchPlaylists

    const result = await searchAll({ query: "test" } as SearchRequest);

    expect(result.videos).toBeDefined();
    expect(result.channels).toBeDefined();
    expect(result.playlists).toBeDefined();
    expect(mockGet).toHaveBeenCalledTimes(3);
  });
});

describe("getVideo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("parses apiId and fetches from the correct host", async () => {
    const ptVideo = makePeertubeVideo();
    mockJson.mockResolvedValueOnce(ptVideo);

    const result = await getVideo({ apiId: "example.com_abc-123" } as GetVideoRequest);

    expect(mockGet).toHaveBeenCalledWith("https://example.com/api/v1/videos/abc-123");
    expect(result.title).toBe("Test Video");
  });
});

describe("getChannelVideos", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("parses apiId and builds the correct URL", async () => {
    const ptVideo = makePeertubeVideo();
    mockJson.mockResolvedValueOnce({ data: [ptVideo], total: 1 });

    const result = await getChannelVideos({
      apiId: "testchannel@example.com",
    } as ChannelVideosRequest);

    const calledUrl = new URL(mockGet.mock.calls[0][0]);
    expect(calledUrl.hostname).toBe("example.com");
    expect(calledUrl.pathname).toBe("/api/v1/video-channels/testchannel@example.com/videos");

    expect(result.items).toHaveLength(1);
    expect(result.pageInfo?.totalResults).toBe(1);
  });
});

describe("getPlaylistVideos", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("parses apiId and fetches playlist videos", async () => {
    const ptVideo = makePeertubeVideo();
    mockJson.mockResolvedValueOnce({
      data: [{ video: ptVideo }],
      total: 1,
    });

    const result = await getPlaylistVideos({
      apiId: "peer.tube_playlist-uuid",
    } as PlaylistVideoRequest);

    const calledUrl = new URL(mockGet.mock.calls[0][0]);
    expect(calledUrl.hostname).toBe("peer.tube");
    expect(calledUrl.pathname).toBe("/api/v1/video-playlists/playlist-uuid/videos");

    expect(result.items).toHaveLength(1);
  });

  it("filters out null videos", async () => {
    mockJson.mockResolvedValueOnce({
      data: [{ video: makePeertubeVideo() }, { video: null }],
      total: 2,
    });

    const result = await getPlaylistVideos({
      apiId: "peer.tube_playlist-uuid",
    } as PlaylistVideoRequest);

    expect(result.items).toHaveLength(1);
  });
});
