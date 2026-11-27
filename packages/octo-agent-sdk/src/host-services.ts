import type { ContextRecord, TurnId } from './contract.js';
export interface BranchContext {
  readThrough(parentTurnId: TurnId | null): Promise<readonly ContextRecord[]>;
}
export interface HostServices {
  forBranch(branch: string): BranchContext;
}
