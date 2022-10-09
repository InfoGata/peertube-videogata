import "videogata-plugin-typings";
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
