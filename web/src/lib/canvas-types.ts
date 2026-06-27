export type ComponentType = 'frame' | 'group' | 'text' | 'button' | 'input' | 'image' | 'rect';

export interface Variant {
  name: string;
  props: Record<string, unknown>;
  styles: Record<string, string>;
}

export interface CanvasComponent {
  id: string;
  pageId: string;
  parentId: string | null;
  nodePath: string;
  type: ComponentType;
  name: string;
  position: { x: number; y: number };
  size: { w: number; h: number };
  props: Record<string, unknown>;
  styles: Record<string, string>;
  variants: Variant[];
  viewport: 'mobile' | 'desktop' | null;
  orderIndex: number;
  createdAt?: number;
  updatedAt?: number;
}

export interface CanvasToken {
  id: string;
  pageId: string;
  name: string;
  type: 'color' | 'spacing' | 'radius' | 'fontSize' | 'fontWeight';
  value: string;
}

export interface CanvasComment {
  id: string;
  page_id: string;
  content: string;
  comment_type: string;
  status: 'open' | 'resolved';
  anchor_kind: 'text' | 'component';
  anchor_id: string | null;
  anchor_path: string | null;
  tags: string[];
  snapshot_before: CanvasComponent | null;
  author_name: string;
  created_at: number;
  updated_at: number;
  agent_prompt?: string;
}

export type CanvasMessage =
  | { type: 'canvas:component:add'; payload: CanvasComponent }
  | { type: 'canvas:component:update'; payload: { id: string; patch: Partial<CanvasComponent> } }
  | { type: 'canvas:component:remove'; payload: { id: string } }
  | { type: 'canvas:token:update'; payload: CanvasToken[] }
  | { type: 'canvas:reset'; payload: { pageId: string } };

export interface ViewportPreset {
  label: string;
  width: number;
  height: number;
}

export const VIEWPORT_PRESETS: ViewportPreset[] = [
  { label: 'Desktop', width: 1440, height: 900 },
  { label: 'Mobile', width: 375, height: 812 },
];
