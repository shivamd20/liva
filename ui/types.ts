import { OrderedExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import { AppState } from "@excalidraw/excalidraw/types";

export interface Board {
  id: string;
  title: string;
  content: string;
  createdAt: number;
  updatedAt: number;
  excalidrawElements?: OrderedExcalidrawElement[];
}
