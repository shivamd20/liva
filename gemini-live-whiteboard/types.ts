
export enum ConnectionStatus {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  ERROR = 'error',
}

export interface Point {
  x: number;
  y: number;
}

export interface DrawAction {
  start: Point;
  end: Point;
  color: string;
  width: number;
}

export interface LineSegment {
  start: Point;
  end: Point;
  color?: string;
  width?: number;
}

export interface WhiteboardHandle {
  drawLines: (lines: any) => void;
  clear: () => void;
}

export interface AudioVisualizerData {
  volume: number;
}
