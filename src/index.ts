import {
  ResultList,
  Video as PeertubeVideo,
  VideoChannel,
  VideoPlaylist,
  VideoPlaylistElement,
} from "@peertube/peertube-types";
import axios from "axios";
import { UiMessageType } from "./types";

const nsfw = "false";
const instance = "https://sepiasearch.org";

const startDateToSearchFilter = (dateString?: string): string | undefined => {
  const day = 86400 * 1000;
  switch (dateString) {
    case "today":
      return new Date(Date.now() - day).toISOString();
    case "week":
      return new Date(Date.now() - day * 7).toISOString();
    case "month":
      return new Date(Date.now() - day * 30).toISOString();
    case "year":
      return new Date(Date.now() - day * 365).toISOString();
  }
};

const durationToSearchFilter = (
  durationString?: string
): [number?, number?] | undefined => {
  switch (durationString) {
    case "short":
      return [undefined, 4 * 60];
    case "medium":
      return [4 * 60, 10 * 60];
    case "long":
      return [10 * 60, undefined];
  }
};

const searchPlaylists = async (
  request: SearchRequest
): Promise<SearchPlaylistResult> => {
  const count = 15;
  const start = request.pageInfo?.offset || 0;
  const path = `/api/v1/search/video-playlists`;
  const url = new URL(`${instance}${path}`);
  url.searchParams.append("search", request.query);
  url.searchParams.append("count", count.toString());
  url.searchParams.append("start", start.toString());
  const result = await axios.get<ResultList<VideoPlaylist>>(url.toString());

  const items = result.data.data.map(
    (playlist): PlaylistInfo => ({
      name: playlist.displayName,
      apiId: `${playlist.ownerAccount.host}_${playlist.uuid}`,
      images: playlist.thumbnailUrl
        ? [{ url: playlist.thumbnailUrl }]
        : undefined,
    })
  );

  return {
    items,
    pageInfo: {
      totalResults: result.data.total,
      resultsPerPage: count,
      offset: start,
    },
  };
};

const searchChannels = async (
  request: SearchRequest
): Promise<SearchChannelResult> => {
  const count = 15;
  const start = request.pageInfo?.offset || 0;
  const path = `/api/v1/search/video-channels`;
  const url = new URL(`${instance}${path}`);
  url.searchParams.append("search", request.query);
  url.searchParams.append("count", count.toString());
  url.searchParams.append("start", start.toString());
  const result = await axios.get<ResultList<VideoChannel>>(url.toString());
  const items = result.data.data.map(
    (channel): Channel => ({
      name: channel.name,
      apiId: `${channel.name}@${channel.host}`,
      images:
        channel.avatar && channel.avatar.url
          ? [{ url: channel.avatar.url }]
          : undefined,
    })
  );

  return {
    items,
    pageInfo: {
      totalResults: result.data.total,
      resultsPerPage: count,
      offset: start,
    },
  };
};

const peertubeVideoToVideo = (video: PeertubeVideo): Video => {
  const url = `https://${video.channel.host}`;
  const apiId = `${video.channel.name}@${video.channel.host}`;
  return {
    title: video.name,
    apiId: `${video.account.host}_${video.uuid}`,
    duration: video.duration,
    views: video.views,
    likes: video.likes,
    dislikes: video.dislikes,
    description: video.description,
    uploadDate:
      typeof video.createdAt === "string"
        ? video.createdAt
        : video.createdAt.toISOString(),
    channelName: video.channel.displayName,
    channelApiId: apiId,
    images: [{ url: `${url}${video.thumbnailPath}` }],
  };
};

const searchVideos = async (
  request: SearchRequest
): Promise<SearchVideoResult> => {
  const count = 15;
  const start = request.pageInfo?.offset || 0;
  const path = "/api/v1/search/videos";
  const url = new URL(`${instance}${path}`);
  url.searchParams.append("search", request.query);
  url.searchParams.append("count", count.toString());
  url.searchParams.append("start", start.toString());
  url.searchParams.append("nsfw", nsfw.toString());

  if (request.filterInfo?.filters) {
    const filters = request.filterInfo.filters;
    filters.forEach((f) => {
      switch (f.id) {
        case "startDate":
          const searchFilter = startDateToSearchFilter(f.value);
          if (searchFilter) {
            url.searchParams.append("startDate", searchFilter);
          }
          break;
        case "duration":
          const durationTuple = durationToSearchFilter(f.value);
          if (durationTuple) {
            if (durationTuple[0]) {
              url.searchParams.append(
                "durationMin",
                durationTuple[0].toString()
              );
            }
            if (durationTuple[1]) {
              url.searchParams.append(
                "durationMax",
                durationTuple[1].toString()
              );
            }
          }
          break;
        case "sort":
          url.searchParams.append("sort", f.value || "-match");
          break;
      }
    });
  } else {
    url.searchParams.append("sort", "-match");
  }

  const filterInfo: FilterInfo = {
    filters: [
      {
        id: "sort",
        type: "select",
        displayName: "Sort by",
        value: "-match",
        options: [
          { displayName: "Best match", value: "-match" },
          { displayName: "Most recent", value: "-publishedAt" },
          { displayName: "Least recent", value: "publishedAt" },
        ],
      },
      {
        id: "startDate",
        type: "radio",
        displayName: "Published Date",
        value: "",
        options: [
          { displayName: "Any", value: "" },
          { displayName: "Last 24 Hours", value: "today" },
          { displayName: "Last 7 days", value: "week" },
          { displayName: "Last 30 days", value: "month" },
          { displayName: "Last 365 days", value: "year" },
        ],
      },
      {
        id: "duration",
        type: "radio",
        displayName: "Duration",
        value: "",
        options: [
          { displayName: "Any", value: "" },
          { displayName: "Short (< 4 min)", value: "short" },
          { displayName: "Medium (4-10 min)", value: "medium" },
          { displayName: "Long (> 10 min)", value: "long" },
        ],
      },
    ],
  };

  const result = await axios.get<ResultList<PeertubeVideo>>(url.toString());
  const items: Video[] = result.data.data.map(peertubeVideoToVideo);

  return {
    items,
    pageInfo: {
      totalResults: result.data.total,
      resultsPerPage: count,
      offset: start,
    },
    filterInfo,
  };
};

const searchAll = async (request: SearchRequest): Promise<SearchAllResult> => {
  const videosPromise = searchVideos(request);
  const channelsPromise = searchChannels(request);
  const playlistsPromise = searchPlaylists(request);
  const [videos, channels, playlists] = await Promise.all([
    videosPromise,
    channelsPromise,
    playlistsPromise,
  ]);
  return { videos, channels, playlists };
};

application.onUiMessage = async (message: UiMessageType) => {
  switch (message.type) {
    case "endvideo":
      application.endVideo();
      break;
  }
};

const getVideo = async (request: GetVideoRequest): Promise<Video> => {
  const [host, uuid] = request.apiId.split("_");
  const path = `/api/v1/videos/${uuid}`;
  const url = `https://${host}${path}`;
  const result = await axios.get<PeertubeVideo>(url);
  const video = peertubeVideoToVideo(result.data);
  return video;
};

const getChannelVideos = async (
  request: ChannelVideosRequest
): Promise<ChannelVideosResult> => {
  const start = request.pageInfo?.offset || 0;
  const count = 15;
  const apiId = request.apiId || "";
  const [_name, host] = apiId.split("@");
  const path = `/api/v1/video-channels/${request.apiId}/videos`;
  const url = new URL(`https://${host}${path}`);
  url.searchParams.append("count", count.toString());
  url.searchParams.append("start", start.toString());

  const result = await axios.get<ResultList<PeertubeVideo>>(url.toString());
  const items: Video[] = result.data.data.map(peertubeVideoToVideo);

  return {
    items,
    pageInfo: {
      totalResults: result.data.total,
      resultsPerPage: count,
      offset: start,
    },
  };
};

const getPlaylistVideos = async (
  request: PlaylistVideoRequest
): Promise<PlaylistVideosResult> => {
  const start = request.pageInfo?.offset || 0;
  const count = 15;

  const apiId = request.apiId || "";
  const [host, uuid] = apiId.split("_");
  const path = `/api/v1/video-playlists/${uuid}/videos`;
  const url = new URL(`https://${host}${path}`);
  url.searchParams.append("count", count.toString());
  url.searchParams.append("start", start.toString());

  const result = await axios.get<ResultList<VideoPlaylistElement>>(
    url.toString()
  );
  const items: Video[] = result.data.data
    .map((d) => d.video)
    .filter((v): v is PeertubeVideo => !!v)
    .map(peertubeVideoToVideo);

  return {
    items,
    pageInfo: {
      totalResults: result.data.total,
      resultsPerPage: count,
      offset: start,
    },
  };
};

application.onSearchAll = searchAll;
application.onSearchVideos = searchVideos;
application.onSearchChannels = searchChannels;
application.onGetChannelVideos = getChannelVideos;
application.onGetPlaylistVideos = getPlaylistVideos;
application.onGetVideo = getVideo;
