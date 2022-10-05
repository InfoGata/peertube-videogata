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

const instance = "https://sepiasearch.org";

const searchPlaylists = async (
  request: SearchRequest
): Promise<SearchPlaylistResult> => {
  const count = 15;
  const start = request.page?.offset || 0;
  const path = `/api/v1/search/video-playlists`;
  const url = new URL(`${instance}${path}`);
  url.searchParams.append("search", request.query);
  url.searchParams.append("count", count.toString());
  url.searchParams.append("start", start.toString());
  const result = await axios.get<ResultList<VideoPlaylist>>(url.toString());

  const items: PlaylistInfo[] = result.data.data.map((playlist) => ({
    name: playlist.displayName,
    apiId: `${playlist.ownerAccount.host}_${playlist.uuid}`,
    images: playlist.thumbnailUrl
      ? [{ url: playlist.thumbnailUrl }]
      : undefined,
  }));

  return { items };
};

const searchChannels = async (
  request: SearchRequest
): Promise<SearchChannelResult> => {
  const count = 15;
  const start = request.page?.offset || 0;
  const path = `/api/v1/search/video-channels`;
  const url = new URL(`${instance}${path}`);
  url.searchParams.append("search", request.query);
  url.searchParams.append("count", count.toString());
  url.searchParams.append("start", start.toString());
  const result = await axios.get<ResultList<VideoChannel>>(url.toString());
  const items: Channel[] = result.data.data.map((channel) => ({
    name: channel.name,
    apiId: `${channel.name}@${channel.host}`,
  }));

  return { items };
};

const peertubeVideoToVideo = (video: PeertubeVideo): Video => {
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
    channelName: video.name,
    images: video.thumbnailUrl ? [{ url: video.thumbnailUrl }] : undefined,
  };
};

const searchVideos = async (
  request: SearchRequest
): Promise<SearchVideoResult> => {
  const count = 15;
  const start = request.page?.offset || 0;
  const path = "/api/v1/search/videos";
  const url = new URL(`${instance}${path}`);
  url.searchParams.append("search", request.query);
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
  const start = request.page?.offset || 0;
  const count = 15;
  const apiId = request.apiId || "";
  const [_name, host] = apiId.split("@");
  const path = `/api/v1/video-channels/${request.apiId}/videos`;
  const url = new URL(`https://${host}${path}`);
  url.searchParams.append("count", count.toString());
  url.searchParams.append("start", start.toString());

  const result = await axios.get<ResultList<PeertubeVideo>>(url.toString());
  const items: Video[] = result.data.data.map(peertubeVideoToVideo);

  return { items };
};

const getPlaylistVideos = async (
  request: PlaylistVideoRequest
): Promise<PlaylistVideosResult> => {
  const start = request.page?.offset || 0;
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

  return { items };
};

application.onSearchAll = searchAll;
application.onSearchVideos = searchVideos;
application.onSearchChannels = searchChannels;
application.onGetChannelVideos = getChannelVideos;
application.onGetPlaylistVideos = getPlaylistVideos;
application.onGetVideo = getVideo;
