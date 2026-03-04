// src/types.ts

export interface FourLayerMemory {
  goal: string;
  semantic: string;
  procedural: string;
  episodic: string;
}

export interface Context {
  goal: string;
  semantic: string;
  procedural: string;
  recentEpisodes: string;
  projectState: string;
}

export interface Candidate {
  action: string;
  impact: number;      // 1-5
  urgency: number;     // 1-5
  confidence: number;  // 0.1-1.0
  reasoning: string;
}

export interface Decision {
  candidates: Candidate[];
  selected: Candidate;
  priority: number;    // impact * urgency * confidence
  stopReason: string | null;
}

export interface ActResult {
  success: boolean;
  output: string;
}

export interface LoopOptions {
  maxIterations: number;
  once: boolean;
  memoryDir: string;
  workspaceDir: string;
}
