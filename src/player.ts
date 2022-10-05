import { PeerTubePlayer } from "@peertube/embed-api";
import { UiMessageType } from "./types";

const playVideo = async (iframe: HTMLIFrameElement) => {
  function sendMessage(message: UiMessageType) {
    parent.postMessage(message, "*");
  }

  let player = new PeerTubePlayer(iframe);
  await player.ready;

  player.addEventListener("playbackStatusChange", (event: string) => {
    if (event === "ended") {
      sendMessage({ type: "endvideo" });
    }
  });

  player.play();
};

export const init = async () => {
  const params = new URLSearchParams(window.location.search);

  // Retrieve video info
  const apiId = params.get("apiId");
  const playerDiv = document.getElementById("player");
  if (apiId && playerDiv) {
    const [hostname, uuid] = apiId.split("_");
    const embedUrl = `https://${hostname}/videos/embed/${uuid}?api=1`;
    const iframe = document.createElement("iframe");
    iframe.src = embedUrl;
    iframe.style.width = "100%";
    iframe.style.height = "100%";
    playerDiv.append(iframe);
    await playVideo(iframe);
  }
};
