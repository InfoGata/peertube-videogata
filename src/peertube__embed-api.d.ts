declare module "@peertube/embed-api" {
  export type EventHandler<T> = (ev: T) => void;
  export type PlayerEventType =
    | "pause"
    | "play"
    | "playbackStatusUpdate"
    | "playbackStatusChange"
    | "resolutionUpdate"
    | "volumeChange";
  export interface PeerTubeResolution {
    id: any;
    label: string;
    active: boolean;
    height: number;
    src?: string;
    width?: number;
  }
  export type PeerTubeTextTrack = {
    id: string;
    label: string;
    src: string;
    mode: TextTrackMode;
  };
  export class PeerTubePlayer {
    private readonly embedElement;
    private readonly scope?;
    private readonly eventRegistrar;
    private channel;
    private readyPromise;
    constructor(embedElement: HTMLIFrameElement, scope?: string);
    destroy(): void;
    addEventListener(
      event: PlayerEventType,
      handler: EventHandler<any>
    ): boolean;
    removeEventListener(
      event: PlayerEventType,
      handler: EventHandler<any>
    ): boolean;
    get ready(): Promise<void>;
    play(): Promise<void>;
    pause(): Promise<void>;
    setVolume(value: number): Promise<void>;
    getVolume(): Promise<number>;
    setCaption(value: string): Promise<void>;
    getCaptions(): Promise<PeerTubeTextTrack[]>;
    seek(seconds: number): Promise<void>;
    setResolution(resolutionId: any): Promise<void>;
    getResolutions(): Promise<PeerTubeResolution[]>;
    getPlaybackRates(): Promise<number[]>;
    getPlaybackRate(): Promise<number>;
    setPlaybackRate(rate: number): Promise<void>;
    playNextVideo(): Promise<void>;
    playPreviousVideo(): Promise<void>;
    getCurrentPosition(): Promise<number>;
    private constructChannel;
    private prepareToBeReady;
    private sendMessage;
  }
}
